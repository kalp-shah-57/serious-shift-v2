import { createContext, useContext, useMemo } from 'react'
import { sanitiseList } from '../../utils/text'

export const MapDataContext = createContext(null)

/** Convert a thinker name to a URL-safe slug. e.g. "Sam Altman" → "sam-altman" */
export const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Reverse-lookup: find thinker object by slug. */
export const findThinkerBySlug = (thinkers, slug) =>
  thinkers.find(t => slugify(t.name) === slug) || null

/**
 * useMapLookup — returns the raw collections plus fast lookup maps built once
 * from context data.
 *
 * Supports both schema versions:
 *
 * V1 (macro-first):
 *   map.json has `macros`, `key_trends`, `sub_trends`, `claims`
 *   `domains` is an object index {society: {...}, economy: {...}}
 *
 * V2 (domain-first, architecture: "domain-first-v2"):
 *   map.json has `domains` (array), `scenarios`, `key_trends`, `sub_trends`, `claims`
 *   + `domain_flows` top-level key
 *
 * LEGACY lookups (v1 drill-down):
 *   macroMap[id]           → macro
 *   keyMap[id]             → key trend
 *   subMap[id]             → sub trend
 *   claimMap[id]           → claim
 *   keysByMacro[id]        → [keyTrends]
 *   subsByKey[id]          → [subTrends]
 *   claimsBySub[id]        → [claims]
 *   subNumber(sub)         → padded "N01" number within its key trend
 *   macroNumber(macro)     → padded "01" number within macros
 *   macroByDbId[n]         → macro by integer DB id
 *   ktByDbId[n]            → key_trend by integer db_id
 *   stByDbId[n]            → sub_trend by integer DB id
 *   linksByStDbId[n]       → [links] for sub_trend with db_id n (v1)
 *   insightsByMacroDbId[n] → [synthesis_insights] for macro with DB id n
 *
 * V2 lookups:
 *   isV2                   → boolean — true when architecture === 'domain-first-v2'
 *   domainsArr             → domain[] (always array regardless of schema)
 *   domainMap[id]          → domain object
 *   scenarios              → scenario[]
 *   scenarioMap[id]        → scenario
 *   scenariosByDomain[did] → [scenarios]
 *   ktsByScenario[sid]     → [key_trends]
 *   ktsByDomain[did]       → [key_trends]
 *   linksByStId[stId]      → [links] for sub_trend with string id like "st-123"
 *   insightsByDomain[did]  → [synthesis_insights] for domain
 *
 * SHARED:
 *   thinkers, synthesis_insights, links, domain_flows
 *   by_thinker, by_velocity, by_horizon
 */
export function useMapLookup() {
  const ctx = useContext(MapDataContext)
  if (!ctx) throw new Error('useMapLookup must be used inside <MapDataContext.Provider>')

  return useMemo(() => {
    const isV2 = ctx.architecture === 'domain-first-v2'

    // Core arrays — present in both schema versions.
    // Strings on every entity are passed through stripAgi at this boundary so
    // visible UI text never says "AGI". `source_title` is preserved as the
    // verbatim published citation (see src/utils/text.js).
    const macros             = sanitiseList(ctx.macros             || [])
    const scenarios          = sanitiseList(ctx.scenarios          || [])
    const key_trends         = sanitiseList(ctx.key_trends         || [])
    const sub_trends         = sanitiseList(ctx.sub_trends         || [])
    const claims             = sanitiseList(ctx.claims             || [])
    const thinkers           = sanitiseList(ctx.thinkers           || [])
    const synthesis_insights = sanitiseList(ctx.synthesis_insights || [])
    const links              = sanitiseList(ctx.links              || [])

    // ---- legacy (v1) lookups ----
    const macroMap = Object.fromEntries(macros.map(m => [m.id, m]))
    const keyMap   = Object.fromEntries(key_trends.map(k => [k.id, k]))
    const subMap   = Object.fromEntries(sub_trends.map(s => [s.id, s]))
    const claimMap = Object.fromEntries(claims.map(c => [c.id, c]))

    const keysByMacro = Object.fromEntries(
      macros.map(m => [
        m.id,
        (m.key_trend_ids || []).map(id => keyMap[id]).filter(Boolean),
      ]),
    )
    const subsByKey = Object.fromEntries(
      key_trends.map(k => [
        k.id,
        (k.sub_trend_ids || []).map(id => subMap[id]).filter(Boolean),
      ]),
    )
    const claimsBySub = Object.fromEntries(
      sub_trends.map(s => [
        s.id,
        (s.claim_ids || []).map(id => claimMap[id]).filter(Boolean),
      ]),
    )

    const macroIndex = Object.fromEntries(macros.map((m, i) => [m.id, i + 1]))
    const subIndexWithinKey = {}
    key_trends.forEach(k => {
      ;(k.sub_trend_ids || []).forEach((sid, i) => {
        subIndexWithinKey[sid] = i + 1
      })
    })
    const macroNumber = m => String(macroIndex[m.id] ?? 0).padStart(2, '0')
    const subNumber   = s => 'N' + String(subIndexWithinKey[s.id] ?? 0).padStart(2, '0')

    // ---- phase-B (v1) db_id lookups ----
    const macroByDbId = Object.fromEntries(
      macros.filter(m => m.db_id != null).map(m => [m.db_id, m])
    )
    const ktByDbId = Object.fromEntries(
      key_trends.filter(k => k.db_id != null).map(k => [k.db_id, k])
    )
    const stByDbId = Object.fromEntries(
      sub_trends.filter(s => s.db_id != null).map(s => [s.db_id, s])
    )

    // Links indexed by sub_trend identifier — works for both integer (v1) and
    // string (v2 "st-123") source_id / target_id values.
    const linksByStDbId = {}  // v1: keyed by integer db_id
    const linksByStId   = {}  // v2: keyed by string id e.g. "st-123"
    for (const link of links) {
      if (link.source_type === 'sub_trend') {
        const k = link.source_id
        ;(linksByStDbId[k] = linksByStDbId[k] || []).push(link)
        ;(linksByStId[k]   = linksByStId[k]   || []).push(link)
      }
      if (link.target_type === 'sub_trend') {
        const k = link.target_id
        ;(linksByStDbId[k] = linksByStDbId[k] || []).push(link)
        ;(linksByStId[k]   = linksByStId[k]   || []).push(link)
      }
    }

    // v1 insights indexed by macro DB id
    const insightsByMacroDbId = {}
    for (const ins of synthesis_insights) {
      if (ins.macro_id == null) continue
      ;(insightsByMacroDbId[ins.macro_id] = insightsByMacroDbId[ins.macro_id] || []).push(ins)
    }

    // ---- v2 domain lookups ----
    // domains may be an array (v2) or an object index (v1 partial)
    const domainsArr = sanitiseList(
      Array.isArray(ctx.domains)
        ? ctx.domains
        : Object.values(ctx.domains || {})
    )
    const domainMap = Object.fromEntries(domainsArr.map(d => [d.id, d]))

    const scenarioMap = Object.fromEntries(scenarios.map(s => [s.id, s]))

    const scenariosByDomain = {}
    for (const scn of scenarios) {
      const did = scn.domain_id
      if (!did) continue
      ;(scenariosByDomain[did] = scenariosByDomain[did] || []).push(scn)
    }

    const ktsByScenario = {}
    for (const kt of key_trends) {
      const sid = kt.scenario_id
      if (!sid) continue
      ;(ktsByScenario[sid] = ktsByScenario[sid] || []).push(kt)
    }

    const ktsByDomain = {}
    for (const kt of key_trends) {
      const did = kt.domain_id
      if (!did) continue
      ;(ktsByDomain[did] = ktsByDomain[did] || []).push(kt)
    }

    // ── v2 hierarchy lookups by natural ID ──
    // ktsByScenario (above) is keyed by `scn-{db_id}` (taken from
    // kt.scenario_id). These three are keyed by natural IDs (scenario.id,
    // kt.id, sub.id) and derived from the explicit child-id arrays on each
    // parent — unambiguous lookups for the deep-hierarchy UI.
    const ktsByScenarioId = {}
    for (const scn of scenarios) {
      ktsByScenarioId[scn.id] = (scn.key_trend_ids || [])
        .map(id => keyMap[id])
        .filter(Boolean)
    }
    const subTrendsByKtId = {}
    for (const kt of key_trends) {
      subTrendsByKtId[kt.id] = (kt.sub_trend_ids || [])
        .map(id => subMap[id])
        .filter(Boolean)
    }
    const claimsBySubTrendId = {}
    for (const st of sub_trends) {
      claimsBySubTrendId[st.id] = (st.claim_ids || [])
        .map(id => claimMap[id])
        .filter(Boolean)
    }

    const insightsByDomain = {}
    for (const ins of synthesis_insights) {
      const did = ins.domain_id
      if (!did) continue
      ;(insightsByDomain[did] = insightsByDomain[did] || []).push(ins)
    }

    // ── Slug-based hierarchy lookups (URLs: /map/:domain/:scenario/:kt/:sub) ──
    // Scenario / KT / sub-trend names are unique within their parent — we
    // slugify the `name` field for URL segments. Each entity gets a `_slug`
    // tag attached, and we build nested maps for O(1) reverse lookup from
    // URL segments back to the underlying entity.
    const scenarioSlug = (scn) => slugify(scn.name || scn.id)
    const ktSlug       = (kt)  => slugify(kt.name  || kt.id)
    const subSlug      = (st)  => slugify(st.name  || st.id)

    // domainSlug → { scenarioSlug → scenario }
    const scenariosByDomainSlug = {}
    for (const scn of scenarios) {
      const did = scn.domain_id
      if (!did) continue
      const slug = scenarioSlug(scn)
      ;(scenariosByDomainSlug[did] = scenariosByDomainSlug[did] || {})[slug] = scn
    }

    // domainSlug → scenarioSlug → { ktSlug → kt }
    const ktsByScenarioSlug = {}
    for (const scn of scenarios) {
      const did = scn.domain_id
      if (!did) continue
      const sSlug = scenarioSlug(scn)
      const kts = ktsByScenarioId[scn.id] || []
      const ktMap = {}
      for (const kt of kts) ktMap[ktSlug(kt)] = kt
      ;(ktsByScenarioSlug[did] = ktsByScenarioSlug[did] || {})[sSlug] = ktMap
    }

    // domain → scenario → kt → { subSlug → sub }
    const subsByKtSlug = {}
    for (const scn of scenarios) {
      const did = scn.domain_id
      if (!did) continue
      const sSlug = scenarioSlug(scn)
      const kts = ktsByScenarioId[scn.id] || []
      const byKt = {}
      for (const kt of kts) {
        const subs = subTrendsByKtId[kt.id] || []
        const subMapBySlug = {}
        for (const st of subs) subMapBySlug[subSlug(st)] = st
        byKt[ktSlug(kt)] = subMapBySlug
      }
      ;(subsByKtSlug[did] = subsByKtSlug[did] || {})[sSlug] = byKt
    }

    // ── Lookup helpers used by route components ──
    const scenarioBySlug = (domainId, scnSlug) =>
      (scenariosByDomainSlug[domainId] || {})[scnSlug] || null

    const ktBySlug = (domainId, scnSlug, kSlug) =>
      ((ktsByScenarioSlug[domainId] || {})[scnSlug] || {})[kSlug] || null

    const subTrendBySlug = (domainId, scnSlug, kSlug, sSlug) =>
      (((subsByKtSlug[domainId] || {})[scnSlug] || {})[kSlug] || {})[sSlug] || null

    const claimsForSubTrend = (subTrendId) =>
      claimsBySubTrendId[subTrendId] || []

    // Pre-computed thinker lookup by name (claims store name strings).
    // `thinkers` was already sanitised at the top of this useMemo.
    const thinkerByName = Object.fromEntries(
      thinkers.map(t => [t.name, t])
    )

    return {
      // ── raw arrays ──
      macros, scenarios, key_trends, sub_trends, claims,

      // ── v1 legacy ──
      macroMap, keyMap, subMap, claimMap,
      keysByMacro, subsByKey, claimsBySub,
      macroNumber, subNumber,
      macroByDbId, ktByDbId, stByDbId,
      linksByStDbId, insightsByMacroDbId,

      // ── v2 ──
      isV2,
      domainsArr, domainMap,
      scenarioMap, scenariosByDomain,
      ktsByScenario, ktsByDomain,
      // Deep-hierarchy lookups keyed by natural IDs (scenario.id, kt.id, st.id):
      ktsByScenarioId, subTrendsByKtId, claimsBySubTrendId,
      linksByStId, insightsByDomain,
      // Slug-based lookups for URL routing
      scenarioBySlug, ktBySlug, subTrendBySlug, claimsForSubTrend,
      scenarioSlug, ktSlug, subSlug,
      thinkerByName,

      // ── shared (sanitised above) ──
      thinkers,
      synthesis_insights,
      links,
      domains:            ctx.domains            || (isV2 ? [] : {}),
      domain_flows:       ctx.domain_flows       || [],
      // by_thinker is a thinker-name → entity[] index; sanitise each entity
      // so the per-thinker node list never displays "AGI" in names/descriptions.
      by_thinker:         Object.fromEntries(
        Object.entries(ctx.by_thinker || {}).map(([k, v]) => [k, sanitiseList(v)])
      ),
      by_velocity:        ctx.by_velocity        || {},
      by_horizon:         ctx.by_horizon         || {},
    }
  }, [ctx])
}

/**
 * Derive an editorial "signal" summary from a sub-trend's claims.
 * Handles both old float signal_strength and new string values.
 */
export function deriveSignals(claims) {
  if (!claims?.length) {
    return [
      { label: 'Evidence', value: '—' },
      { label: 'Sources',  value: '—' },
      { label: 'Signal',   value: '—' },
    ]
  }
  const uniqueSources  = new Set(claims.map(c => c.source_title).filter(Boolean))
  const uniqueThinkers = new Set(claims.map(c => (c.thinker || c.thinker_name)).filter(Boolean))

  const toScore = s => {
    if (s === 'strong_signal') return 1.0
    if (s === 'signal')        return 0.6
    const n = Number(s)
    return isNaN(n) ? 0.4 : n
  }
  const avg = claims.reduce((acc, c) => acc + toScore(c.signal_strength), 0) / claims.length
  let bucket = 'Low'
  if (avg >= 0.85)      bucket = 'Very high'
  else if (avg >= 0.65) bucket = 'High'
  else if (avg >= 0.45) bucket = 'Medium'

  return [
    { label: 'Claims',   value: String(claims.length).padStart(2, '0') },
    { label: 'Sources',  value: String(uniqueSources.size).padStart(2, '0') },
    { label: 'Thinkers', value: String(uniqueThinkers.size).padStart(2, '0') },
    { label: 'Signal',   value: `${bucket} (${avg.toFixed(2)})` },
  ]
}
