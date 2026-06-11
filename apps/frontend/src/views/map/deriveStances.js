/**
 * Derive proponent / skeptic stances per (thinker, key_trend) from claims.json.
 *
 * Why this exists:
 *   map.json carries author-curated `proponents` / `skeptics` arrays on each KT,
 *   but only for the 10 thinkers in the editorial subset. The other 28 thinkers
 *   with DB claim data have no authored stances. This helper fills the gap by
 *   structurally deriving stances from claim text + topic links.
 *
 * Approach (no LLM, no scraping, no fabricated content):
 *   1. Link each claim to a key_trend. Preferred path is the direct FK chain
 *      (claim_id appears in sub_trend.claim_ids → sub_trend.key_trend_id), but
 *      that chain only exists for the ~400 editorial claims attached to the 10
 *      original thinkers. For everything else we fall back to topic match:
 *      claim.domain → KT domain bucket, then argmax token overlap between
 *      claim_text and KT.name + KT.description, with a min-overlap threshold of
 *      2 significant words to avoid spurious matches.
 *   2. Classify each linked claim as proponent or skeptic with a keyword regex
 *      on claim_text. Skeptic-flavored language ("fails", "won't", "myth",
 *      "dangerous", "overstated", …) → skeptic. Otherwise proponent. This is a
 *      coarse heuristic; without a stance field in the data it's the most
 *      defensible signal available.
 *   3. Threshold: ≥3 claims with a given polarity in a (thinker, KT) pair to
 *      emit the label. A thinker can be proponent on some KTs and skeptic on
 *      others — both can apply simultaneously.
 *
 * Backward compat:
 *   If a thinker already appears in any KT.proponents or KT.skeptics array in
 *   map.json, we keep those authored labels verbatim and emit NO derived ones
 *   for that thinker. Derivation only fills in for thinkers who had no
 *   authored labels at all.
 */

const STOPWORDS = new Set((
  "a an the and or but of for to in on at by with from as is are was were be been being " +
  "have has had do does did will would shall should can could may might must not no nor " +
  "so if then than that this these those there here it its their his her our we you they " +
  "them us i me my your what when where why how which who whom whose into onto out up " +
  "down off over under again further once also more most some any all each every other " +
  "another such only own same just very too else now ai agi about against during before " +
  "after through during between within without whether across along among amid amongst " +
  "toward towards upon until since because unless although though even ever never always " +
  "sometimes often usually still already yet"
).split(/\s+/))

const TOK_RE = /[a-z][a-z-]{3,}/g

function tokenize(text) {
  if (!text) return new Set()
  const matches = text.toLowerCase().match(TOK_RE) || []
  const out = new Set()
  for (const w of matches) if (!STOPWORDS.has(w)) out.add(w)
  return out
}

// claim.domain (10 fine-grained DB categories) → map.json KT.domain_id (4 strategic buckets).
// Hand-curated; the two taxonomies don't overlap perfectly, so this is the most
// defensible bridge. Used only when the direct FK link doesn't exist.
const CLAIM_DOMAIN_TO_KT_DOMAIN = {
  consumer_behavior:     'consumers',
  education:             'consumers',
  economy:               'economy',
  labor:                 'economy',
  enterprise:            'organisations',
  technology_capability: 'organisations',
  existential_risk:      'society',
  geopolitics:           'society',
  regulation:            'society',
  agi_timeline:          'society',
}

const SKEPTIC_RE = new RegExp(
  "\\b(" + [
    "fails?", "failing", "failed", "broken", "won'?t", "cannot", "can'?t",
    "doesn'?t\\s+work", "isn'?t\\s+enough",
    "overstated", "exaggerated", "overblown", "hype", "hyped", "myth",
    "misleading", "unrealistic", "inflated",
    "dangerous", "harmful", "harms", "threat", "threatens", "risk\\s+of",
    "warning", "warns", "alarm", "peril",
    "worrying", "catastroph", "misuse", "abuse", "biased",
    "skeptic", "skeptical", "doubt", "doubtful", "unproven", "disproven",
    "fallacy", "problematic", "flawed?", "illusion",
    "misalign", "misaligned", "hallucinat", "displac",
  ].join("|") + ")\\b",
  "i",
)

const MIN_TOKEN_OVERLAP = 2
const CLAIMS_PER_KT_THRESHOLD = 3

function stanceOf(claimText) {
  return (claimText && SKEPTIC_RE.test(claimText)) ? 'skeptic' : 'proponent'
}

/**
 * Build the derivation index once from raw data.
 *
 * @param {Array} claims        — claims.json contents (all 31k rows)
 * @param {Object} mapData      — map.json contents (key_trends, sub_trends, …)
 * @returns {{
 *   proponents:    Map<thinkerName, Set<ktId>>,
 *   skeptics:      Map<thinkerName, Set<ktId>>,
 *   proCounts:     Map<thinkerName, Map<ktId, number>>,
 *   skepCounts:    Map<thinkerName, Map<ktId, number>>,
 *   isAuthored:    Map<thinkerName, boolean>,
 * }}
 */
export function deriveStances(claims, mapData) {
  const keyTrends = mapData?.key_trends || []
  const subTrends = mapData?.sub_trends || []

  // Authored stances from map.json (backward-compat source of truth).
  const authoredPro  = new Map()
  const authoredSkep = new Map()
  for (const kt of keyTrends) {
    for (const n of (kt.proponents || [])) {
      if (!authoredPro.has(n))  authoredPro.set(n, new Set())
      authoredPro.get(n).add(kt.id)
    }
    for (const n of (kt.skeptics || [])) {
      if (!authoredSkep.has(n)) authoredSkep.set(n, new Set())
      authoredSkep.get(n).add(kt.id)
    }
  }

  // If a thinker has ANY authored label, skip derivation entirely for them.
  const isAuthored = new Map()
  for (const n of authoredPro.keys())  isAuthored.set(n, true)
  for (const n of authoredSkep.keys()) isAuthored.set(n, true)

  // Early exit when claims.json hasn't loaded yet — return authored set as-is.
  if (!Array.isArray(claims) || claims.length === 0) {
    return {
      proponents:  authoredPro,
      skeptics:    authoredSkep,
      proCounts:   new Map(),
      skepCounts:  new Map(),
      isAuthored,
    }
  }

  // KT lookup indices.
  const ktTokens = new Map()  // ktId → Set<token>
  const domainKts = new Map() // domainId → ktId[]
  for (const kt of keyTrends) {
    ktTokens.set(kt.id, tokenize((kt.name || '') + ' ' + (kt.description || '')))
    if (!domainKts.has(kt.domain_id)) domainKts.set(kt.domain_id, [])
    domainKts.get(kt.domain_id).push(kt.id)
  }

  // Direct FK: claim id (formatted as "c_NNN") → ktId[].
  // sub_trend.claim_ids carries the editorial 400-claim subset.
  const directKtsByClaim = new Map()
  for (const st of subTrends) {
    const ktId = st.key_trend_id
    if (!ktId) continue
    for (const cid of (st.claim_ids || [])) {
      if (!directKtsByClaim.has(cid)) directKtsByClaim.set(cid, [])
      directKtsByClaim.get(cid).push(ktId)
    }
  }

  // Per-thinker, per-KT polarity counters.
  const proCounts  = new Map() // name → Map<ktId, n>
  const skepCounts = new Map()

  const bump = (counter, name, ktId) => {
    if (!counter.has(name)) counter.set(name, new Map())
    const inner = counter.get(name)
    inner.set(ktId, (inner.get(ktId) || 0) + 1)
  }

  // Single pass over qualifying-signal, non-duplicate claims.
  for (const c of claims) {
    if (c.duplicate_of != null) continue
    if (c.signal_strength !== 'signal' && c.signal_strength !== 'strong_signal') continue
    const name = c.thinker_name
    if (!name) continue
    // Backward-compat: don't bother computing for authored thinkers — their
    // result is fixed to map.json's curated set.
    if (isAuthored.get(name)) continue

    const stance = stanceOf(c.claim_text)
    const targetCounter = stance === 'proponent' ? proCounts : skepCounts
    const cidStr = `c_${c.id}`
    const directKts = directKtsByClaim.get(cidStr)
    if (directKts && directKts.length > 0) {
      for (const ktId of directKts) bump(targetCounter, name, ktId)
      continue
    }
    // Domain-bucketed text similarity fallback.
    const ktDom = CLAIM_DOMAIN_TO_KT_DOMAIN[c.domain]
    if (!ktDom) continue
    const claimTokens = tokenize(c.claim_text || '')
    if (claimTokens.size === 0) continue
    const candidateKts = domainKts.get(ktDom) || []
    let bestKt = null
    let bestScore = 0
    for (const ktId of candidateKts) {
      const ktks = ktTokens.get(ktId)
      let overlap = 0
      for (const t of claimTokens) if (ktks.has(t)) overlap++
      if (overlap > bestScore) {
        bestScore = overlap
        bestKt = ktId
      }
    }
    if (bestKt && bestScore >= MIN_TOKEN_OVERLAP) {
      bump(targetCounter, name, bestKt)
    }
  }

  // Materialise final stance sets: thresholded counters become Sets of ktIds.
  // For authored thinkers we just copy through the authored Set verbatim.
  const proponents = new Map()
  const skeptics   = new Map()

  for (const [name, isAuth] of isAuthored.entries()) {
    if (isAuth) {
      if (authoredPro.has(name))  proponents.set(name, authoredPro.get(name))
      if (authoredSkep.has(name)) skeptics.set(name, authoredSkep.get(name))
    }
  }

  for (const [name, ktCounts] of proCounts.entries()) {
    if (isAuthored.get(name)) continue
    const set = new Set()
    for (const [ktId, n] of ktCounts.entries()) {
      if (n >= CLAIMS_PER_KT_THRESHOLD) set.add(ktId)
    }
    if (set.size > 0) proponents.set(name, set)
  }
  for (const [name, ktCounts] of skepCounts.entries()) {
    if (isAuthored.get(name)) continue
    const set = new Set()
    for (const [ktId, n] of ktCounts.entries()) {
      if (n >= CLAIMS_PER_KT_THRESHOLD) set.add(ktId)
    }
    if (set.size > 0) skeptics.set(name, set)
  }

  return { proponents, skeptics, proCounts, skepCounts, isAuthored }
}
