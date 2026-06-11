#!/usr/bin/env python3
"""
generate_map_data — domain-first rebuild of the Serious Shift trend map (Postgres).

New architecture:
  4 DOMAINS  →  3-4 SCENARIOS per domain  →  2-4 KEY TRENDS per scenario
              →  3-5 SUB-TRENDS per KT    →  CLAIMS

Pipeline
  Phase 1: Domain definitions — hardcoded, inserts into domains_v2 table (no API)
  Phase 2: Claim routing     — SQL heuristic maps claims.domain → strategic domain (no API)
  Phase 3: Scenario gen      — 4 API calls (one per domain)
  Phase 4: KT gen            — N calls (one per scenario), fresh KTs from domain claims
  Phase 5: Sub-trend gen     — M calls (one per KT), same structure as v1
  Phase 6: Thinker attrib    — 1 per scenario + 1 per KT
  Phase 7: Interrelatedness  — typed edges (domain↔domain, scenario↔scenario, KT↔KT, ST↔ST)
  Phase 8: Synthesis insights — 4 calls (one per domain)
  Phase 9: Export            — write documents['map'] (served by the backend at /api/map)

Usage (DATABASE_URL + ANTHROPIC_API_KEY in env)
  python -m serious_shift_pipeline.generate_map_data
  python -m serious_shift_pipeline.generate_map_data --dry-run      # claim counts only, no API
  python -m serious_shift_pipeline.generate_map_data --phase1       # DB setup only, no API
  python -m serious_shift_pipeline.generate_map_data --export-only  # re-export from existing data

New SQLite tables (additive — existing tables untouched):
  domains_v2                  4 domain rows, hand-coded
  domain_scenarios            3-4 per domain, AI-generated
  domain_key_trends           2-4 per scenario, AI-generated (replaces hardcoded SECTION_CONFIG)
  domain_sub_trends           3-5 per KT, AI-generated
  domain_sub_trend_claims     junction
  domain_synthesis_insights   3-5 per domain, AI-generated
  domain_synthesis_insight_claims  junction
  domain_links                typed edges for new node set
  domain_flows                domain-to-domain directional influence
"""

import json
import os
import re
import sys
import time
import argparse
import random
from datetime import date

from . import db, llm

# ── Model assignment ─────────────────────────────────────────
# Editorial synthesis (scenarios, KTs, sub-trends, attribution) runs on Sonnet 4.6.
SYNTHESIS_MODEL = 'claude-sonnet-4-6'
# Synthesis insights — the most editorially demanding, lowest-volume phase — runs on Opus 4.7.
INSIGHTS_MODEL  = 'claude-opus-4-7'

CLAIMS_PER_DOM  = 200   # claims sent to scenario generation per domain
CLAIMS_PER_SCN  = 150   # claims sent to KT generation per scenario
CLAIMS_PER_KT   = 100   # claims sent to sub-trend generation per KT

# ── Pricing constants (USD per million tokens) ───────────────
# Update these when switching models; the budget guard derives from them.
SONNET_4_6_INPUT_PRICE_PER_M  = 3.0
SONNET_4_6_OUTPUT_PRICE_PER_M = 15.0
OPUS_4_7_INPUT_PRICE_PER_M    = 15.0
OPUS_4_7_OUTPUT_PRICE_PER_M   = 75.0

# Budget guards
TOTAL_BUDGET_USD = 30.0
# Conservative per-call estimate at Sonnet 4.6 rates. Opus 4.7 is 5× the price
# per token, so the Opus insights phase is charged proportionally more.
SONNET_COST_PER_CALL = 0.012
OPUS_COST_PER_CALL   = SONNET_COST_PER_CALL * (OPUS_4_7_INPUT_PRICE_PER_M / SONNET_4_6_INPUT_PRICE_PER_M)

# ---------------------------------------------------------------------------
# Domain definitions  (Phase 1 — hardcoded, never generated)
# ---------------------------------------------------------------------------
DOMAINS = [
    {
        'id':    'society',
        'name':  'Society',
        'label': 'AGI × Society / World',
        'short_description': (
            'How AGI rewrites the social contract — from democratic governance '
            'and cultural authority to what it means to be human.'
        ),
        'description': (
            "AGI doesn't arrive into a neutral world — it arrives into one already "
            "fracturing along lines of trust, meaning, and identity. This domain maps the "
            "broadest stakes: what happens to democratic governance, cultural authority, and "
            "our sense of what it means to be human when intelligence is no longer a scarce, "
            "exclusively human asset. From geopolitical realignment and institutional "
            "legitimacy crises to the redefinition of creativity, consciousness, and community, "
            "AGI × Society is where the deepest and most contested transformation plays out — "
            "the one brands and organisations are least prepared to address."
        ),
        'sort_order': 1,
        # claims.domain values that belong primarily to this strategic domain
        'primary_claim_domains': ['agi_timeline', 'existential_risk', 'geopolitics', 'regulation', 'education'],
        'secondary_claim_domains': ['labor'],
        # keyword filter for technology_capability claims → this domain
        'tech_keywords': ['governance', 'democrac', 'society', 'cultur', 'trust', 'identit',
                          'wellbe', 'consciou', 'civil', 'politic', 'public', 'power',
                          'authoritar', 'right', 'war', 'geopolit'],
    },
    {
        'id':    'economy',
        'name':  'Economy',
        'label': 'AGI × Economy',
        'short_description': (
            'How AGI restructures who creates value, who captures it, and what happens '
            'to the rest — the new K-shaped reality.'
        ),
        'description': (
            "The intelligence economy is not a better version of the knowledge economy — "
            "it is its replacement. This domain tracks the structural rewiring of how value "
            "is created, captured, and distributed when AI can perform most cognitive work at "
            "near-zero marginal cost. The K-shaped economy is accelerating: productivity gains "
            "concentrate at the top while displacement spreads below. From corporate profit "
            "capture and the collapse of knowledge-worker premiums to new models of ownership, "
            "taxation, and redistribution, AGI × Economy asks the oldest question in capitalism: "
            "who gets the surplus, and what do the rest do next?"
        ),
        'sort_order': 2,
        'primary_claim_domains': ['economy', 'labor'],
        'secondary_claim_domains': ['geopolitics'],
        'tech_keywords': ['gdp', 'produc', 'wage', 'capital', 'invest', 'wealth', 'market',
                          'profit', 'growth', 'fiscal', 'tax', 'trade', 'inequal', 'unempl',
                          'k-shaped', 'redistribu', 'ubi'],
    },
    {
        'id':    'consumers',
        'name':  'Consumers',
        'label': 'AGI × Consumer Behaviours',
        'short_description': (
            'How AGI transforms the way people make decisions, seek fulfilment, and '
            'relate to brands — human needs, now AI-mediated.'
        ),
        'description': (
            "The consumer isn't disappearing — they're delegating. As AI agents take over "
            "search, filtering, purchasing, and personalisation at scale, the rules of brand "
            "relationships are being rewritten from scratch. This domain maps the AGI-driven "
            "shifts in how people make decisions, form preferences, and seek fulfilment — "
            "structured through the lens of human needs, because AGI reshapes how those needs "
            "are met, not the needs themselves. Trust migrates from brands to agents. "
            "Authenticity commands a premium. Emotional connection becomes harder to fake and "
            "more valuable to find. The consumer is still human. That's precisely what's "
            "changing everything."
        ),
        'sort_order': 3,
        'primary_claim_domains': ['consumer_behavior'],
        'secondary_claim_domains': ['education'],
        'tech_keywords': ['consumer', 'customer', 'brand', 'purchas', 'personali', 'experienc',
                          'agent', 'recommend', 'shop', 'loyalt', 'product', 'user', 'retail',
                          'delegat', 'trust'],
    },
    {
        'id':    'organisations',
        'name':  'Organisations',
        'label': 'AGI × Organisations',
        'short_description': (
            'How firms and institutions adapt — or fail to — when AI can perform, '
            'plan, and decide faster than any hierarchy was built to handle.'
        ),
        'description': (
            "Most organisations were designed for a world of scarce intelligence and "
            "predictable processes. Neither assumption holds. This domain tracks what happens "
            "to firms, institutions, and professional structures when AI can perform, plan, and "
            "decide at speeds no human hierarchy was built to absorb. From workforce redesign "
            "and agentic process automation to the institutional inertia that turns competitive "
            "advantage into competitive liability, AGI × Organisations is where strategic "
            "ambition and operational reality collide most visibly. The question is no longer "
            "whether to reorganise around AI — it's whether organisations can move fast enough "
            "to matter."
        ),
        'sort_order': 4,
        'primary_claim_domains': ['enterprise'],
        'secondary_claim_domains': ['regulation', 'education'],
        'tech_keywords': ['enterpris', 'organis', 'corporat', 'firm', 'workforc', 'employe',
                          'manag', 'strateg', 'leader', 'institutio', 'business', 'ceo',
                          'exec', 'automat', 'workforce', 'agentic'],
    },
]

# Preset domain flows (Reinier's diagram — directional influence arrows)
DOMAIN_FLOWS_PRESET = [
    {'source': 'society',       'target': 'economy',       'strength': 'high',   'description': 'Societal legitimacy crises and governance failures shape economic confidence and policy responses.'},
    {'source': 'society',       'target': 'consumers',     'strength': 'high',   'description': 'Cultural shifts in identity, trust, and meaning drive consumer expectations and behavioural norms.'},
    {'source': 'economy',       'target': 'consumers',     'strength': 'high',   'description': 'Economic disruption — displacement, inequality, new income models — redefines consumer purchasing power and priorities.'},
    {'source': 'economy',       'target': 'organisations', 'strength': 'high',   'description': 'Macro-economic pressures, labour cost dynamics, and capital flows directly determine organisational strategy.'},
    {'source': 'consumers',     'target': 'organisations', 'strength': 'high',   'description': 'Shifting consumer expectations and agent-mediated purchase patterns force organisational redesign.'},
    {'source': 'organisations', 'target': 'economy',       'strength': 'medium', 'description': 'Corporate adoption of AI at scale drives productivity, employment patterns, and market concentration.'},
]


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_conn():
    return db.raw_connect()


def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-')


# ---------------------------------------------------------------------------
# DDL — new v2 tables (additive; existing tables untouched)
# ---------------------------------------------------------------------------

DDL_V2 = """
CREATE TABLE IF NOT EXISTS domains_v2 (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    label             TEXT NOT NULL,
    short_description TEXT NOT NULL,
    description       TEXT NOT NULL,
    sort_order        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS domain_scenarios (
    id           INTEGER PRIMARY KEY,
    slug         TEXT UNIQUE NOT NULL,
    domain_id    TEXT NOT NULL REFERENCES domains_v2(id),
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    horizon      TEXT,
    plausibility TEXT,
    sort_order   INTEGER NOT NULL,
    proponents   TEXT,
    skeptics     TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domain_key_trends (
    id           INTEGER PRIMARY KEY,
    slug         TEXT UNIQUE NOT NULL,
    scenario_id  INTEGER NOT NULL REFERENCES domain_scenarios(id),
    domain_id    TEXT NOT NULL REFERENCES domains_v2(id),
    name         TEXT NOT NULL,
    subtitle     TEXT NOT NULL,
    velocity     TEXT,
    sort_order   INTEGER NOT NULL,
    proponents   TEXT,
    skeptics     TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domain_sub_trends (
    id           INTEGER PRIMARY KEY,
    slug         TEXT UNIQUE NOT NULL,
    kt_id        INTEGER NOT NULL REFERENCES domain_key_trends(id),
    domain_id    TEXT NOT NULL REFERENCES domains_v2(id),
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    sort_order   INTEGER NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domain_sub_trend_claims (
    sub_trend_id INTEGER REFERENCES domain_sub_trends(id),
    claim_id     INTEGER REFERENCES claims(id),
    PRIMARY KEY (sub_trend_id, claim_id)
);

CREATE TABLE IF NOT EXISTS domain_synthesis_insights (
    id           INTEGER PRIMARY KEY,
    slug         TEXT UNIQUE NOT NULL,
    domain_id    TEXT NOT NULL REFERENCES domains_v2(id),
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domain_synthesis_insight_claims (
    insight_id   INTEGER REFERENCES domain_synthesis_insights(id),
    claim_id     INTEGER REFERENCES claims(id),
    PRIMARY KEY (insight_id, claim_id)
);

CREATE TABLE IF NOT EXISTS domain_links (
    id           INTEGER PRIMARY KEY,
    source_type  TEXT NOT NULL,
    source_id    TEXT NOT NULL,
    target_type  TEXT NOT NULL,
    target_id    TEXT NOT NULL,
    relationship TEXT NOT NULL,
    strength     REAL NOT NULL,
    reasoning    TEXT,
    UNIQUE(source_type, source_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS domain_flows (
    id          INTEGER PRIMARY KEY,
    source_id   TEXT NOT NULL REFERENCES domains_v2(id),
    target_id   TEXT NOT NULL REFERENCES domains_v2(id),
    strength    TEXT NOT NULL,
    description TEXT,
    UNIQUE(source_id, target_id)
);
"""

DROP_V2_ORDER = [
    'domain_synthesis_insight_claims',
    'domain_synthesis_insights',
    'domain_links',
    'domain_sub_trend_claims',
    'domain_sub_trends',
    'domain_key_trends',
    'domain_scenarios',
    'domain_flows',
    'domains_v2',
]


def reset_v2_tables(conn):
    """Clear all v2 tables before a rebuild. The schema itself is owned by the
    packages/db migrations, so we TRUNCATE rather than drop/recreate."""
    conn.execute('TRUNCATE ' + ', '.join(DROP_V2_ORDER) + ' RESTART IDENTITY CASCADE')
    conn.commit()
    print('  ✓  v2 tables reset.')


# ---------------------------------------------------------------------------
# API call + JSON extraction (reused from v1)
# ---------------------------------------------------------------------------

def call_claude(prompt: str, api_key: str = None, retries: int = 3,
                model: str = SYNTHESIS_MODEL) -> str:
    # api_key is accepted for call-site compatibility; the SDK reads
    # ANTHROPIC_API_KEY from the environment.
    text, _ = llm.call_claude(prompt, model=model, max_tokens=32000, retries=retries)
    return text


def extract_json(text: str):
    stripped = text.strip()
    fence = re.search(r'```(?:json)?\s*(.*?)\s*```', stripped, re.DOTALL)
    if fence:
        stripped = fence.group(1).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    for sc, ec in [('{', '}'), ('[', ']')]:
        idx = stripped.find(sc)
        if idx == -1:
            continue
        depth, in_str, escape = 0, False, False
        for i in range(idx, len(stripped)):
            ch = stripped[i]
            if escape:
                escape = False; continue
            if ch == '\\':
                escape = True; continue
            if ch == '"':
                in_str = not in_str; continue
            if in_str:
                continue
            if ch == sc:
                depth += 1
            elif ch == ec:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(stripped[idx:i + 1])
                    except json.JSONDecodeError:
                        break
    raise ValueError(f'No JSON found:\n{text[:1500]}')


# ---------------------------------------------------------------------------
# Budget guard
# ---------------------------------------------------------------------------

def check_budget(api_cost: float, label: str,
                 per_call: float = SONNET_COST_PER_CALL) -> float:
    new = api_cost + per_call
    if new > TOTAL_BUDGET_USD:
        print(f'\n⚠  Budget guard: ${new:.3f} would exceed ${TOTAL_BUDGET_USD:.2f} at {label}. Halting.')
        sys.exit(0)
    return new


# ---------------------------------------------------------------------------
# Claim routing (Phase 2 — SQL heuristic, no API)
# ---------------------------------------------------------------------------

def route_claims_for_domain(conn, domain: dict, limit: int = CLAIMS_PER_DOM) -> list:
    """
    Pull the top `limit` high-signal claims for a strategic domain.

    Priority ladder:
      1. Claims whose claims.domain is in domain['primary_claim_domains']
      2. Claims whose claims.domain is in domain['secondary_claim_domains']
      3. technology_capability claims whose text matches domain['tech_keywords']

    Within each tier, rank by claim_weight × freshness_score × credibility.
    Returns list of plain dicts.
    """
    primary   = domain['primary_claim_domains']
    secondary = domain['secondary_claim_domains']
    keywords  = domain['tech_keywords']

    SELECT = """
        SELECT DISTINCT c.id, c.claim_text, c.consumer_implication,
               c.signal_strength, c.specificity, c.domain AS claim_domain,
               t.name AS thinker, t.credibility_score,
               s.title AS source_title, s.date_published
        FROM claims c
        JOIN thinkers t ON c.thinker_id = t.id
        LEFT JOIN sources s ON c.source_id = s.id
        WHERE c.signal_strength IN ('signal','strong_signal')
          AND c.duplicate_of IS NULL
    """
    ORDER = """
        ORDER BY COALESCE(c.claim_weight,0) * COALESCE(c.freshness_score,0.5)
                 * (GREATEST(COALESCE(t.credibility_score,50.0), 30.0) / 100.0) DESC
        LIMIT %s
    """

    # Tier 1: primary domains
    p_ph = ','.join(['%s'] * len(primary))
    tier1 = [dict(r) for r in conn.execute(
        f"{SELECT} AND c.domain IN ({p_ph}) {ORDER}", (*primary, limit)
    ).fetchall()]

    seen = {r['id'] for r in tier1}
    remaining = limit - len(tier1)

    # Tier 2: secondary domains
    tier2 = []
    if remaining > 0 and secondary:
        s_ph = ','.join(['%s'] * len(secondary))
        excl = f"AND c.id NOT IN ({','.join(str(i) for i in seen)})" if seen else ''
        tier2 = [dict(r) for r in conn.execute(
            f"{SELECT} AND c.domain IN ({s_ph}) {excl} {ORDER}", (*secondary, remaining)
        ).fetchall()]
        seen |= {r['id'] for r in tier2}
        remaining -= len(tier2)

    # Tier 3: technology_capability with keyword filter
    tier3 = []
    if remaining > 0 and keywords:
        kw_cond = ' OR '.join(f"LOWER(c.claim_text) LIKE '%{kw}%'" for kw in keywords)
        excl = f"AND c.id NOT IN ({','.join(str(i) for i in seen)})" if seen else ''
        tier3 = [dict(r) for r in conn.execute(
            f"{SELECT} AND c.domain = 'technology_capability' AND ({kw_cond}) {excl} {ORDER}",
            (remaining,)
        ).fetchall()]

    claims = tier1 + tier2 + tier3
    # Ensure thinker diversity: at least 5 distinct voices
    return _diversify(claims, min_thinkers=5, total=limit)


def _diversify(candidates: list, min_thinkers: int = 5, total: int = 100) -> list:
    """Guarantee at least min_thinkers distinct thinkers in the returned list."""
    if not candidates:
        return candidates
    available = {c['thinker'] for c in candidates}
    quota = min(min_thinkers, len(available))
    seeded, seeded_ids, t_seen = [], set(), set()
    for c in candidates:
        if len(t_seen) >= quota:
            break
        if c['thinker'] not in t_seen:
            seeded.append(c); seeded_ids.add(c['id']); t_seen.add(c['thinker'])
    result = seeded[:]
    for c in candidates:
        if len(result) >= total:
            break
        if c['id'] not in seeded_ids:
            result.append(c)
    return result


# ---------------------------------------------------------------------------
# Claude prompts
# ---------------------------------------------------------------------------

def fmt_claims_block(claims: list, max_per: int = None) -> str:
    if max_per:
        claims = claims[:max_per]
    lines = []
    for c in claims:
        cred = f"{c['credibility_score']:.0f}" if c['credibility_score'] else '?'
        text = (c['claim_text'] or '')[:220]
        lines.append(f"[id:{c['id']}] [{c['thinker']}, cred:{cred}] [{c['signal_strength']}] {text}")
        if c.get('consumer_implication'):
            lines.append(f"  → implication: {c['consumer_implication'][:120]}")
    return '\n'.join(lines)


# ── Phase 3: scenario generation per domain ────────────────────────────────

def prompt_domain_scenarios(domain: dict, claims: list) -> str:
    cb = fmt_claims_block(claims, max_per=180)
    return f"""You are synthesising trend intelligence for Serious Shift — a consumer trend platform tracking AGI-driven shifts.

STRATEGIC DOMAIN: {domain['name']}
DOMAIN DESCRIPTION: {domain['description'][:400]}

TASK
From the evidence below, identify 3–4 distinct SCENARIOS for this domain. Each scenario is a coherent narrative frame — a plausible future state specific to {domain['name']} driven by AGI.

RULES FOR SCENARIO NAMES
- 3–6 words, evocative and memorable
- Frame a shift, not a category (NOT "Technology Changes" or "AI Impact")
- Examples of right register: "The Trust Stack", "Machines Do the Deciding", "After the Knowledge Economy"
- Each scenario must be distinct from the others — no overlapping narratives

RULES FOR DESCRIPTIONS
- 2–3 sentences, big-picture frame
- What is changing, for whom, and why it matters now
- {domain['name']}-specific framing — NOT generic AI commentary

RULES FOR HORIZON + PLAUSIBILITY
- horizon: year range e.g. "2026–2029", "2026–2032"
- plausibility: "high" | "medium" | "speculative"

EVIDENCE ({len(claims)} claims from the {domain['name']} domain):
{cb}

Return ONLY valid JSON — no preamble, no markdown fences:
{{
  "scenarios": [
    {{
      "name": "Scenario name here",
      "description": "Two to three sentences. Domain-specific, forward-looking.",
      "horizon": "2026–2029",
      "plausibility": "high"
    }},
    ...
  ]
}}"""


# ── Phase 4: KT generation per scenario ────────────────────────────────────

def prompt_scenario_key_trends(domain: dict, scenario: dict, claims: list) -> str:
    cb = fmt_claims_block(claims, max_per=120)
    return f"""You are synthesising trend intelligence for Serious Shift — a consumer trend platform.

DOMAIN: {domain['name']}
SCENARIO: {scenario['name']}
SCENARIO DESCRIPTION: {scenario['description']}

TASK
Identify 2–4 KEY TRENDS that constitute the evidence base for this scenario. Each Key Trend is a distinct, named signal that together build the case for the scenario above.

RULES FOR KEY TREND NAMES
- 4–9 words, specific and evocative
- Reinier Evers style: punchy, slightly contrarian, consumer/brand-facing
- Begins with or implies an action, shift, or provocation
- Examples: "Your Customer Is Delegating Decisions to AI", "The Knowledge Economy Is Dying", "Authenticity Becomes a Luxury"

RULES FOR SUBTITLES
- 4–8 words — a sharp framing lens for the KT
- Examples: "Trust shifts from brands to agents", "Judgment replaces knowledge"

RULES FOR CLAIM ASSIGNMENT
- Assign each claim_id to the single KT it best supports
- Every claim that clearly fits a KT should be assigned
- Claims that don't fit cleanly may be omitted

Also assign a velocity to the SCENARIO itself:
- "breakout" = explosive growth, tipping point imminent
- "accelerating" = clear momentum, adoption growing fast
- "rising" = real signal, still building
- "steady" = established, not accelerating

EVIDENCE ({len(claims)} claims):
{cb}

Return ONLY valid JSON — no preamble, no markdown fences:
{{
  "scenario_velocity": "accelerating",
  "key_trends": [
    {{
      "name": "Key trend name here",
      "subtitle": "Sharp framing in 4-8 words",
      "claim_ids": [123, 456, 789]
    }},
    ...
  ]
}}"""


# ── Phase 5: Sub-trend clustering per KT ───────────────────────────────────

def prompt_sub_trends(kt_name: str, kt_subtitle: str, claims: list) -> str:
    cb = fmt_claims_block(claims, max_per=90)
    return f"""You are synthesising trend intelligence for Serious Shift — a consumer trend platform tracking AGI-driven shifts.

KEY TREND: {kt_name}
FRAMING: {kt_subtitle}

TASK
Identify 3–5 coherent SUB-TRENDS that emerge from the evidence below. Each sub-trend is a distinct, named micro-pattern that a brand strategist or consumer researcher would recognise as real.

RULES FOR SUB-TREND NAMES
- 4–8 words, specific and evocative (NOT "AI Adoption," "Trust Issues," "Changing Behavior")
- Reinier Evers style: punchy, slightly contrarian, consumer-facing
- Each name should be distinctive enough to stand alone on a slide

RULES FOR DESCRIPTIONS
- 2 sentences maximum
- Consumer-facing, forward-looking
- State what is happening AND what it means for consumers or brands
- No filler phrases; no em dashes — use periods and commas only

RULES FOR CLAIM ASSIGNMENT
- Assign each claim_id to the single sub-trend it best supports
- Every claim that clearly fits should be assigned

Also assign a velocity to the Key Trend itself:
- "breakout" | "accelerating" | "rising" | "steady"

EVIDENCE ({len(claims)} claims):
{cb}

Return ONLY valid JSON — no preamble, no markdown fences:
{{
  "key_trend_velocity": "accelerating",
  "sub_trends": [
    {{
      "name": "Sub-trend name here",
      "description": "One to two sentences. Consumer-facing, punchy.",
      "claim_ids": [123, 456, 789]
    }},
    ...
  ]
}}"""


# ── Phase 6: Thinker attribution ────────────────────────────────────────────

def prompt_thinker_attribution(node_type: str, node_name: str, thinker_groups: dict) -> str:
    lines = []
    for thinker, clms in thinker_groups.items():
        lines.append(f'\n[{thinker}]')
        for c in clms[:8]:
            text = c['claim_text'] if isinstance(c, dict) else c
            lines.append(f'  - {text[:200]}')
    return f"""You are analysing thinker stances for Serious Shift.

NODE TYPE: {node_type}
NODE NAME: {node_name}

TASK
Based on the claims below (grouped by thinker), identify:
- 2–3 PROPONENTS: thinkers whose claims most strongly support or accelerate this {node_type}
- 2–3 SKEPTICS: thinkers whose claims question, complicate, or push back on it

THINKER CLAIMS:
{''.join(lines)}

Return ONLY valid JSON:
{{
  "proponents": ["Name A", "Name B"],
  "skeptics": ["Name C", "Name D"]
}}"""


def parse_thinker_attribution(raw) -> dict:
    result = {'proponents': [], 'skeptics': []}
    if not isinstance(raw, dict):
        return result
    for k in ('proponents', 'skeptics'):
        v = raw.get(k, [])
        if isinstance(v, list):
            result[k] = [str(x) for x in v if x]
    return result


def _collect_by_thinker(claims: list, max_per: int = 8) -> dict:
    grouped = {}
    for c in claims:
        t = c.get('thinker', '')
        if not t:
            continue
        grouped.setdefault(t, [])
        if len(grouped[t]) < max_per:
            grouped[t].append(c)
    return grouped


# ── Phase 7: Interrelatedness ───────────────────────────────────────────────

def prompt_interrelatedness_batch(pairs: list) -> str:
    lines = [
        f"  Pair ({p['id_a']}, {p['id_b']}): [{p['type_a']}] {p['name_a']} | [{p['type_b']}] {p['name_b']}"
        for p in pairs
    ]
    return f"""You are mapping relationships between trend nodes in Serious Shift.

RELATIONSHIP TYPES (pick exactly one per pair):
- "reinforces"       — one makes the other more likely/stronger
- "contradicts"      — the two pull in opposite directions
- "prerequisite_for" — one must happen for the other to occur
- "competes_with"    — compete for same resources/attention/adoption
- "accelerated_by"   — one is sped up by presence of the other
- "none"             — no meaningful relationship

STRENGTH: 0.0–1.0 (omit pairs with strength < 0.4 or relationship = "none")
DIRECTIONALITY: source_id → target_id

PAIRS:
{chr(10).join(lines)}

Return ONLY valid JSON list:
[
  {{
    "source_id": "scn:1",
    "target_id": "scn:3",
    "relationship": "reinforces",
    "strength": 0.8,
    "reasoning": "One sentence."
  }},
  ...
]
(Omit pairs with relationship="none" or strength < 0.4)"""


def parse_interrelatedness_batch(raw) -> list:
    VALID = {'reinforces','contradicts','prerequisite_for','competes_with','accelerated_by'}
    if isinstance(raw, dict):
        for k in ('links','relationships','edges','results','data'):
            if k in raw and isinstance(raw[k], list):
                raw = raw[k]; break
        else:
            raw = []
    if not isinstance(raw, list):
        return []
    result = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            src = item.get('source_id')
            tgt = item.get('target_id')
            rel = item.get('relationship','')
            str_ = float(item.get('strength',0))
            rsn = str(item.get('reasoning',''))
            if src is None or tgt is None or str_ < 0.4 or rel not in VALID:
                continue
            result.append({'source_id': str(src), 'target_id': str(tgt),
                           'relationship': rel, 'strength': str_, 'reasoning': rsn})
        except (TypeError, ValueError):
            continue
    return result


# ── Phase 8: Synthesis insights per domain ──────────────────────────────────

def prompt_synthesis_insights(domain_name: str, domain_desc: str, claims: list) -> str:
    cb = fmt_claims_block(claims, max_per=50)
    return f"""You are the synthesis intelligence layer of Serious Shift.

DOMAIN: {domain_name}
DESCRIPTION: {domain_desc[:300]}

TASK
Generate 3–4 SYNTHESIS INSIGHTS — emergent ideas arising from combining multiple thinkers' claims. These must NOT be directly stated by any single thinker; they emerge from the pattern of evidence.

RULES
- Each insight synthesises at least 2 different thinkers' perspectives
- Name: 4–8 words, evocative, Reinier Evers style
- Description: 2–3 sentences, forward-looking, {domain_name}-specific
- contributing_claim_ids: 3–8 claim IDs that together generate the insight

EVIDENCE:
{cb}

Return ONLY valid JSON:
{{
  "insights": [
    {{
      "name": "Insight name here",
      "description": "Two to three sentences.",
      "contributing_claim_ids": [123, 456, 789]
    }},
    ...
  ]
}}"""


def parse_synthesis_insights(raw) -> list:
    if isinstance(raw, dict):
        raw = raw.get('insights', [])
    if not isinstance(raw, list):
        return []
    result = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get('name','').strip()
        desc = item.get('description','').strip()
        ids  = [int(c) for c in item.get('contributing_claim_ids',[])
                if isinstance(c, (int,float)) and not isinstance(c, bool)]
        if name and desc and ids:
            result.append({'name': name, 'description': desc, 'contributing_claim_ids': ids})
    return result


# ---------------------------------------------------------------------------
# Phase 1 — Domain definitions (hardcoded write to DB)
# ---------------------------------------------------------------------------

def phase1_domain_definitions(conn):
    print('\nPhase 1 — Writing domain definitions to DB…')
    for d in DOMAINS:
        conn.execute("""
            INSERT INTO domains_v2 (id, name, label, short_description, description, sort_order)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name, label = EXCLUDED.label,
              short_description = EXCLUDED.short_description,
              description = EXCLUDED.description, sort_order = EXCLUDED.sort_order
        """, (d['id'], d['name'], d['label'], d['short_description'], d['description'], d['sort_order']))
    for f in DOMAIN_FLOWS_PRESET:
        conn.execute("""
            INSERT INTO domain_flows (source_id, target_id, strength, description)
            VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING
        """, (f['source'], f['target'], f['strength'], f['description']))
    conn.commit()
    print(f'  ✓  {len(DOMAINS)} domains + {len(DOMAIN_FLOWS_PRESET)} domain flows written.')


# ---------------------------------------------------------------------------
# Phase 2 — Claim routing (SQL heuristic, no API)
# ---------------------------------------------------------------------------

def phase2_claim_routing(conn) -> dict:
    """Returns {domain_id: [claim_dict, ...]} for scenario generation."""
    print('\nPhase 2 — Routing claims to domains (SQL heuristic, no API)…')
    domain_claims = {}
    for d in DOMAINS:
        claims = route_claims_for_domain(conn, d, limit=CLAIMS_PER_DOM)
        domain_claims[d['id']] = claims
        thinkers = len({c['thinker'] for c in claims})
        print(f"  {d['name']:<15}  {len(claims):3d} claims  |  {thinkers} thinkers")
    return domain_claims


# ---------------------------------------------------------------------------
# Phase 3 — Scenario generation (4 API calls)
# ---------------------------------------------------------------------------

def phase3_scenarios(conn, api_key: str, domain_claims: dict) -> dict:
    """
    Returns {domain_id: [scenario_dict_with_db_id, ...]}
    Writes to domain_scenarios table.
    """
    print('\nPhase 3 — Generating scenarios per domain (4 calls)…')
    used_slugs: set = set()

    def unique_slug(base):
        s = base; n = 2
        while s in used_slugs:
            s = f'{base}-{n}'; n += 1
        used_slugs.add(s); return s

    domain_scenarios = {}
    api_cost = 0.0

    for d in DOMAINS:
        claims = domain_claims[d['id']]
        print(f'  Generating scenarios for {d["name"]}…', end=' ', flush=True)

        prompt = prompt_domain_scenarios(d, claims)
        raw    = call_claude(prompt, api_key)
        api_cost = check_budget(api_cost, f'Phase3 {d["name"]}')

        try:
            result = extract_json(raw)
        except ValueError as e:
            print(f'\n  ERROR parsing JSON for {d["name"]}: {e}')
            result = {'scenarios': []}

        scenarios = result.get('scenarios', [])
        if not scenarios:
            print(f'WARNING: no scenarios returned for {d["name"]}')
            scenarios = []

        written = []
        for i, scn in enumerate(scenarios, start=1):
            slug = unique_slug(f'scn-{d["id"]}-{slugify(scn["name"])}')
            scn['_db_id'] = conn.execute("""
                INSERT INTO domain_scenarios
                  (slug, domain_id, name, description, horizon, plausibility, sort_order)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (slug, d['id'], scn['name'], scn['description'],
                  scn.get('horizon','2026–2030'), scn.get('plausibility','medium'), i)).fetchone()['id']
            scn['_slug']  = slug
            written.append(scn)

        conn.commit()
        print(f'✓  {len(written)} scenarios')
        domain_scenarios[d['id']] = written
        time.sleep(1)

    return domain_scenarios


# ---------------------------------------------------------------------------
# Phase 4 — KT generation per scenario (N API calls)
# ---------------------------------------------------------------------------

def phase4_key_trends(conn, api_key: str, domain_claims: dict, domain_scenarios: dict) -> dict:
    """
    Returns {scenario_db_id: [kt_dict_with_db_id, ...]}
    Writes to domain_key_trends table.
    """
    print('\nPhase 4 — Generating Key Trends per scenario…')
    used_slugs: set = set()

    def unique_slug(base):
        s = base; n = 2
        while s in used_slugs:
            s = f'{base}-{n}'; n += 1
        used_slugs.add(s); return s

    api_cost = 0.0
    scenario_kts: dict = {}

    for d in DOMAINS:
        scenarios = domain_scenarios.get(d['id'], [])
        claims    = domain_claims[d['id']]  # use domain claim pool for all scenarios

        for scn in scenarios:
            print(f'  {d["name"]} / {scn["name"][:48]}…', end=' ', flush=True)

            prompt = prompt_scenario_key_trends(d, scn, claims[:CLAIMS_PER_SCN])
            raw    = call_claude(prompt, api_key)
            api_cost = check_budget(api_cost, f'Phase4 scn:{scn["_db_id"]}')

            try:
                result = extract_json(raw)
            except ValueError as e:
                print(f'\n  ERROR parsing JSON: {e}')
                result = {'key_trends': []}

            kts = result.get('key_trends', [])
            velocity = result.get('scenario_velocity', 'rising')

            # Store velocity on scenario
            conn.execute('UPDATE domain_scenarios SET plausibility=%s WHERE id=%s',
                         (velocity, scn['_db_id']))

            written = []
            for j, kt in enumerate(kts, start=1):
                slug = unique_slug(f'kt-{slugify(kt["name"])}')
                kt['_db_id'] = conn.execute("""
                    INSERT INTO domain_key_trends
                      (slug, scenario_id, domain_id, name, subtitle, velocity, sort_order)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id
                """, (slug, scn['_db_id'], d['id'],
                      kt['name'], kt.get('subtitle',''), velocity, j)).fetchone()['id']
                kt['_slug']      = slug
                kt['_claim_ids'] = [int(cid) for cid in kt.get('claim_ids', [])
                                    if isinstance(cid, (int, float))]
                # We'll route the raw claim pool to this KT using claimed IDs as hints
                written.append(kt)

            conn.commit()
            scenario_kts[scn['_db_id']] = written
            print(f'✓  {len(written)} KTs')
            time.sleep(0.8)

    return scenario_kts


# ---------------------------------------------------------------------------
# Phase 5 — Sub-trend clustering (M API calls)
# ---------------------------------------------------------------------------

def phase5_sub_trends(conn, api_key: str, domain_claims: dict, domain_scenarios: dict, scenario_kts: dict):
    """Writes to domain_sub_trends + domain_sub_trend_claims."""
    print('\nPhase 5 — Clustering sub-trends per Key Trend…')
    used_slugs: set = set()
    api_cost = 0.0

    def unique_slug(base):
        s = base; n = 2
        while s in used_slugs:
            s = f'{base}-{n}'; n += 1
        used_slugs.add(s); return s

    # Build a fast claim lookup: id → claim_dict
    all_domain_claims: dict = {}
    for d in DOMAINS:
        for c in domain_claims[d['id']]:
            all_domain_claims[c['id']] = c

    for d in DOMAINS:
        scenarios = domain_scenarios.get(d['id'], [])
        full_pool = domain_claims[d['id']]  # fallback pool for this domain

        for scn in scenarios:
            kts = scenario_kts.get(scn['_db_id'], [])
            for kt in kts:
                # Build claim pool for this KT:
                # Prefer the claim_ids Claude assigned, then fill from domain pool
                preferred_ids = set(kt.get('_claim_ids', []))
                preferred     = [all_domain_claims[cid] for cid in preferred_ids
                                 if cid in all_domain_claims]
                # Pad with domain pool up to CLAIMS_PER_KT
                remaining = CLAIMS_PER_KT - len(preferred)
                if remaining > 0:
                    pad = [c for c in full_pool if c['id'] not in preferred_ids]
                    preferred += pad[:remaining]

                if not preferred:
                    print(f'  SKIP {kt["name"][:40]} — no claims')
                    continue

                print(f'  {kt["name"][:55]}…', end=' ', flush=True)

                prompt = prompt_sub_trends(kt['name'], kt.get('subtitle', ''), preferred)
                raw    = call_claude(prompt, api_key)
                api_cost = check_budget(api_cost, f'Phase5 kt:{kt["_db_id"]}')

                try:
                    result = extract_json(raw)
                except ValueError as e:
                    print(f'\n  ERROR: {e}'); result = {'sub_trends': []}

                velocity = result.get('key_trend_velocity', 'rising')
                conn.execute('UPDATE domain_key_trends SET velocity=%s WHERE id=%s',
                             (velocity, kt['_db_id']))

                sub_trends = result.get('sub_trends', [])
                for i, st in enumerate(sub_trends, start=1):
                    slug = unique_slug(f'st-{slugify(st["name"])}')
                    st_db_id = conn.execute("""
                        INSERT INTO domain_sub_trends
                          (slug, kt_id, domain_id, name, description, sort_order)
                        VALUES (%s,%s,%s,%s,%s,%s) RETURNING id
                    """, (slug, kt['_db_id'], d['id'],
                          st['name'], st['description'], i)).fetchone()['id']

                    for cid in st.get('claim_ids', []):
                        try:
                            conn.execute("""
                                INSERT INTO domain_sub_trend_claims
                                  (sub_trend_id, claim_id) VALUES (%s,%s) ON CONFLICT DO NOTHING
                            """, (st_db_id, int(cid)))
                        except Exception:
                            pass

                conn.commit()
                print(f'✓  {len(sub_trends)} sub-trends, vel={velocity}')
                time.sleep(0.8)


# ---------------------------------------------------------------------------
# Phase 6 — Thinker attribution (scenarios + KTs)
# ---------------------------------------------------------------------------

def phase6_thinker_attribution(conn, api_key: str, domain_claims: dict, domain_scenarios: dict, scenario_kts: dict):
    print('\nPhase 6 — Thinker attribution (scenarios + KTs)…')
    api_cost = 0.0

    for d in DOMAINS:
        claims    = domain_claims[d['id']]
        scenarios = domain_scenarios.get(d['id'], [])

        for scn in scenarios:
            # Scenario attribution
            groups = _collect_by_thinker(claims, max_per=8)
            if groups:
                print(f'  scn: {scn["name"][:48]}…', end=' ', flush=True)
                prompt = prompt_thinker_attribution('scenario', scn['name'], groups)
                raw    = call_claude(prompt, api_key)
                api_cost = check_budget(api_cost, f'Phase6 scn:{scn["_db_id"]}')
                try:
                    attr = parse_thinker_attribution(extract_json(raw))
                except Exception:
                    attr = {'proponents': [], 'skeptics': []}
                conn.execute('UPDATE domain_scenarios SET proponents=%s, skeptics=%s WHERE id=%s',
                             (json.dumps(attr['proponents']), json.dumps(attr['skeptics']), scn['_db_id']))
                print(f'✓  {len(attr["proponents"])} pro, {len(attr["skeptics"])} skep')
                time.sleep(0.5)

            # KT attribution
            kts = scenario_kts.get(scn['_db_id'], [])
            for kt in kts:
                # Build kt-specific claim pool from preferred ids
                preferred_ids = set(kt.get('_claim_ids', []))
                kt_claims = [c for c in claims if c['id'] in preferred_ids] or claims[:60]
                groups = _collect_by_thinker(kt_claims, max_per=8)
                if not groups:
                    continue
                print(f'    kt: {kt["name"][:48]}…', end=' ', flush=True)
                prompt = prompt_thinker_attribution('key_trend', kt['name'], groups)
                raw    = call_claude(prompt, api_key)
                api_cost = check_budget(api_cost, f'Phase6 kt:{kt["_db_id"]}')
                try:
                    attr = parse_thinker_attribution(extract_json(raw))
                except Exception:
                    attr = {'proponents': [], 'skeptics': []}
                conn.execute('UPDATE domain_key_trends SET proponents=%s, skeptics=%s WHERE id=%s',
                             (json.dumps(attr['proponents']), json.dumps(attr['skeptics']), kt['_db_id']))
                print(f'✓  {len(attr["proponents"])} pro, {len(attr["skeptics"])} skep')
                time.sleep(0.5)

    conn.commit()


# ---------------------------------------------------------------------------
# Phase 7 — Interrelatedness
# ---------------------------------------------------------------------------

def phase7_interrelatedness(conn, api_key: str, domain_scenarios: dict, scenario_kts: dict):
    print('\nPhase 7 — Interrelatedness (typed edges)…')
    api_cost = 0.0
    b_calls  = 0
    MAX_CALLS = 30

    def _write_links(parsed):
        for lnk in parsed:
            try:
                conn.execute("""
                    INSERT INTO domain_links
                      (source_type, source_id, target_type, target_id, relationship, strength, reasoning)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING
                """, (lnk['source_id'].split(':')[0], lnk['source_id'],
                      lnk['target_id'].split(':')[0], lnk['target_id'],
                      lnk['relationship'], lnk['strength'], lnk['reasoning']))
            except Exception:
                pass
        conn.commit()

    def _run_batch(pairs, label):
        nonlocal b_calls, api_cost
        if b_calls >= MAX_CALLS:
            return []
        print(f'  {label}: {len(pairs)} pairs…', end=' ', flush=True)
        prompt = prompt_interrelatedness_batch(pairs)
        raw    = call_claude(prompt, api_key)
        api_cost = check_budget(api_cost, label)
        b_calls += 1
        try:
            result = parse_interrelatedness_batch(extract_json(raw))
        except Exception as e:
            print(f' WARNING: {e}')
            result = []
        print(f'✓  {len(result)} links')
        time.sleep(0.5)
        return result

    def _batches(items, size=25):
        for i in range(0, len(items), size):
            yield items[i:i+size]

    # Gather all scenario nodes
    scn_nodes = {}
    for d in DOMAINS:
        for scn in domain_scenarios.get(d['id'], []):
            ref = f'scn:{scn["_db_id"]}'
            scn_nodes[ref] = {
                'id': ref, 'name': scn['name'],
                'desc': scn.get('description','')[:120],
                'type': 'scn', 'domain': d['id'],
            }

    # Gather all KT nodes
    kt_nodes = {}
    for d in DOMAINS:
        for scn in domain_scenarios.get(d['id'], []):
            for kt in scenario_kts.get(scn['_db_id'], []):
                ref = f'kt:{kt["_db_id"]}'
                kt_nodes[ref] = {
                    'id': ref, 'name': kt['name'],
                    'desc': kt.get('subtitle','')[:120],
                    'type': 'kt', 'domain': d['id'],
                }

    # -- Scenario–scenario pairs (all) --
    scn_list = list(scn_nodes.values())
    scn_pairs = []
    for i, a in enumerate(scn_list):
        for b in scn_list[i+1:]:
            scn_pairs.append({
                'id_a': a['id'], 'name_a': a['name'], 'desc_a': a['desc'], 'type_a': 'scenario',
                'id_b': b['id'], 'name_b': b['name'], 'desc_b': b['desc'], 'type_b': 'scenario',
            })

    for batch in _batches(scn_pairs, 20):
        links = _run_batch(batch, 'scn-scn')
        _write_links(links)
        if b_calls >= MAX_CALLS:
            break

    # -- KT–KT pairs (capped at 200) --
    kt_list = list(kt_nodes.values())
    kt_pairs = []
    for i, a in enumerate(kt_list):
        for b in kt_list[i+1:]:
            # Only cross-domain pairs (within-domain KTs already share scenario context)
            if a['domain'] != b['domain']:
                kt_pairs.append({
                    'id_a': a['id'], 'name_a': a['name'], 'desc_a': a['desc'], 'type_a': 'key_trend',
                    'id_b': b['id'], 'name_b': b['name'], 'desc_b': b['desc'], 'type_b': 'key_trend',
                })

    random.shuffle(kt_pairs)
    kt_pairs = kt_pairs[:200]
    for batch in _batches(kt_pairs, 25):
        if b_calls >= MAX_CALLS:
            break
        links = _run_batch(batch, 'kt-kt')
        _write_links(links)

    print(f'  Phase 7 complete: {b_calls} calls total.')


# ---------------------------------------------------------------------------
# Phase 8 — Synthesis insights per domain (4 API calls)
# ---------------------------------------------------------------------------

def phase8_synthesis(conn, api_key: str, domain_claims: dict):
    print('\nPhase 8 — Synthesis insights per domain (4 calls)…')
    used_slugs: set = set()
    api_cost = 0.0

    def unique_slug(base):
        s = base; n = 2
        while s in used_slugs:
            s = f'{base}-{n}'; n += 1
        used_slugs.add(s); return s

    for d in DOMAINS:
        claims = domain_claims[d['id']][:50]
        if not claims:
            continue
        print(f'  {d["name"]}…', end=' ', flush=True)

        prompt = prompt_synthesis_insights(d['name'], d['description'], claims)
        raw    = call_claude(prompt, api_key, model=INSIGHTS_MODEL)
        api_cost = check_budget(api_cost, f'Phase8 {d["id"]}', per_call=OPUS_COST_PER_CALL)

        try:
            insights = parse_synthesis_insights(extract_json(raw))
        except Exception as e:
            print(f' WARNING: {e}'); insights = []

        n_written = 0
        for ins in insights:
            slug = unique_slug(f'si-{d["id"]}-{slugify(ins["name"])}')
            row = conn.execute("""
                INSERT INTO domain_synthesis_insights
                  (slug, domain_id, name, description)
                VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id
            """, (slug, d['id'], ins['name'], ins['description'])).fetchone()
            si_id = row['id'] if row else None
            if si_id:
                for cid in ins['contributing_claim_ids']:
                    try:
                        conn.execute("""
                            INSERT INTO domain_synthesis_insight_claims
                              (insight_id, claim_id) VALUES (%s,%s) ON CONFLICT DO NOTHING
                        """, (si_id, cid))
                    except Exception:
                        pass
                n_written += 1

        conn.commit()
        print(f'✓  {n_written} insights')
        time.sleep(0.5)


# ---------------------------------------------------------------------------
# Phase 9 — Export map.json
# ---------------------------------------------------------------------------

def _classify_horizon(h: str) -> str:
    if not h:
        return '3-5 years'
    years = re.findall(r'\d{4}', h.replace('–','-').replace('—','-'))
    if len(years) < 2:
        return '3-5 years'
    span = int(years[1]) - int(years[0])
    if span <= 3:   return '1-3 years'
    elif span <= 5: return '3-5 years'
    else:           return '5-10 years'


def build_map_json_v2(conn) -> dict:
    today = date.today().isoformat()

    # ---- domains ----
    d_rows = conn.execute('SELECT * FROM domains_v2 ORDER BY sort_order').fetchall()
    domains_j = []
    for d in d_rows:
        scn_rows = conn.execute(
            'SELECT id FROM domain_scenarios WHERE domain_id=%s ORDER BY sort_order',
            (d['id'],)
        ).fetchall()
        si_rows = conn.execute(
            'SELECT id FROM domain_synthesis_insights WHERE domain_id=%s ORDER BY id',
            (d['id'],)
        ).fetchall()
        domains_j.append({
            'id':                d['id'],
            'name':              d['name'],
            'label':             d['label'],
            'short_description': d['short_description'],
            'description':       d['description'],
            'scenario_ids':      [r['id'] for r in scn_rows],
            'synthesis_insight_ids': [r['id'] for r in si_rows],
        })

    # ---- scenarios ----
    scn_rows_all = conn.execute("""
        SELECT id, slug, domain_id, name, description, horizon, plausibility,
               sort_order, proponents, skeptics
        FROM domain_scenarios ORDER BY domain_id, sort_order
    """).fetchall()
    scenarios_j = []
    for scn in scn_rows_all:
        kt_rows = conn.execute(
            'SELECT id FROM domain_key_trends WHERE scenario_id=%s ORDER BY sort_order',
            (scn['id'],)
        ).fetchall()
        scenarios_j.append({
            'id':          f'scn-{scn["slug"]}' if not str(scn["slug"]).startswith('scn-') else scn['slug'],
            'db_id':       scn['id'],
            'domain_id':   scn['domain_id'],
            'name':        scn['name'],
            'description': scn['description'],
            'horizon':     scn['horizon'] or '2026–2030',
            'plausibility': scn['plausibility'] or 'medium',
            'key_trend_ids': [f'kt-{r["id"]}' for r in kt_rows],
            'proponents':  json.loads(scn['proponents']) if scn['proponents'] else [],
            'skeptics':    json.loads(scn['skeptics'])   if scn['skeptics']   else [],
        })

    # ---- key_trends ----
    kt_rows_all = conn.execute("""
        SELECT kt.id, kt.slug, kt.scenario_id, kt.domain_id,
               kt.name, kt.subtitle, kt.velocity, kt.sort_order,
               kt.proponents, kt.skeptics
        FROM domain_key_trends kt
        ORDER BY kt.domain_id, kt.sort_order
    """).fetchall()
    key_trends_j = []
    for kt in kt_rows_all:
        st_rows = conn.execute(
            'SELECT id FROM domain_sub_trends WHERE kt_id=%s ORDER BY sort_order',
            (kt['id'],)
        ).fetchall()
        key_trends_j.append({
            'id':          f'kt-{kt["id"]}',
            'db_id':       kt['id'],
            'scenario_id': f'scn-{kt["scenario_id"]}',
            'domain_id':   kt['domain_id'],
            'name':        kt['name'],
            'description': kt['subtitle'],
            'velocity':    kt['velocity'] or 'rising',
            'sub_trend_ids': [f'st-{r["id"]}' for r in st_rows],
            'proponents':  json.loads(kt['proponents']) if kt['proponents'] else [],
            'skeptics':    json.loads(kt['skeptics'])   if kt['skeptics']   else [],
        })

    # ---- sub_trends ----
    st_rows_all = conn.execute("""
        SELECT st.id, st.slug, st.kt_id, st.domain_id, st.name, st.description
        FROM domain_sub_trends st
        ORDER BY st.kt_id, st.sort_order
    """).fetchall()
    sub_trends_j = []
    for st in st_rows_all:
        c_rows = conn.execute(
            'SELECT claim_id FROM domain_sub_trend_claims WHERE sub_trend_id=%s',
            (st['id'],)
        ).fetchall()
        sub_trends_j.append({
            'id':          f'st-{st["id"]}',
            'db_id':       st['id'],
            'key_trend_id': f'kt-{st["kt_id"]}',
            'domain_id':   st['domain_id'],
            'name':        st['name'],
            'description': st['description'],
            'claim_ids':   [f'c_{r["claim_id"]}' for r in c_rows],
        })

    # ---- claims ----
    all_cids: set = set()
    for st in sub_trends_j:
        for cid_str in st['claim_ids']:
            try:
                all_cids.add(int(cid_str.replace('c_', '')))
            except ValueError:
                pass
    # Also add synthesis insight claims
    for row in conn.execute('SELECT DISTINCT claim_id FROM domain_synthesis_insight_claims').fetchall():
        all_cids.add(row['claim_id'])

    claims_j = []
    if all_cids:
        rows = conn.execute("""
            SELECT c.id, c.claim_text, c.consumer_implication, c.signal_strength,
                   t.name AS thinker, t.credibility_score,
                   s.title AS source_title, s.date_published
            FROM claims c
            JOIN thinkers t ON c.thinker_id = t.id
            LEFT JOIN sources s ON c.source_id = s.id
            WHERE c.id = ANY(%s)
        """, (list(all_cids),)).fetchall()
        for r in rows:
            claims_j.append({
                'id':                f'c_{r["id"]}',
                'text':              r['claim_text'] or '',
                'thinker':           r['thinker'] or '',
                'thinker_credibility': round(r['credibility_score'] or 50.0, 1),
                'source_title':      r['source_title'] or '',
                'source_date':       r['date_published'] or '',
                'signal_strength':   r['signal_strength'] or '',
                'consumer_implication': r['consumer_implication'] or '',
            })

    # ---- thinkers ----
    thinkers_j = [
        {
            'name': r['name'],
            'credibility_score': round(r['credibility_score'] or 50.0, 1),
            'prediction_accuracy': round(r['prediction_accuracy'] or 0.0, 3) if r['prediction_accuracy'] else None,
            'image_url': r['image_url'],
            'bio': r['bio'],
        }
        for r in conn.execute(
            'SELECT name, credibility_score, prediction_accuracy, image_url, bio '
            'FROM thinkers ORDER BY credibility_score DESC NULLS LAST'
        ).fetchall()
    ]

    # ---- synthesis insights ----
    si_rows = conn.execute("""
        SELECT si.id, si.slug, si.domain_id, si.name, si.description
        FROM domain_synthesis_insights si ORDER BY si.domain_id, si.id
    """).fetchall()
    insights_j = []
    for si in si_rows:
        cids = [r['claim_id'] for r in conn.execute(
            'SELECT claim_id FROM domain_synthesis_insight_claims WHERE insight_id=%s', (si['id'],)
        ).fetchall()]
        insights_j.append({
            'id':          si['id'],
            'name':        si['name'],
            'description': si['description'],
            'domain_id':   si['domain_id'],
            'contributing_claim_ids': cids,
            'ai_generated': True,
        })

    # ---- links ----
    link_rows = conn.execute("""
        SELECT source_type, source_id, target_type, target_id,
               relationship, strength, reasoning
        FROM domain_links ORDER BY strength DESC
    """).fetchall()
    links_j = [
        {
            'source_type': r['source_type'],
            'source_id':   r['source_id'],
            'target_type': r['target_type'],
            'target_id':   r['target_id'],
            'relationship': r['relationship'],
            'strength':    round(r['strength'], 3),
            'reasoning':   r['reasoning'] or '',
        }
        for r in link_rows
    ]

    # ---- domain_flows ----
    flow_rows = conn.execute('SELECT * FROM domain_flows ORDER BY id').fetchall()
    flows_j = [
        {
            'source': r['source_id'], 'target': r['target_id'],
            'strength': r['strength'], 'description': r['description'] or '',
        }
        for r in flow_rows
    ]

    # ---- index: by_thinker ----
    claim_to_thinker = {c['id'].replace('c_',''): c['thinker'] for c in claims_j}
    by_thinker: dict = {}
    def _add_t(t, etype, eid, ename):
        by_thinker.setdefault(t, [])
        for e in by_thinker[t]:
            if e['type'] == etype and e['id'] == eid:
                return
        by_thinker[t].append({'type': etype, 'id': eid, 'name': ename})

    for st in sub_trends_j:
        for cid_str in st['claim_ids']:
            t = claim_to_thinker.get(cid_str.replace('c_',''), '')
            if t: _add_t(t, 'sub_trend', st['id'], st['name'])
    for kt in key_trends_j:
        for t in kt['proponents'] + kt['skeptics']:
            _add_t(t, 'key_trend', kt['id'], kt['name'])
    for scn in scenarios_j:
        for t in scn['proponents'] + scn['skeptics']:
            _add_t(t, 'scenario', scn['id'], scn['name'])

    # ---- index: by_velocity ----
    by_velocity: dict = {}
    for kt in key_trends_j:
        v = kt.get('velocity', 'rising')
        by_velocity.setdefault(v, [])
        by_velocity[v].append(kt['id'])

    # ---- index: by_horizon ----
    by_horizon: dict = {'1-3 years': [], '3-5 years': [], '5-10 years': []}
    for scn in scenarios_j:
        bucket = _classify_horizon(scn.get('horizon',''))
        by_horizon[bucket].append(scn['id'])

    return {
        'updated':             today,
        'architecture':        'domain-first-v2',
        'domains':             domains_j,
        'scenarios':           scenarios_j,
        'key_trends':          key_trends_j,
        'sub_trends':          sub_trends_j,
        'claims':              claims_j,
        'thinkers':            thinkers_j,
        'synthesis_insights':  insights_j,
        'links':               links_j,
        'domain_flows':        flows_j,
        'by_thinker':          by_thinker,
        'by_velocity':         by_velocity,
        'by_horizon':          by_horizon,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _write_map_document(conn, out):
    """Store the assembled map as documents['map'] — served by the backend at /api/map."""
    conn.execute("""INSERT INTO documents (key, body) VALUES ('map', %s::jsonb)
        ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = now()""",
        (json.dumps(out),))
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run',     action='store_true', help='Print claim counts only')
    parser.add_argument('--phase1',      action='store_true', help='DB setup + domain insert only (no API)')
    parser.add_argument('--export-only', action='store_true', help='Re-export from existing v2 data')
    args = parser.parse_args()

    conn = get_conn()

    # ── Export-only ──────────────────────────────────────────────────────────
    if args.export_only:
        print('--export-only: reading existing v2 data…')
        out = build_map_json_v2(conn)
        _write_map_document(conn, out)
        print("✓  map written → documents['map']")
        print(f'   {len(out["domains"])} domains · {len(out["scenarios"])} scenarios · '
              f'{len(out["key_trends"])} KTs · {len(out["sub_trends"])} sub-trends · '
              f'{len(out["links"])} links')
        conn.close(); return

    # ── Always reset v2 tables ───────────────────────────────────────────────
    reset_v2_tables(conn)

    # ── Phase 1 (free) ───────────────────────────────────────────────────────
    phase1_domain_definitions(conn)

    if args.dry_run or args.phase1:
        # Show claim counts per domain
        print('\nPhase 2 preview — claim counts per domain (dry run):')
        for d in DOMAINS:
            claims = route_claims_for_domain(conn, d, limit=CLAIMS_PER_DOM)
            thinkers = len({c['thinker'] for c in claims})
            print(f'  {d["name"]:<15}  {len(claims):3d} claims  |  {thinkers} thinkers')
        if args.phase1:
            print('\n--phase1: stopping after DB setup. Run without --phase1 to continue.')
        else:
            print('\n--dry-run: stopping. No API calls made.')
        conn.close(); return

    # ── Need API key for paid phases ─────────────────────────────────────────
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        print('ERROR: ANTHROPIC_API_KEY not set.')
        sys.exit(1)

    # ── Phase 2: claim routing (free, SQL) ───────────────────────────────────
    domain_claims = phase2_claim_routing(conn)

    # TODO(v2 coherence cookbook): insert the "coherence curation layer" here, between
    # claim routing and content generation. This is a planning-and-curation pass that
    # first drafts the full skeleton of ALL scenarios / KTs / sub-trends across every
    # domain, then evaluates the whole set holistically for coherence, diversification,
    # and deliberate edge — pruning, merging, and re-balancing the skeleton — BEFORE
    # Phases 3–5 generate full content against the approved plan. Use INSIGHTS_MODEL
    # (Opus 4.7) for this layer's holistic reasoning.

    # ── Phase 3: scenario generation ─────────────────────────────────────────
    domain_scenarios = phase3_scenarios(conn, api_key, domain_claims)

    # ── Phase 4: KT generation ───────────────────────────────────────────────
    scenario_kts = phase4_key_trends(conn, api_key, domain_claims, domain_scenarios)

    # ── Phase 5: sub-trend clustering ────────────────────────────────────────
    phase5_sub_trends(conn, api_key, domain_claims, domain_scenarios, scenario_kts)

    # ── Phase 6: thinker attribution ─────────────────────────────────────────
    phase6_thinker_attribution(conn, api_key, domain_claims, domain_scenarios, scenario_kts)

    # ── Phase 7: interrelatedness ─────────────────────────────────────────────
    phase7_interrelatedness(conn, api_key, domain_scenarios, scenario_kts)

    # ── Phase 8: synthesis insights ───────────────────────────────────────────
    phase8_synthesis(conn, api_key, domain_claims)

    # ── Phase 9: export ───────────────────────────────────────────────────────
    print('\nPhase 9 — Exporting map…')
    out = build_map_json_v2(conn)
    _write_map_document(conn, out)
    conn.close()

    print("\n✓  map → documents['map']")
    print(f'   {len(out["domains"])} domains · {len(out["scenarios"])} scenarios · '
          f'{len(out["key_trends"])} KTs · {len(out["sub_trends"])} sub-trends')
    print(f'   {len(out["claims"])} claims · {len(out["synthesis_insights"])} insights · '
          f'{len(out["links"])} links')
    print('\nDone.')


if __name__ == '__main__':
    main()
