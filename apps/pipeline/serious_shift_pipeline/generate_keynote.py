#!/usr/bin/env python3
"""
Data-driven keynote generation (Postgres).

Converted from generate_keynote_v2.py:
  * sqlite3 + `?`            → db.connect() + `%s`
  * dynamic `IN (?,?,…)`     → `= ANY(%s)`
  * SQLite `MAX(a,b)`        → Postgres `GREATEST(a,b)`
  * `LIKE`                   → `ILIKE` (SQLite LIKE is case-insensitive by default)
  * urllib + CERT_NONE       → Anthropic SDK (llm.call_claude)
  * writes the result to the `documents` table (key='keynote'), which the
    backend serves at /api/keynote, instead of a static keynote.json file.

The per-section evidence selection, soft-penalty dedup, and prompt are unchanged.
"""
import argparse
import json
import os

from . import db, llm

KEYNOTE_MODEL = "claude-sonnet-4-6"

SECTION_CONFIG = [
    {"number": 1, "title": "Your Customer Is Delegating Decisions to AI", "subtitle": "Trust shifts from brands to agents",
     "domains": ["consumer_behavior"], "concept_names": ["The Consumer Trust Shift", "AI Agents as Senior Employees"],
     "keywords": ["trust", "delegat", "agent", "purchase", "decision", "recommend", "800 million"]},
    {"number": 2, "title": "Hyper-Personalization Becomes the Baseline", "subtitle": "Memory changes everything",
     "domains": ["consumer_behavior", "technology_capability"], "concept_names": ["AI Companionship and Emotional Labor"],
     "keywords": ["personal", "memory", "individual", "custom", "tailor", "infinite memory"]},
    {"number": 3, "title": "The Knowledge Economy Is Dying", "subtitle": "Judgment replaces knowledge",
     "domains": ["labor"], "concept_names": ["White-Collar Displacement Inversion", "Centaur and Cyborg Collaboration"],
     "keywords": ["knowledge", "team", "individual", "worker", "job", "employ", "displac", "exposure"]},
    {"number": 4, "title": "Agent-to-Agent Commerce Is Coming", "subtitle": "Bots buying from bots",
     "domains": ["consumer_behavior", "technology_capability"], "concept_names": ["AI Agents as Senior Employees"],
     "keywords": ["agent", "crawl", "bot", "traffic", "commerce", "api", "agentic web"]},
    {"number": 5, "title": "Trust Replaces Loyalty", "subtitle": "Brands compete for AI recommendations",
     "domains": ["consumer_behavior"], "concept_names": ["The Consumer Trust Shift", "Open Source vs Closed AI"],
     "keywords": ["trust", "loyal", "brand", "ad", "subscri", "super bowl"]},
    {"number": 6, "title": "Authenticity Becomes a Luxury", "subtitle": "Human-made as premium tier",
     "domains": ["consumer_behavior", "existential_risk"], "concept_names": ["AI Companionship and Emotional Labor"],
     "keywords": ["conscious", "companion", "emotion", "human", "authentic", "luxury", "scai", "psychosis"]},
    {"number": 7, "title": "The K-Shaped Economy Accelerates", "subtitle": "Two economies forming",
     "domains": ["economy", "labor"], "concept_names": ["The Exponential Gap", "Industrial Policy for the Intelligence Age"],
     "keywords": ["inequal", "wealth", "profit", "unemploy", "k-shaped", "wage", "capital"]},
    {"number": 8, "title": "AI Cures Diseases Faster Than It Replaces Jobs", "subtitle": "Science moves first",
     "domains": ["technology_capability"], "concept_names": ["AGI as Science Accelerant"],
     "keywords": ["drug", "disease", "health", "protein", "alphafold", "pharma", "cure", "nobel"]},
    {"number": 9, "title": "Speed Expectations Reset Permanently", "subtitle": "Institutions built for scarcity",
     "domains": ["economy", "enterprise"], "concept_names": ["Mass Intelligence and Institutional Redesign", "The Exponential Gap"],
     "keywords": ["institution", "speed", "scarce", "intelligen", "energy", "grid", "bottleneck"]},
    {"number": 10, "title": "Identity After Work", "subtitle": "The psychological question nobody asks",
     "domains": ["labor", "consumer_behavior"], "concept_names": ["AI Companionship and Emotional Labor"],
     "keywords": ["identity", "meaning", "purpose", "work", "psycholog", "nobody knows"]},
]


def _claim_penalty_case(usage_count: dict, id_col: str = "c.id") -> str:
    """1/(count+1) penalty CASE for claims selected by earlier sections."""
    cases = [f"WHEN {int(cid)} THEN {round(1.0 / (cnt + 1), 8)}"
             for cid, cnt in usage_count.items() if 0 < cnt < 3]
    return f"CASE {id_col} {' '.join(cases)} ELSE 1.0 END" if cases else "1.0"


def query_section_evidence(conn, cfg, claim_usage_count=None, pred_usage_count=None):
    claim_usage_count = claim_usage_count or {}
    pred_usage_count = pred_usage_count or {}

    hard_excl_claim_ids = [cid for cid, cnt in claim_usage_count.items() if cnt >= 3]
    hard_excl_pred_ids = [pid for pid, cnt in pred_usage_count.items() if cnt >= 3]
    claim_penalty = _claim_penalty_case(claim_usage_count)

    concept_ids = []
    for cname in cfg.get("concept_names", []):
        r = db.query_one(conn, "SELECT id FROM concepts WHERE name = %s", (cname,))
        if r:
            concept_ids.append(r["id"])

    # ── Primary claims (via concepts) ────────────────────────────────────────
    primary = []
    if concept_ids:
        hard_excl_clause = (f"AND c.id NOT IN ({','.join(str(x) for x in hard_excl_claim_ids)})"
                            if hard_excl_claim_ids else "")
        primary = db.query(conn, f"""
            SELECT DISTINCT c.id, c.claim_text, c.consumer_implication, c.signal_strength,
                   c.specificity, t.name AS thinker, t.credibility_score,
                   s.title AS source_title, s.date_published
            FROM claims c
            JOIN thinkers t ON c.thinker_id = t.id
            LEFT JOIN sources s ON c.source_id = s.id
            JOIN claim_concepts cc ON c.id = cc.claim_id
            WHERE cc.concept_id = ANY(%s)
            AND c.signal_strength IN ('signal', 'strong_signal')
            AND c.duplicate_of IS NULL
            {hard_excl_clause}
            ORDER BY COALESCE(c.claim_weight,0) * COALESCE(c.freshness_score,0.5)
                     * (GREATEST(COALESCE(t.credibility_score,50.0), 30.0) / 100.0)
                     * ({claim_penalty}) DESC
            LIMIT 15
        """, (concept_ids,))

    # ── Domain claims (keyword-restricted supplement) ─────────────────────────
    primary_ids = [r["id"] for r in primary]
    domain_excl_ids = list(set(primary_ids) | set(hard_excl_claim_ids))
    keywords = cfg.get("keywords", [])
    keyword_cond = " OR ".join([f"c.claim_text ILIKE '%{kw}%'" for kw in keywords])
    domain_filter = "c.domain = ANY(%s)"
    if keyword_cond:
        domain_filter = f"(c.domain = ANY(%s) AND ({keyword_cond}))"
    domain_excl_clause = (f"AND c.id NOT IN ({','.join(str(x) for x in domain_excl_ids)})"
                          if domain_excl_ids else "")
    domain_claims = db.query(conn, f"""
        SELECT DISTINCT c.id, c.claim_text, c.consumer_implication, c.signal_strength,
               c.specificity, t.name AS thinker, t.credibility_score,
               s.title AS source_title, s.date_published
        FROM claims c
        JOIN thinkers t ON c.thinker_id = t.id
        LEFT JOIN sources s ON c.source_id = s.id
        WHERE {domain_filter}
        AND c.signal_strength IN ('signal', 'strong_signal')
        AND c.duplicate_of IS NULL
        {domain_excl_clause}
        ORDER BY COALESCE(c.claim_weight,0) * COALESCE(c.freshness_score,0.5)
                 * (GREATEST(COALESCE(t.credibility_score,50.0), 30.0) / 100.0)
                 * ({claim_penalty}) DESC
        LIMIT 10
    """, (cfg["domains"],))

    # ── Predictions ───────────────────────────────────────────────────────────
    hard_excl_pred_clause = (f"AND p.prediction_id NOT IN ({','.join(repr(x) for x in hard_excl_pred_ids)})"
                             if hard_excl_pred_ids else "")
    raw_preds = db.query(conn, f"""
        SELECT p.prediction_id, p.claim_text, p.status, p.consensus_alignment,
               t.name AS thinker, t.credibility_score
        FROM predictions p
        JOIN thinkers t ON p.thinker_id = t.id
        WHERE p.domain = ANY(%s)
        {hard_excl_pred_clause}
        LIMIT 24
    """, (cfg["domains"],))

    def _pred_score(p: dict) -> float:
        penalty = 1.0 / (pred_usage_count.get(p["prediction_id"], 0) + 1)
        evaluated = 1.0 if p["status"] != "pending" else 0.0
        contrarian = 1.0 - (p["consensus_alignment"] or 0.5)
        return (evaluated + contrarian * 0.1) * penalty

    predictions = sorted(raw_preds, key=_pred_score, reverse=True)[:8]

    # ── Tensions ──────────────────────────────────────────────────────────────
    tension_kw = " OR ".join([f"t.name ILIKE '%{kw}%'" for kw in cfg.get("keywords", [])[:3]])
    tensions = db.query(conn, f"""
        SELECT t.name, t.side_a, t.side_b, t.consumer_implications
        FROM tensions t WHERE {tension_kw or '1=0'} LIMIT 3
    """)

    return {"primary": primary, "domain": domain_claims,
            "predictions": predictions, "tensions": tensions}


def format_evidence(evidence):
    lines = ["STRONGEST EVIDENCE:"]
    for c in evidence["primary"][:10]:
        lines.append(f"  [{c['thinker']}, cred:{c['credibility_score']:.0f}] (spec:{c['specificity']}) {c['claim_text'][:200]}")
        if c.get("consumer_implication"):
            lines.append(f"    Consumer: {c['consumer_implication'][:150]}")
    lines.append("\nADDITIONAL EVIDENCE:")
    for c in evidence["domain"][:8]:
        lines.append(f"  [{c['thinker']}, cred:{c['credibility_score']:.0f}] {c['claim_text'][:200]}")
    if evidence["predictions"]:
        lines.append("\nPREDICTIONS:")
        for p in evidence["predictions"]:
            lines.append(f"  [{p['prediction_id']}] {p['thinker']} ({p['status']}): {p['claim_text'][:150]} [consensus: {p['consensus_alignment']:.2f}]")
    if evidence["tensions"]:
        lines.append("\nTENSIONS:")
        for t in evidence["tensions"]:
            lines.append(f"  {t['name']}: {t['side_a']} vs {t['side_b']}")
    return "\n".join(lines)


def generate_section_with_api(cfg, evidence):
    prompt = f"""Write one section of the Serious Shift keynote about consumer trends driven by AGI.

SECTION: {cfg['title']}
SUBTITLE: {cfg['subtitle']}

EVIDENCE FROM DATABASE:
{format_evidence(evidence)}

STRICT RULES:
- 200-300 words MAXIMUM. Not 400. Not 500. Short, punchy, scannable.
- 3-5 short paragraphs. No paragraph longer than 4 sentences.
- Lead with the most striking fact or number from the evidence.
- Cite thinkers in parentheses with last name only: (Mollick), (Altman). NO scores. NO numbers after names.
- No em dashes. Use periods. Use commas. No em dashes anywhere.
- No filler: no "it's worth noting," "significantly," "the implications are clear." Just say it.
- End the section body with one actionable sentence for the reader.
- Every fact MUST come from the evidence above. Do not invent anything.
- After the body, add this EXACT line on its own paragraph:
  Key thinkers: [list every thinker you cited, each with their credibility score from the evidence, separated by middots]
  Example: Key thinkers: Ethan Mollick (53.9) · Sam Altman (52.8) · Demis Hassabis (53.2)

Return ONLY the section body text followed by the Key thinkers line. No title. No preamble. No commentary."""
    text, _ = llm.call_claude(prompt, model=KEYNOTE_MODEL, max_tokens=1024)
    return text


def generate_section_fallback(cfg, evidence):
    parts = []
    if evidence["primary"]:
        top = evidence["primary"][0]
        parts.append(f"{top['claim_text'][:200]} ({top['thinker']}, {top['credibility_score']:.1f}).")
    for c in evidence["primary"][1:4]:
        parts.append(f"{c['claim_text'][:150]} ({c['thinker']}, {c['credibility_score']:.1f}).")
    if evidence["predictions"]:
        p = evidence["predictions"][0]
        parts.append(f"Prediction: {p['claim_text'][:150]} [{p['status']}] ({p['thinker']}).")
    return "\n\n".join(parts)


INTRO = ("Ten thinkers. 209 sources. 1,734 claims. 69 tracked predictions. Every claim "
         "weighted by the thinker's track record. Not opinions. Scored intelligence.\n\n"
         "We track what they said, when they said it, and whether they were right. The ones "
         "who got it wrong drop in the rankings. The ones who got it right rise. This is "
         "accountability applied to prediction.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Show evidence without generating")
    args = parser.parse_args()

    use_api = bool(os.environ.get("ANTHROPIC_API_KEY"))
    print("=" * 60)
    print("KEYNOTE GENERATION — DATA-DRIVEN")
    print("=" * 60)

    sections = []
    claim_usage_count: dict = {}
    pred_usage_count: dict = {}

    with db.connect() as conn:
        for cfg in SECTION_CONFIG:
            print(f"\nSection {cfg['number']}: {cfg['title']}")
            evidence = query_section_evidence(conn, cfg, claim_usage_count, pred_usage_count)
            for r in evidence["primary"] + evidence["domain"]:
                claim_usage_count[r["id"]] = claim_usage_count.get(r["id"], 0) + 1
            for r in evidence["predictions"]:
                pred_usage_count[r["prediction_id"]] = pred_usage_count.get(r["prediction_id"], 0) + 1
            print(f"  Evidence: {len(evidence['primary'])} primary, {len(evidence['domain'])} domain, "
                  f"{len(evidence['predictions'])} predictions")

            if args.dry_run:
                print(format_evidence(evidence)[:500])
                continue

            if use_api:
                try:
                    body = generate_section_with_api(cfg, evidence)
                    print(f"  Generated via API ({len(body)} chars)")
                except Exception as e:  # noqa: BLE001 — degrade to fallback on API failure
                    print(f"  API failed: {e}. Using fallback.")
                    body = generate_section_fallback(cfg, evidence)
            else:
                body = generate_section_fallback(cfg, evidence)
                print(f"  Generated via fallback ({len(body)} chars)")

            sections.append({
                "number": str(cfg["number"]),
                "title": f"{cfg['number']}. {cfg['title']}",
                "body": body,
                "claims_used": len(evidence["primary"]) + len(evidence["domain"]),
                "predictions_referenced": len(evidence["predictions"]),
            })

        if not args.dry_run:
            output = {"intro": INTRO, "sections": sections}
            db.execute(conn, """INSERT INTO documents (key, body) VALUES ('keynote', %s::jsonb)
                ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = now()""",
                (json.dumps(output),))
            print(f"\nKeynote written to documents['keynote'] ({len(sections)} sections)")


if __name__ == "__main__":
    main()
