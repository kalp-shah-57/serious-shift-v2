import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMapLookup, slugify } from './MapDataContext'
import DomainPill        from './components/DomainPill'
import SubCard           from './components/SubCard'
import Chip              from './components/Chip'
import StickyBreadcrumb  from './components/Breadcrumbs'
import {
  EASE_WARP, EASE_BACK, EASE_GENTLE,
  DUR_MORPH, DUR_CONTENT, DUR_WARP_OUT, DUR_FAST,
  STAGGER_KT, STAGGER_SUB,
  fadeUp, staggerContainer,
} from './motion'

// ── KT orbital layout config ──────────────────────────────────────────────
// For N KTs, the fan layout: { lPct: left%, top: px, cxPct: center-x% for SVG }
// Reference container width: 1200px, KT card width: 250px (cxPct = lPct + 10.42)
const KT_W  = 250   // card width px (desktop)
const CX_OFF = 10.42 // = (KT_W/2) / 1200 * 100 → center offset in %

const KT_FAN_LAYOUT = {
  1: [{ lPct: 35,  top: 50, cxPct: 45.42 }],
  2: [{ lPct: 12,  top: 25, cxPct: 22.42 }, { lPct: 57, top: 15, cxPct: 67.42 }],
  3: [{ lPct: 2,   top: 20, cxPct: 12.42 }, { lPct: 33, top: 0,  cxPct: 43.42 }, { lPct: 64, top: 22, cxPct: 74.42 }],
  4: [
    { lPct: 2,  top: 15,  cxPct: 12.42 }, { lPct: 52, top: 0,   cxPct: 62.42 },
    { lPct: 2,  top: 280, cxPct: 12.42 }, { lPct: 52, top: 265, cxPct: 62.42 },
  ],
}

function ktLayout(n) {
  return KT_FAN_LAYOUT[Math.min(n, 4)] || KT_FAN_LAYOUT[4]
}

function stageHeight(layout) {
  const maxTop = Math.max(...layout.map(p => p.top))
  return maxTop + 290   // 290px = approximate KT card height
}

// ── useIsDesktop ──────────────────────────────────────────────────────────
function useIsDesktop() {
  const [v, setV] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024,
  )
  useEffect(() => {
    const h = () => setV(window.innerWidth >= 1024)
    window.addEventListener('resize', h, { passive: true })
    return () => window.removeEventListener('resize', h)
  }, [])
  return v
}

// ── Domain / velocity filter constants ────────────────────────────────────
const DOMAINS    = ['society', 'economy', 'consumers', 'organisations']
const VELOCITIES = [
  { value: 'accelerating', label: 'Accel.' },
  { value: 'rising',       label: 'Rising' },
  { value: 'steady',       label: 'Steady' },
]

/**
 * MacroDetail — /map/macros/:slug
 *
 * Phase 1: layoutId hero panel morphs from landing card.
 * Phase 3 (desktop): KTs as spatial orbital nodes below the hero, connected
 *   by SVG lines. Clicking a KT transitions to a focused view with sub-trends.
 *   Compact floating filter HUD replaces the sticky FilterBar.
 * Phase 3 (mobile): Phase 1's staggered list (no orbital).
 */
export default function MacroDetail() {
  const { slug } = useParams()
  const {
    macros, key_trends, sub_trends,
    keysByMacro, subsByKey, macroNumber,
  } = useMapLookup()

  const isDesktop = useIsDesktop()

  const [focusedKtId, setFocusedKtId] = useState(null)
  const [openSubId,   setOpenSubId]   = useState(null)
  const [filters, setFilters] = useState({ domains: [], velocity: [] })

  const macro = macros.find(m => m.id === slug)

  if (!macro) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Not found</p>
        <h1 className="font-editorial text-3xl text-cream mb-6">Scenario not found.</h1>
        <Link to="/map" className="text-sm text-neutral-400 hover:text-cream underline">
          Back to overview
        </Link>
      </div>
    )
  }

  const ktsForMacro = keysByMacro[macro.id] || []
  const keyMap      = Object.fromEntries(key_trends.map(k => [k.id, k]))
  const focusedKt   = focusedKtId ? (keyMap[focusedKtId] || null) : null

  // Filtered sub-trends (for mobile list mode)
  const allSubs = ktsForMacro.flatMap(kt =>
    (subsByKey[kt.id] || []).map(sub => ({ sub, kt })),
  )
  const filteredSubs = allSubs.filter(({ sub, kt }) => {
    const domainOk = filters.domains.length === 0 ||
      (sub.domains || []).some(d => filters.domains.includes(d))
    const velOk = filters.velocity.length === 0 ||
      filters.velocity.includes(kt.velocity)
    return domainOk && velOk
  })
  const filteredSubIds = new Set(filteredSubs.map(({ sub }) => sub.id))
  const hasFilters     = filters.domains.length > 0 || filters.velocity.length > 0
  const visibleKtIds   = new Set(filteredSubs.map(({ kt }) => kt.id))

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      {/* Breadcrumb */}
      <StickyBreadcrumb crumbs={[
        { label: 'Home', to: '/map' },
        { label: macro.name },
      ]} />

      {/* ── Hero panel — layoutId morph from landing card (Phase 1) ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <motion.div
          layoutId={`macro-card-${macro.id}`}
          className="bg-neutral-900/40 border border-neutral-800 rounded-lg border-l-[3px] tier-border-macro p-6 sm:p-8 mb-8"
          style={{ borderRadius: 8 }}
          transition={{ duration: DUR_MORPH, ease: EASE_WARP }}
        >
          <motion.div
            className="flex items-center gap-2 mb-4 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.30, delay: DUR_MORPH * 0.6, ease: EASE_GENTLE }}
          >
            <Chip kind="macro">Scenario {macroNumber(macro)}</Chip>
            {macro.horizon && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5">
                {macro.horizon}
              </span>
            )}
          </motion.div>

          <h1 className="font-editorial text-3xl sm:text-4xl leading-tight text-cream mb-3">
            {macro.name}
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR_CONTENT, delay: DUR_MORPH * 0.55, ease: EASE_GENTLE }}
          >
            <p className="text-neutral-400 text-base leading-relaxed mb-4">
              {macro.description}
            </p>
            {(macro.domains || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {macro.domains.map(d => <DomainPill key={d} domain={d} />)}
              </div>
            )}
            {((macro.proponents || []).length > 0 || (macro.skeptics || []).length > 0) && (
              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-neutral-800/60">
                {(macro.proponents || []).length > 0 && (
                  <ThinkerRow label="Proponents" names={macro.proponents} color="text-emerald-500/70" />
                )}
                {(macro.skeptics || []).length > 0 && (
                  <ThinkerRow label="Skeptics" names={macro.skeptics} color="text-red-500/70" />
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* ── KT section: orbital (desktop) or staggered list (mobile) ─ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        {isDesktop ? (
          <KTOrbital
            kts={ktsForMacro}
            subsByKey={subsByKey}
            filters={filters}
            setFilters={setFilters}
            focusedKtId={focusedKtId}
            setFocusedKtId={setFocusedKtId}
            openSubId={openSubId}
            setOpenSubId={setOpenSubId}
          />
        ) : (
          <KTMobileList
            ktsForMacro={ktsForMacro}
            subsByKey={subsByKey}
            filteredSubIds={filteredSubIds}
            hasFilters={hasFilters}
            visibleKtIds={visibleKtIds}
            allSubs={allSubs}
            filters={filters}
            setFilters={setFilters}
            openSubId={openSubId}
            setOpenSubId={setOpenSubId}
          />
        )}
      </div>
    </motion.div>
  )
}

// ── KTOrbital (desktop) ──────────────────────────────────────────────────

function KTOrbital({ kts, subsByKey, filters, setFilters, focusedKtId, setFocusedKtId, openSubId, setOpenSubId }) {
  const layout = ktLayout(kts.length)
  const height = stageHeight(layout)
  const hasFocus = Boolean(focusedKtId)
  const focusedKt = kts.find(kt => kt.id === focusedKtId) || null

  const [warping, setWarping] = useState(false)

  function handleKTClick(kt) {
    if (warping) return
    setWarping(true)
    setOpenSubId(null)
    // Brief pause then transition state
    setTimeout(() => {
      setFocusedKtId(kt.id)
      setWarping(false)
    }, 320)
  }

  function handleBack() {
    if (warping) return
    setWarping(true)
    setOpenSubId(null)
    setTimeout(() => {
      setFocusedKtId(null)
      setWarping(false)
    }, 280)
  }

  return (
    <div className="relative">
      {/* Compact floating filter HUD */}
      <CompactFilterHUD filters={filters} setFilters={setFilters} />

      {/* Label above orbital */}
      <motion.p
        className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 mb-6"
        animate={hasFocus ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        {kts.length} key trend{kts.length !== 1 ? 's' : ''} — click to explore
      </motion.p>

      <AnimatePresence mode="wait">
        {!hasFocus ? (
          // ── Overview: fan layout ──
          <motion.div
            key="overview"
            className="relative"
            style={{ minHeight: height }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.28, ease: EASE_WARP } }}
            transition={{ duration: 0.35, ease: EASE_GENTLE }}
          >
            {/* SVG connection lines */}
            <KTConnectionLines layout={layout} n={kts.length} height={height} />

            {/* KT cards */}
            {kts.map((kt, i) => {
              const pos = layout[i] || layout[layout.length - 1]
              return (
                <motion.div
                  key={kt.id}
                  className="absolute"
                  style={{ left: `${pos.lPct}%`, top: pos.top, width: KT_W }}
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    duration: DUR_CONTENT,
                    ease: EASE_GENTLE,
                    delay: DUR_MORPH * 0.65 + i * STAGGER_KT,
                  }}
                >
                  <KTCard kt={kt} subCount={(subsByKey[kt.id] || []).length} onOpen={() => handleKTClick(kt)} disabled={warping} />
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          // ── Focused: KT takes center stage ──
          <motion.div
            key={`focused-${focusedKtId}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.22, ease: EASE_BACK } }}
            transition={{ duration: 0.40, ease: EASE_GENTLE }}
          >
            {/* Back link */}
            <button
              type="button"
              onClick={handleBack}
              disabled={warping}
              className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-6 font-mono uppercase tracking-widest"
            >
              ← All key trends
            </button>

            {/* Focused KT header */}
            <div className="border border-neutral-700 bg-neutral-900/50 border-l-[3px] tier-border-key rounded-lg p-6 sm:p-7 mb-8">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Chip kind="key">Key Trend</Chip>
                {focusedKt?.velocity && (
                  <span className="font-mono text-[9px] uppercase tracking-widest border border-neutral-800 text-neutral-500 rounded px-1.5 py-0.5">
                    {focusedKt.velocity}
                  </span>
                )}
              </div>
              <h2 className="font-editorial text-2xl sm:text-3xl text-cream mb-3">
                {focusedKt?.name}
              </h2>
              {focusedKt?.description && (
                <p className="text-neutral-400 text-sm leading-relaxed mb-4">
                  {focusedKt.description}
                </p>
              )}
              {(focusedKt?.domains || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {focusedKt.domains.map(d => <DomainPill key={d} domain={d} size="xs" />)}
                </div>
              )}
              {((focusedKt?.proponents || []).length > 0 || (focusedKt?.skeptics || []).length > 0) && (
                <div className="flex flex-wrap gap-4 pt-3 border-t border-neutral-800/60 text-xs">
                  {(focusedKt?.proponents || []).length > 0 && (
                    <InlineThinkerRow label="For" names={focusedKt.proponents} />
                  )}
                  {(focusedKt?.skeptics || []).length > 0 && (
                    <InlineThinkerRow label="Skeptics" names={focusedKt.skeptics} />
                  )}
                </div>
              )}
            </div>

            {/* Sub-trends — spatial grid with rotations */}
            <FocusedSubGrid
              subs={subsByKey[focusedKtId] || []}
              openSubId={openSubId}
              setOpenSubId={setOpenSubId}
            />

            {/* Siblings — compact strip at bottom */}
            <SiblingKTStrip
              kts={kts}
              focusedKtId={focusedKtId}
              onClick={handleKTClick}
              disabled={warping}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── KTConnectionLines ─────────────────────────────────────────────────────

function KTConnectionLines({ layout, n, height }) {
  // SVG viewBox="0 0 100 {h}" — percentage x, mapped-px y
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full pointer-events-none"
      style={{ height }}
    >
      {layout.slice(0, n).map((pos, i) => (
        <motion.line
          key={i}
          x1="50"   y1="0"
          x2={pos.cxPct}  y2={pos.top}
          stroke="var(--map-key)"
          strokeWidth="0.25"
          strokeOpacity="0.3"
          strokeDasharray="3 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.55, delay: DUR_MORPH * 0.7 + i * 0.08, ease: EASE_GENTLE }}
        />
      ))}
    </svg>
  )
}

// ── KTCard ────────────────────────────────────────────────────────────────

function KTCard({ kt, subCount, onOpen, disabled }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onOpen}
      className={`
        w-full text-left p-5 bg-neutral-900/40 border border-neutral-800 rounded-lg
        border-l-[3px] tier-border-key flex flex-col gap-3
        transition-colors hover:border-neutral-700 hover:bg-neutral-900/70
        focus:outline-none focus:ring-1 focus:ring-neutral-700
        ${disabled ? 'cursor-default opacity-70' : 'map-clickable'}
      `}
    >
      <Chip kind="key">Key Trend</Chip>
      <h3 className="font-editorial text-lg leading-snug text-cream">{kt.name}</h3>
      {kt.description && (
        <p className="text-xs text-neutral-500 leading-relaxed line-clamp-3">{kt.description}</p>
      )}
      <div className="mt-auto pt-3 border-t border-neutral-800 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600">
          {subCount} sub-trend{subCount !== 1 ? 's' : ''}
        </span>
        <span className="text-neutral-600 text-[10px]">→</span>
      </div>
    </button>
  )
}

// ── FocusedSubGrid ────────────────────────────────────────────────────────

// Sub-trends in a 2-col spatial grid with slight rotations for depth
const SUB_ROTS = [-0.8, 0.6, -0.4, 0.9, -1.0, 0.3, -0.6, 0.8]

function FocusedSubGrid({ subs, openSubId, setOpenSubId }) {
  if (subs.length === 0) return (
    <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest py-6">
      No sub-trends for this key trend.
    </p>
  )

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-600 mb-4">
        {subs.length} sub-trend{subs.length !== 1 ? 's' : ''}
      </p>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        variants={staggerContainer(STAGGER_SUB, 0.05)}
        initial="hidden"
        animate="visible"
      >
        {subs.map((sub, i) => (
          <motion.div
            key={sub.id}
            style={{ rotate: SUB_ROTS[i % SUB_ROTS.length] }}
            variants={fadeUp}
            transition={{ duration: DUR_CONTENT, ease: EASE_GENTLE }}
          >
            <SubCard
              sub={sub}
              isOpen={openSubId === sub.id}
              onToggle={() => setOpenSubId(prev => prev === sub.id ? null : sub.id)}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

// ── SiblingKTStrip ────────────────────────────────────────────────────────

function SiblingKTStrip({ kts, focusedKtId, onClick, disabled }) {
  const siblings = kts.filter(kt => kt.id !== focusedKtId)
  if (siblings.length === 0) return null

  return (
    <motion.div
      className="mt-10 pt-6 border-t border-neutral-800"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.35, ease: EASE_GENTLE }}
    >
      <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-4">
        Other key trends in this scenario
      </p>
      <div className="flex flex-wrap gap-2">
        {siblings.map(kt => (
          <button
            key={kt.id}
            type="button"
            onClick={disabled ? undefined : () => onClick(kt)}
            className="px-3 py-1.5 rounded border border-neutral-800 text-xs text-neutral-400 hover:border-neutral-600 hover:text-cream transition-colors font-mono text-left truncate max-w-[260px]"
          >
            {kt.name}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ── CompactFilterHUD ──────────────────────────────────────────────────────

function CompactFilterHUD({ filters, setFilters }) {
  const [open, setOpen] = useState(false)
  const hasFilters = filters.domains.length > 0 || filters.velocity.length > 0

  const toggleDomain = (d) => setFilters(prev => ({
    ...prev,
    domains: prev.domains.includes(d) ? prev.domains.filter(x => x !== d) : [...prev.domains, d],
  }))
  const toggleVel = (v) => setFilters(prev => ({
    ...prev,
    velocity: prev.velocity.includes(v) ? prev.velocity.filter(x => x !== v) : [...prev.velocity, v],
  }))
  const clearAll = () => setFilters({ domains: [], velocity: [] })

  return (
    <div className="absolute top-0 right-0 z-10">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono uppercase tracking-widest
          transition-colors backdrop-blur-sm
          ${hasFilters || open
            ? 'border-neutral-600 text-neutral-300 bg-neutral-900/80'
            : 'border-neutral-800 text-neutral-600 bg-neutral-950/60 hover:border-neutral-700 hover:text-neutral-400'
          }
        `}
      >
        {hasFilters ? '◉' : '○'} Filter
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-9 w-64 bg-neutral-900/95 border border-neutral-700 rounded-lg p-4 shadow-2xl backdrop-blur-md"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ duration: 0.20, ease: EASE_GENTLE }}
          >
            <div className="mb-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-2">Domain</p>
              <div className="flex flex-wrap gap-1">
                {DOMAINS.map(d => (
                  <button key={d} type="button" onClick={() => toggleDomain(d)}
                    className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-widest transition-colors ${
                      filters.domains.includes(d)
                        ? 'border-[var(--map-macro)] text-[var(--map-macro)] bg-[var(--map-macro-soft)]'
                        : 'border-neutral-700 text-neutral-500 hover:border-neutral-600'
                    }`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-2">Velocity</p>
              <div className="flex flex-wrap gap-1">
                {VELOCITIES.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => toggleVel(value)}
                    className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-widest transition-colors ${
                      filters.velocity.includes(value)
                        ? 'border-neutral-500 text-neutral-200 bg-neutral-800'
                        : 'border-neutral-700 text-neutral-500 hover:border-neutral-600'
                    }`}>{label}</button>
                ))}
              </div>
            </div>
            {hasFilters && (
              <button type="button" onClick={clearAll}
                className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 hover:text-cream transition-colors">
                Clear all
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── KTMobileList (mobile fallback — Phase 1 stagger) ─────────────────────

function KTMobileList({ ktsForMacro, subsByKey, filteredSubIds, hasFilters, visibleKtIds, allSubs, filters, setFilters, openSubId, setOpenSubId }) {
  const toggle = (key, value) => setFilters(prev => {
    const arr = prev[key] || []
    return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
  })
  const clearAll = () => setFilters({ domains: [], velocity: [] })

  return (
    <div>
      {/* Simple inline filter row on mobile */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 pb-4 border-b border-neutral-800">
        <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600">Velocity</span>
        {VELOCITIES.map(({ value, label }) => (
          <button key={value} type="button" onClick={() => toggle('velocity', value)}
            className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-widest transition-colors ${
              filters.velocity.includes(value)
                ? 'border-neutral-500 text-neutral-200'
                : 'border-neutral-800 text-neutral-600'
            }`}>{label}</button>
        ))}
        {hasFilters && (
          <button type="button" onClick={clearAll}
            className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 hover:text-cream ml-auto">Clear</button>
        )}
      </div>

      {allSubs.length === 0 ? (
        <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest py-8">No sub-trends in this scenario.</p>
      ) : (
        <motion.div
          className="space-y-14"
          variants={staggerContainer(STAGGER_KT, DUR_MORPH * 0.7)}
          initial="hidden"
          animate="visible"
        >
          {ktsForMacro.map(kt => {
            if (hasFilters && !visibleKtIds.has(kt.id)) return null
            const subs = (subsByKey[kt.id] || []).filter(
              sub => !hasFilters || filteredSubIds.has(sub.id),
            )
            return (
              <motion.section key={kt.id} variants={fadeUp} transition={{ duration: DUR_CONTENT, ease: EASE_GENTLE }}>
                <div className="border-l-[3px] tier-border-key pl-4 sm:pl-5 mb-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Chip kind="key">Key Trend</Chip>
                    {kt.velocity && (
                      <span className="font-mono text-[9px] uppercase tracking-widest border border-neutral-800 text-neutral-500 rounded px-1.5 py-0.5">{kt.velocity}</span>
                    )}
                  </div>
                  <h2 className="font-editorial text-2xl leading-tight text-cream mb-2">{kt.name}</h2>
                  {kt.description && <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">{kt.description}</p>}
                  {(kt.domains || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {kt.domains.map(d => <DomainPill key={d} domain={d} size="xs" />)}
                    </div>
                  )}
                  {((kt.proponents || []).length > 0 || (kt.skeptics || []).length > 0) && (
                    <div className="flex flex-wrap gap-4 mt-3 text-xs">
                      {(kt.proponents || []).length > 0 && <InlineThinkerRow label="For" names={kt.proponents} />}
                      {(kt.skeptics || []).length > 0 && <InlineThinkerRow label="Skeptics" names={kt.skeptics} />}
                    </div>
                  )}
                </div>
                {subs.length > 0 && (
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    variants={staggerContainer(STAGGER_SUB, 0.05)}
                  >
                    {subs.map(sub => (
                      <motion.div key={sub.id} variants={fadeUp} transition={{ duration: DUR_CONTENT, ease: EASE_GENTLE }}>
                        <SubCard
                          sub={sub}
                          isOpen={openSubId === sub.id}
                          onToggle={() => setOpenSubId(prev => prev === sub.id ? null : sub.id)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.section>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────

function ThinkerRow({ label, names, color = 'text-emerald-500/70' }) {
  return (
    <div>
      <p className={`font-mono text-[9px] uppercase tracking-widest ${color} mb-2`}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {names.map(name => (
          <Link key={name} to={`/map/thinkers/${slugify(name)}`}
            className="text-xs text-neutral-300 hover:text-cream underline underline-offset-2 decoration-neutral-700 hover:decoration-neutral-500 transition-colors">
            {name}
          </Link>
        ))}
      </div>
    </div>
  )
}

function InlineThinkerRow({ label, names }) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 pt-0.5 shrink-0 w-14">{label}</span>
      <div className="flex flex-wrap gap-1">
        {names.map(name => (
          <Link key={name} to={`/map/thinkers/${slugify(name)}`}
            className="text-xs text-neutral-400 hover:text-cream underline underline-offset-2 decoration-neutral-700 hover:decoration-neutral-500 transition-colors">
            {name}
          </Link>
        ))}
      </div>
    </div>
  )
}
