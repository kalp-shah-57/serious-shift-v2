//! Serious Shift read API. Replaces the ~53 MB of static JSON the frontend used
//! to download: each endpoint serves the same shape, sourced from Postgres.
//!
//! Env: DATABASE_URL (required), ANTHROPIC_API_KEY (for /api/personalize),
//!      PORT (default 8080), FRONTEND_ORIGIN (CORS allowlist, comma-separated).

mod sql;

use std::collections::HashMap;
use std::env;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::{DefaultBodyLimit, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

const MAX_SECTIONS: usize = 20;     // /api/personalize abuse guard
const MAX_INDUSTRY_LEN: usize = 100;

/// CORS from FRONTEND_ORIGIN (comma-separated allowlist). Falls back to "any
/// origin" only when unset, with a warning — set it in production.
fn cors_layer() -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE]);
    match env::var("FRONTEND_ORIGIN") {
        Ok(v) if !v.trim().is_empty() => {
            let origins: Vec<HeaderValue> =
                v.split(',').filter_map(|o| o.trim().parse().ok()).collect();
            base.allow_origin(AllowOrigin::list(origins))
        }
        _ => {
            tracing::warn!("FRONTEND_ORIGIN not set — allowing any origin (dev only)");
            base.allow_origin(Any)
        }
    }
}

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    anthropic_key: Option<String>,
    // In-memory per-IP rate limiter and result cache for /api/personalize.
    // Single-instance scope (fine for the current deploy); move to a shared
    // KV store if the backend is scaled horizontally.
    rate: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    cache: Arc<Mutex<HashMap<String, (Instant, Value)>>>,
}

const PERSONALIZE_MODEL: &str = "claude-sonnet-4-6";
const RATE_LIMIT: usize = 10;                                   // requests…
const RATE_WINDOW: Duration = Duration::from_secs(600);         // …per 10 min per IP
const CACHE_TTL: Duration = Duration::from_secs(3600);          // personalize cache: 1 hour

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&env::var("DATABASE_URL").expect("DATABASE_URL must be set"))
        .await?;

    let state = AppState {
        pool,
        anthropic_key: env::var("ANTHROPIC_API_KEY").ok(),
        rate: Arc::new(Mutex::new(HashMap::new())),
        cache: Arc::new(Mutex::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/thinkers", get(thinkers))
        .route("/api/sources", get(sources))
        .route("/api/claims", get(claims))
        .route("/api/predictions", get(predictions))
        .route("/api/concepts", get(concepts))
        .route("/api/tensions", get(tensions))
        .route("/api/disagreements", get(disagreements))
        .route("/api/claim_concepts", get(claim_concepts))
        .route("/api/stats", get(stats))
        .route("/api/map", get(map))
        .route("/api/keynote", get(keynote))
        .route("/api/daily", get(daily))
        .route("/api/personalize", post(personalize).layer(DefaultBodyLimit::max(64 * 1024)))
        .layer(cors_layer())
        .with_state(state);

    let port = env::var("PORT").unwrap_or_else(|_| "8080".into());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    tracing::info!("listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;
    Ok(())
}

// ── error type ───────────────────────────────────────────────────────────────

struct AppError(StatusCode, String);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError(StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    }
}

// ── read endpoints (one SQL each) ──────────────────────────────────────────────

async fn run(pool: &PgPool, query: &str) -> Result<Json<Value>, AppError> {
    let doc: Value = sqlx::query_scalar(query).fetch_one(pool).await?;
    Ok(Json(doc))
}

async fn thinkers(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::THINKERS).await }
async fn sources(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::SOURCES).await }
async fn claims(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::CLAIMS).await }
async fn predictions(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::PREDICTIONS).await }
async fn concepts(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::CONCEPTS).await }
async fn tensions(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::TENSIONS).await }
async fn disagreements(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::DISAGREEMENTS).await }
async fn claim_concepts(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::CLAIM_CONCEPTS).await }
async fn stats(State(s): State<AppState>) -> Result<Json<Value>, AppError> { run(&s.pool, sql::STATS).await }

// ── document endpoints (map / keynote / daily) ─────────────────────────────────

async fn fetch_doc(pool: &PgPool, key: &str) -> Result<Json<Value>, AppError> {
    let body: Option<Value> = sqlx::query_scalar("SELECT body FROM documents WHERE key = $1")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    body.map(Json)
        .ok_or_else(|| AppError(StatusCode::NOT_FOUND, format!("document '{key}' not found")))
}

async fn map(State(s): State<AppState>) -> Result<Json<Value>, AppError> { fetch_doc(&s.pool, "map").await }
async fn keynote(State(s): State<AppState>) -> Result<Json<Value>, AppError> { fetch_doc(&s.pool, "keynote").await }
async fn daily(State(s): State<AppState>) -> Result<Json<Value>, AppError> { fetch_doc(&s.pool, "daily").await }

// ── /api/personalize (faithful port of api/personalize.js) ─────────────────────

#[derive(Deserialize)]
struct PersonalizeReq {
    industry: String,
    sections: Vec<Value>,
}

/// Client IP from X-Forwarded-For (we run behind Railway's proxy).
fn client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".into())
}

/// Sliding-window per-IP limiter. Returns false when the IP is over the limit.
fn rate_ok(state: &AppState, ip: &str) -> bool {
    let mut m = state.rate.lock().unwrap();
    let now = Instant::now();
    let hits = m.entry(ip.to_string()).or_default();
    hits.retain(|t| now.duration_since(*t) < RATE_WINDOW);
    if hits.len() >= RATE_LIMIT {
        return false;
    }
    hits.push(now);
    true
}

fn cache_key(industry: &str, sections: &[Value]) -> String {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    industry.hash(&mut h);
    serde_json::to_string(sections).unwrap_or_default().hash(&mut h);
    format!("{industry}:{:x}", h.finish())
}

async fn personalize(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PersonalizeReq>,
) -> Result<Json<Value>, AppError> {
    if req.industry.is_empty() || req.sections.is_empty() {
        return Err(AppError(StatusCode::BAD_REQUEST, "Missing industry or sections".into()));
    }
    if req.industry.len() > MAX_INDUSTRY_LEN || req.sections.len() > MAX_SECTIONS {
        return Err(AppError(StatusCode::BAD_REQUEST, "Request too large".into()));
    }
    if !rate_ok(&s, &client_ip(&headers)) {
        return Err(AppError(StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded".into()));
    }

    // Cache hit? (lock is dropped before any await)
    let ck = cache_key(&req.industry, &req.sections);
    {
        let mut c = s.cache.lock().unwrap();
        let fresh = match c.get(&ck) {
            Some((t, v)) if t.elapsed() < CACHE_TTL => Some(v.clone()),
            _ => None,
        };
        if let Some(v) = fresh {
            return Ok(Json(v));
        }
        c.remove(&ck); // stale or absent
    }

    let key = s
        .anthropic_key
        .clone()
        .ok_or_else(|| AppError(StatusCode::INTERNAL_SERVER_ERROR, "ANTHROPIC_API_KEY not configured".into()))?;

    let client = reqwest::Client::new();
    let industry = req.industry.clone();
    let futs = req.sections.into_iter().map(|section| {
        let client = client.clone();
        let key = key.clone();
        let industry = industry.clone();
        async move { rewrite_section(&client, &key, &industry, section).await }
    });
    let rewritten: Vec<Value> = futures::future::join_all(futs).await;

    let out = json!({ "sections": rewritten, "industry": industry });
    s.cache.lock().unwrap().insert(ck, (Instant::now(), out.clone()));
    Ok(Json(out))
}

async fn rewrite_section(
    client: &reqwest::Client,
    api_key: &str,
    industry: &str,
    mut section: Value,
) -> Value {
    let body_text = section.get("body").and_then(|b| b.as_str()).unwrap_or("").to_string();
    let prompt = format!(
        r#"Rewrite this trend analysis for the {industry} industry, in the Serious Shift voice:
a trusted, specific, action-obsessed interpreter for time-pressed leaders. Calm, not alarmed.
A point of view, not a summary.

RULES:
- US spelling. No em dashes (use a period or comma). Short sentences, one idea each.
- Lead with the most striking fact or claim. End on a concrete implication for the reader ("you").
- Keep all thinker names and factual claims exactly as they are. Cite thinkers as (Lastname) only, no credibility scores in the text.
- Replace general examples with {industry}-specific ones: name real companies, job titles, business functions, numbers.
- Take a position. "This kills the traditional insurance broker", not "this may have implications for intermediaries."
- No filler ("it's worth noting", "significantly", "the implications are clear"). No consultancy-speak ("leverage synergies", "future-proof", "holistic"). No generic AI commentary. No hype, no doom.
- Write like a senior {industry} peer who did the research for the reader, not an AI summarizing a report.

Original section:
{body_text}

Return ONLY the rewritten body text. No title. No preamble. No "here's the rewrite." Just the text."#
    );

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .timeout(std::time::Duration::from_secs(25))
        .json(&json!({
            "model": PERSONALIZE_MODEL,
            "max_tokens": 1024,
            "messages": [{ "role": "user", "content": prompt }],
        }))
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let data: Value = r.json().await.unwrap_or(Value::Null);
            let text = data
                .pointer("/content/0/text")
                .and_then(|t| t.as_str())
                .unwrap_or(&body_text)
                .to_string();
            if let Some(obj) = section.as_object_mut() {
                obj.insert("body".into(), json!(text));
                obj.insert("personalized".into(), json!(true));
            }
            section
        }
        _ => {
            // Match the JS fallback: keep the original body, flag the error.
            if let Some(obj) = section.as_object_mut() {
                obj.insert("error".into(), json!(true));
            }
            section
        }
    }
}
