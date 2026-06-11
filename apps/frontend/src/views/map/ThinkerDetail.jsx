import { useState, useMemo, useContext } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  motion,
  useMotionValue, useSpring, useTransform,
} from 'framer-motion'
import { MapDataContext, useMapLookup, slugify, findThinkerBySlug } from './MapDataContext'
import StickyBreadcrumb from './components/Breadcrumbs'
import { ThinkerAvatar } from './ThinkerIndex'
import { stripAgi, sanitiseList } from '../../utils/text'
import { useData } from '../../hooks/useData'
import { deriveStances } from './deriveStances'
import {
  EASE_GENTLE, EASE_WARP,
  DUR_CONTENT, DUR_FAST,
  STAGGER_KT,
  fadeUp, staggerContainer,
} from './motion'

/**
 * ThinkerDetail — /map/thinkers/:slug
 *
 * Phase 4: sequential fade-up hero, hover parallax on portrait,
 * staggered claim groups.
 */
export default function ThinkerDetail() {
  const { slug } = useParams()
  const {
    thinkers, macros, key_trends, sub_trends, claims: mapClaims,
  } = useMapLookup()

  // claims.json holds the full set (~31k DB claims), of which only ~400 made it
  // into map.json. Lazy-load it so every thinker — not just the 10 in the
  // editorial subset — can render their non-duplicate, qualifying-signal
  // claims using the same UI as before. While this 24MB file is in flight,
  // fall back to the map.json subset so the page renders immediately.
  const { data: claimsRaw, loading: claimsLoading } = useData('claims.json')

  const thinker = findThinkerBySlug(thinkers, slug)

  const name = thinker?.name ?? null

  // Normalise broader claims.json rows into the map.json claim shape that
  // ClaimRow and the sub_trend reverse-lookup expect:
  //   claim_text → text, thinker_name → thinker, id → "c_${id}"
  // Filter is the same one the editorial pipeline applies (see
  // generate_map_data_v2.py:447).
  const thinkerClaims = useMemo(() => {
    if (!name) return []
    if (!claimsRaw) {
      // claims.json still loading — use whatever map.json gave us so the
      // 10 in by_thinker remain visible during the initial fetch.
      return mapClaims.filter(c => c.thinker === name)
    }
    const filtered = claimsRaw.filter(c =>
      c.thinker_name === name &&
      c.duplicate_of == null &&
      (c.signal_strength === 'signal' || c.signal_strength === 'strong_signal')
    )
    const normalised = filtered.map(c => ({
      id:                   `c_${c.id}`,
      text:                 c.claim_text,
      thinker:              c.thinker_name,
      thinker_credibility:  c.credibility_score,
      source_title:         c.source_title,
      source_date:          c.source_date,
      signal_strength:      c.signal_strength,
      consumer_implication: c.consumer_implication,
    }))
    normalised.sort((a, b) => (b.source_date || '').localeCompare(a.source_date || ''))
    return sanitiseList(normalised)
  }, [claimsRaw, name, mapClaims])

  if (!thinker) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Not found</p>
        <h1 className="font-editorial text-3xl text-cream mb-6">Thinker not found.</h1>
        <Link to="/map/thinkers" className="text-sm text-neutral-400 hover:text-cream underline">
          Back to thinkers
        </Link>
      </div>
    )
  }

  // Proponent / skeptic roles.
  // For the 10 thinkers with authored stances in map.json the helper returns
  // those verbatim; for newly-surfaced thinkers (no authored labels) it derives
  // stances from claim_text + topic links. See deriveStances.js for the full
  // rule set.
  const mapData = useContext(MapDataContext)
  const { proponents: propMap, skeptics: skepMap } = useMemo(
    () => deriveStances(claimsRaw, mapData),
    [claimsRaw, mapData],
  )
  const ktById = useMemo(
    () => Object.fromEntries(key_trends.map(kt => [kt.id, kt])),
    [key_trends],
  )
  const ktPropOf = useMemo(() => {
    const ids = propMap.get(name)
    if (!ids) return []
    return [...ids].map(id => ktById[id]).filter(Boolean)
  }, [propMap, name, ktById])
  const ktSkepOf = useMemo(() => {
    const ids = skepMap.get(name)
    if (!ids) return []
    return [...ids].map(id => ktById[id]).filter(Boolean)
  }, [skepMap, name, ktById])
  // V2 has no macros; keep the macro arrays empty so the existing render path
  // below remains the same shape it was for authored thinkers.
  const macroPropOf = macros.filter(m => (m.proponents || []).includes(name))
  const macroSkepOf = macros.filter(m => (m.skeptics   || []).includes(name))

  // Build reverse lookup: claim_id → sub_trend
  const claimToSt = {}
  for (const st of sub_trends) {
    for (const cid of (st.claim_ids || [])) {
      claimToSt[cid] = st
    }
  }

  // Build reverse lookup: sub_trend_id → first macro (via KT.macro_ids[0]).
  // ktById is already memoised above for the proponent/skeptic columns.
  const macroById = Object.fromEntries(macros.map(m => [m.id, m]))
  const stToMacroId = {}
  for (const st of sub_trends) {
    const kt = ktById[st.key_trend_id]
    if (kt?.macro_ids?.[0]) stToMacroId[st.id] = kt.macro_ids[0]
  }

  // Group claims by macro
  const claimsByMacro = {}
  for (const claim of thinkerClaims) {
    const st = claimToSt[claim.id]
    const macroId = st ? stToMacroId[st.id] : null
    const key = macroId || '__unattributed__'
    if (!claimsByMacro[key]) claimsByMacro[key] = []
    claimsByMacro[key].push(claim)
  }

  // Sort macro groups by macro order
  const macroOrder = Object.fromEntries(macros.map((m, i) => [m.id, i]))
  const sortedMacroGroups = Object.entries(claimsByMacro).sort(([a], [b]) => {
    if (a === '__unattributed__') return 1
    if (b === '__unattributed__') return -1
    return (macroOrder[a] ?? 99) - (macroOrder[b] ?? 99)
  })

  // thinker.* arrives sanitised from useMapLookup (image_url + bio come from the DB).
  const bio = thinker.description || stripAgi(thinker.bio) || null
  // Nodes count = the same filtered claim set the profile body renders below.
  // Same filter, same set; the two numbers must agree.
  const nodeCount = thinkerClaims.length

  return (
    <>
    <StickyBreadcrumb crumbs={[
      { label: 'Home', to: '/map' },
      { label: 'Thinkers', to: '/map/thinkers' },
      { label: name },
    ]} />

    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

      {/* ── Hero — sequential fade-up ── */}
      <motion.div
        className="flex flex-col sm:flex-row items-start gap-7 mb-10 pb-10 border-b border-neutral-800"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.09, 0.05)}
      >
        {/* Portrait with tilt parallax */}
        <motion.div variants={fadeUp} className="shrink-0">
          <TiltPortrait name={name} />
        </motion.div>

        {/* Name + stats + bio */}
        <div className="flex-1 min-w-0">
          <motion.h1
            variants={fadeUp}
            className="font-editorial text-3xl sm:text-4xl text-cream mb-2 leading-tight"
          >
            {name}
          </motion.h1>

          {/* Meta row */}
          <motion.div variants={fadeUp} className="flex items-center gap-4 flex-wrap mb-4">
            {thinker.credibility_score != null && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                Credibility {thinker.credibility_score.toFixed(1)}
              </span>
            )}
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
              {claimsLoading && thinkerClaims.length === 0
                ? 'Loading claims…'
                : `${thinkerClaims.length} claim${thinkerClaims.length !== 1 ? 's' : ''}`}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
              {nodeCount} node{nodeCount !== 1 ? 's' : ''} contributed
            </span>
          </motion.div>

          {bio && (
            <motion.p variants={fadeUp} className="text-neutral-400 text-sm leading-relaxed max-w-2xl">
              {bio}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* ── Proponent / Skeptic columns — stagger in ── */}
      <motion.div
        className="grid md:grid-cols-[1fr_1fr] gap-10 mb-12"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.05, 0.25)}
      >
        {/* Proponent of */}
        <motion.div variants={fadeUp}>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-emerald-500/80 mb-5">
            Proponent of
          </h2>
          {macroPropOf.length === 0 && ktPropOf.length === 0 ? (
            <p className="text-neutral-600 text-xs">No proponent positions recorded.</p>
          ) : (
            <div className="space-y-2">
              {macroPropOf.map(m => (
                <Link
                  key={m.id}
                  to={`/map/macros/${m.id}`}
                  className="flex items-center gap-2 text-sm text-neutral-300 hover:text-cream group"
                >
                  <span className="w-1 h-1 rounded-full bg-emerald-500/60 shrink-0" />
                  <span className="group-hover:underline underline-offset-2">{m.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 shrink-0">
                    Scenario
                  </span>
                </Link>
              ))}
              {ktPropOf.map(kt => {
                const macroId = kt.macro_ids?.[0]
                return (
                  <Link
                    key={kt.id}
                    to={macroId ? `/map/macros/${macroId}` : '/map'}
                    className="flex items-center gap-2 text-xs text-neutral-400 hover:text-cream group"
                  >
                    <span className="w-1 h-1 rounded-full bg-emerald-500/30 shrink-0" />
                    <span className="group-hover:underline underline-offset-2">{kt.name}</span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 shrink-0">
                      Key Trend
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Skeptic of */}
        <motion.div variants={fadeUp}>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-red-500/70 mb-5">
            Skeptical of
          </h2>
          {macroSkepOf.length === 0 && ktSkepOf.length === 0 ? (
            <p className="text-neutral-600 text-xs">No skeptic positions recorded.</p>
          ) : (
            <div className="space-y-2">
              {macroSkepOf.map(m => (
                <Link
                  key={m.id}
                  to={`/map/macros/${m.id}`}
                  className="flex items-center gap-2 text-sm text-neutral-300 hover:text-cream group"
                >
                  <span className="w-1 h-1 rounded-full bg-red-500/60 shrink-0" />
                  <span className="group-hover:underline underline-offset-2">{m.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 shrink-0">
                    Scenario
                  </span>
                </Link>
              ))}
              {ktSkepOf.map(kt => {
                const macroId = kt.macro_ids?.[0]
                return (
                  <Link
                    key={kt.id}
                    to={macroId ? `/map/macros/${macroId}` : '/map'}
                    className="flex items-center gap-2 text-xs text-neutral-400 hover:text-cream group"
                  >
                    <span className="w-1 h-1 rounded-full bg-red-500/30 shrink-0" />
                    <span className="group-hover:underline underline-offset-2">{kt.name}</span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 shrink-0">
                      Key Trend
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ── Claims by scenario — staggered groups ── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer(STAGGER_KT, 0.35)}
      >
        <motion.h2
          variants={fadeUp}
          className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-6"
        >
          Contributing claims by scenario
        </motion.h2>

        {thinkerClaims.length === 0 ? (
          <motion.p variants={fadeUp} className="text-neutral-600 text-xs">
            {claimsLoading ? 'Loading claims…' : 'No claims found for this thinker.'}
          </motion.p>
        ) : (
          <div className="space-y-4">
            {sortedMacroGroups.map(([macroId, groupClaims]) => {
              const macro = macroId === '__unattributed__' ? null : macroById[macroId]
              return (
                <motion.div key={macroId} variants={fadeUp}>
                  <ClaimGroup macro={macro} claims={groupClaims} />
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
    </>
  )
}

// ── TiltPortrait ──────────────────────────────────────────────────────────────
// Portrait with subtle 3D tilt on mouse hover.

function TiltPortrait({ name }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const smoothX = useSpring(x, { stiffness: 100, damping: 18 })
  const smoothY = useSpring(y, { stiffness: 100, damping: 18 })

  const rotateY = useTransform(smoothX, [-60, 60], [-8,  8])
  const rotateX = useTransform(smoothY, [-60, 60], [ 6, -6])

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - rect.left - rect.width  / 2)
    y.set(e.clientY - rect.top  - rect.height / 2)
  }

  return (
    <motion.div
      style={{ perspective: 600, rotateX, rotateY }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0) }}
      className="cursor-default"
    >
      <ThinkerAvatar name={name} size="lg" />
    </motion.div>
  )
}

// ── ClaimGroup ────────────────────────────────────────────────────────────────

function ClaimGroup({ macro, claims }) {
  const [open, setOpen] = useState(false)
  const preview = claims.slice(0, 3)
  const rest    = claims.slice(3)

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      {/* Group header */}
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.025)' }}
        className="w-full text-left px-4 sm:px-5 py-3 flex items-center justify-between gap-4 bg-neutral-900/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {macro ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--map-macro)]">
              {macro.name}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Unattributed
            </span>
          )}
          <span className="font-mono text-[9px] text-neutral-600">
            {claims.length} claim{claims.length !== 1 ? 's' : ''}
          </span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: DUR_FAST }}
          className="text-neutral-600 text-[10px] select-none"
          aria-hidden="true"
        >
          ▼
        </motion.span>
      </motion.button>

      {/* Expanded claims list */}
      <motion.div
        initial={false}
        animate={open ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.26, ease: EASE_WARP }}
        className="overflow-hidden"
      >
        {open && (
          <div className="divide-y divide-neutral-800/60">
            {claims.map((claim, i) => (
              <ClaimRow key={claim.id || i} claim={claim} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Collapsed preview: first 3 dimmed */}
      {!open && (
        <div className="divide-y divide-neutral-800/40">
          {preview.map((claim, i) => (
            <ClaimRow key={claim.id || i} claim={claim} muted />
          ))}
          {rest.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors text-left"
            >
              + {rest.length} more claim{rest.length !== 1 ? 's' : ''} — click to expand
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ClaimRow({ claim, muted = false }) {
  const toScore = s => {
    if (s === 'strong_signal') return 1.0
    if (s === 'signal')        return 0.6
    const n = Number(s)
    return isNaN(n) ? 0.4 : n
  }
  const strengthPct = toScore(claim.signal_strength) * 100

  return (
    <div className={`px-4 sm:px-5 py-3 transition-opacity ${muted ? 'opacity-40' : ''}`}>
      <p className="text-sm text-neutral-300 leading-snug mb-2">
        &ldquo;{claim.text}&rdquo;
      </p>
      <div className="flex items-center gap-4 flex-wrap">
        {claim.source_title && (
          <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 truncate max-w-[200px]">
            {claim.source_title}
          </span>
        )}
        {claim.source_date && (
          <span className="font-mono text-[9px] text-neutral-700">
            {claim.source_date.slice(0, 4)}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="font-mono text-[9px] text-neutral-700">Signal</span>
          <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${strengthPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
