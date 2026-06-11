/**
 * MapLanding — the spatial /map landing page.
 *
 * Four domain cards float in zero-G against an ambient dot field. Hovering a
 * card brightens its cluster. Clicking a card runs Phase 1 (other cards fade
 * out, atmosphere blur peaks) then navigates to DomainDetail, which renders
 * its own decel entrance via the warp-resolution overlay.
 */
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  useMotionValue, useSpring, useTransform,
  useReducedMotion,
} from 'framer-motion'
import { useMapLookup } from './MapDataContext'
import StarField from './components/StarField'
import SpatialBackdrop from './components/SpatialBackdrop'
import {
  EASE_GENTLE, EASE_ACCEL, EASE_DRIFT,
  WARP_PULL_MS, WARP_EXIT_S,
  DRIFT_DURATIONS, DRIFT_PHASES,
  DOMAIN_SPATIAL,
} from './motion'

// ── Domain color palette ───────────────────────────────────────────────────
const DOMAIN_COLORS = {
  society:       { color: 'var(--map-macro)', soft: 'var(--map-macro-soft)' },
  economy:       { color: 'var(--map-key)',   soft: 'var(--map-key-soft)'   },
  consumers:     { color: 'var(--map-sub)',   soft: 'var(--map-sub-soft)'   },
  organisations: { color: '#6ee7b7',          soft: 'color-mix(in oklab, #6ee7b7 14%, transparent)' },
}

// ── Static fallback definitions ────────────────────────────────────────────
const STATIC_DOMAINS = [
  {
    id:    'society',
    name:  'Society',
    short: 'How AI rewrites the social contract — from democratic governance and cultural authority to what it means to be human.',
    label: 'AI × Society',
  },
  {
    id:    'economy',
    name:  'Economy',
    short: 'How AI restructures who creates value, who captures it, and what happens to the rest — the new K-shaped reality.',
    label: 'AI × Economy',
  },
  {
    id:    'consumers',
    name:  'Consumers',
    short: "How AI transforms the way people make decisions, seek fulfilment, and relate to brands — human needs, now AI-mediated.",
    label: 'AI × Consumer Behaviours',
  },
  {
    id:    'organisations',
    name:  'Organisations',
    short: "How firms and institutions adapt — or fail to — when AI can perform, plan, and decide faster than any hierarchy was built to handle.",
    label: 'AI × Organisations',
  },
]

// Map entities (domains, scenarios, KTs, sub-trends, claims, thinkers, etc.)
// are sanitised "AGI" → "AI" at the data-access boundary in MapDataContext.js.
// No per-call sanitiser is needed here.

const SPRING = { stiffness: 60, damping: 20, mass: 1.2 }

// ──────────────────────────────────────────────────────────────────────────

export default function MapLanding() {
  const {
    isV2, domainsArr,
    scenarios, key_trends, sub_trends, claims, links,
    scenariosByDomain, ktsByDomain,
  } = useMapLookup()

  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()

  const [phase, setPhase]           = useState('idle') // 'idle' | 'pulling' | 'warping'
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId]   = useState(null)

  // Mouse parallax — disabled during warp
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothX = useSpring(mouseX, SPRING)
  const smoothY = useSpring(mouseY, SPRING)
  const heroX = useTransform(smoothX, v => (phase === 'idle' ? v * 0.018 : 0))
  const heroY = useTransform(smoothY, v => (phase === 'idle' ? v * 0.012 : 0))
  const fieldX = useTransform(smoothX, v => (phase === 'idle' ? v * -0.008 : 0))
  const fieldY = useTransform(smoothY, v => (phase === 'idle' ? v * -0.005 : 0))

  const containerRef = useRef(null)
  const handleMouseMove = useCallback((e) => {
    if (phase !== 'idle') return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left - rect.width  / 2)
    mouseY.set(e.clientY - rect.top  - rect.height / 2)
  }, [mouseX, mouseY, phase])
  const handleMouseLeave = useCallback(() => { mouseX.set(0); mouseY.set(0) }, [mouseX, mouseY])

  // Domain data — live v2 or static fallback
  const liveDomains = isV2 && domainsArr.length > 0 ? domainsArr : null
  const domains = liveDomains
    ? liveDomains.map(d => ({
        id:    d.id,
        name:  d.name,
        short: d.short_description,
        // Trim the legacy " / World" qualifier from data-driven labels so
        // the Society card reads "AI × Society" (not "AI × Society / World").
        label: (d.label || `AI × ${d.name}`).replace(/\s*\/\s*World$/, ''),
      }))
    : STATIC_DOMAINS

  // ── Click → fire warp ─────────────────────────────────────────────────────
  const launchWarp = useCallback((domainId) => {
    if (phase !== 'idle') return
    setSelectedId(domainId)
    setPhase('pulling')

    if (reducedMotion) {
      setTimeout(() => navigate(`/map/domains/${domainId}`), 16)
      return
    }

    // Signal DomainDetail that we're arriving via warp (sessionStorage is
    // synchronous and reliable across the route transition).
    try { sessionStorage.setItem('ss-map-warp-from', domainId) } catch {}

    setTimeout(() => {
      setPhase('warping')
      navigate(`/map/domains/${domainId}`, { state: { warpFromDomain: domainId } })
    }, WARP_PULL_MS)
  }, [phase, reducedMotion, navigate])

  // Stats
  const scenarioCount = isV2 ? scenarios.length : 0
  const ktCount       = key_trends.length
  const stCount       = sub_trends.length
  const claimCount    = claims.length
  const linkCount     = links.length

  const isWarping = phase === 'warping'

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      className="relative"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-12">

        {/* ── Editorial hero — fades out during warp ── */}
        <motion.div
          style={{
            x: heroX, y: heroY,
            opacity: phase === 'idle' ? 1 : 0,
            transition: 'opacity 0.45s ease',
          }}
          className="mb-10 sm:mb-12"
        >
          <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.04] text-cream max-w-2xl mb-4">
            Tasked With Mapping<br />Out The Future of AI?
          </h1>
          <p className="text-neutral-400 text-base leading-relaxed max-w-xl mb-6">
            Learn from top experts and their thinking on how AI will transform
            society, the economy, consumers and organizations — then turn those
            shifts into your own daring new opportunities and futures.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <MetaStat value={pad(4, 2)} label="Domains" />
            {isV2 && scenarioCount > 0 && <><Sep /><MetaStat value={pad(scenarioCount, 2)} label="Scenarios" /></>}
            <Sep />
            <MetaStat value={pad(ktCount, 2)} label="Key Trends" />
            <Sep />
            <MetaStat value={pad(stCount, 2)} label="Sub-Trends" />
            <Sep />
            <MetaStat value={pad(claimCount, 3)} label="Claims" />
            {!isV2 && linkCount > 0 && <><Sep /><MetaStat value={pad(linkCount, 3)} label="Connections" /></>}
          </div>
        </motion.div>

        {/* ── Spatial field — backdrop + dots + asymmetric cards ── */}
        <motion.div
          animate={
            isWarping && !reducedMotion
              ? { filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'] }
              : { filter: 'blur(0px)' }
          }
          transition={
            isWarping && !reducedMotion
              ? { duration: WARP_EXIT_S, ease: EASE_ACCEL, times: [0, 0.55, 1] }
              : { duration: 0.20 }
          }
          className="relative w-full"
          style={{
            minHeight: 'min(72vh, 640px)',
            willChange: 'filter',
          }}
        >
          <SpatialBackdrop />

          {/* Field gets mouse parallax (subtle) */}
          <motion.div
            style={{ x: fieldX, y: fieldY }}
            className="absolute inset-0 hidden sm:block"
          >
            <StarField
              domains={domains}
              hoveredId={hoveredId}
              selectedId={selectedId}
              phase={phase}
              reducedMotion={reducedMotion}
            />

            {/* ── Asymmetric cards — desktop only ── */}
            {domains.map((domain, i) => {
              const palette = DOMAIN_COLORS[domain.id] || DOMAIN_COLORS.society
              const spatial = DOMAIN_SPATIAL[domain.id]
              if (!spatial) return null
              const domainScenarios = scenariosByDomain[domain.id] || []
              const domainKts       = ktsByDomain[domain.id]       || []
              const hasLiveData     = isV2 && domainScenarios.length > 0

              return (
                <DomainCard
                  key={domain.id}
                  domain={{ ...domain, ...palette }}
                  spatial={spatial}
                  cardIndex={i}
                  hasLiveData={hasLiveData}
                  scenarioCount={domainScenarios.length}
                  ktCount={domainKts.length}
                  phase={phase}
                  isSelected={selectedId === domain.id}
                  isHovered={hoveredId === domain.id}
                  isOtherSelected={selectedId !== null && selectedId !== domain.id}
                  reducedMotion={reducedMotion}
                  onHoverStart={() => phase === 'idle' && setHoveredId(domain.id)}
                  onHoverEnd={()   => phase === 'idle' && setHoveredId(null)}
                  onClick={() => launchWarp(domain.id)}
                />
              )
            })}
          </motion.div>

          {/* ── Mobile fallback ── */}
          <div className="sm:hidden flex flex-col gap-4 relative">
            <StarField
              domains={domains}
              hoveredId={hoveredId}
              selectedId={selectedId}
              phase={phase}
              reducedMotion={reducedMotion}
            />
            {domains.map((domain) => {
              const palette = DOMAIN_COLORS[domain.id] || DOMAIN_COLORS.society
              const domainScenarios = scenariosByDomain[domain.id] || []
              const domainKts       = ktsByDomain[domain.id]       || []
              const hasLiveData     = isV2 && domainScenarios.length > 0

              return (
                <MobileDomainCard
                  key={domain.id}
                  domain={{ ...domain, ...palette }}
                  hasLiveData={hasLiveData}
                  scenarioCount={domainScenarios.length}
                  ktCount={domainKts.length}
                  isSelected={selectedId === domain.id}
                  isOtherSelected={selectedId !== null && selectedId !== domain.id}
                  phase={phase}
                  onClick={() => launchWarp(domain.id)}
                />
              )
            })}
          </div>
        </motion.div>

      </div>
    </motion.div>
  )
}

// ── DomainCard (desktop, asymmetric) ──────────────────────────────────────

function DomainCard({
  domain, spatial, cardIndex,
  hasLiveData, scenarioCount, ktCount,
  phase, isSelected, isHovered, isOtherSelected,
  reducedMotion,
  onHoverStart, onHoverEnd, onClick,
}) {
  // 0-G drift
  const driftDur   = DRIFT_DURATIONS[cardIndex % DRIFT_DURATIONS.length]
  const driftDelay = DRIFT_PHASES[cardIndex % DRIFT_PHASES.length]
  const a = (cardIndex * 13) % 7 - 3
  const b = (cardIndex * 17) % 5 - 2
  const driftX = [0, 5 + a, -4 + b, 0]
  const driftY = [0, -4 + b, 6 + a, 0]
  const driftEnabled = !reducedMotion && phase === 'idle'

  // Warp state targets
  let targetScale = 1, targetOpacity = 1, targetX = 0, targetY = 0
  if (phase === 'pulling') {
    if (isSelected) {
      const dx = 50 - parseFloat(spatial.card.x) - 17
      const dy = 30 - parseFloat(spatial.card.y) - 12
      targetX = `${dx}%`
      targetY = `${dy}%`
      targetScale = 1.18
    } else {
      targetScale = 0.94
      targetOpacity = 0
    }
  } else if (phase === 'warping') {
    if (isSelected) {
      const dx = 50 - parseFloat(spatial.card.x) - 17
      const dy = 30 - parseFloat(spatial.card.y) - 12
      targetX = `${dx}%`
      targetY = `${dy}%`
      targetScale = 12
      targetOpacity = 1
    } else {
      targetScale = 0.94
      targetOpacity = 0
    }
  }

  const idleScale = isHovered ? 1.04 : 1

  const stateTransition =
    phase === 'warping'
      ? { duration: WARP_EXIT_S, ease: EASE_ACCEL }
      : phase === 'pulling'
      ? { duration: WARP_PULL_MS / 1000, ease: EASE_ACCEL }
      : { duration: 0.25, ease: EASE_GENTLE }

  const animateProps = phase === 'idle'
    ? {
        opacity: 1,
        scale: idleScale,
        x: driftEnabled ? driftX : 0,
        y: driftEnabled ? driftY : 0,
      }
    : {
        opacity: targetOpacity,
        scale: targetScale,
        x: targetX,
        y: targetY,
      }

  const transitionProps = phase === 'idle'
    ? {
        opacity: { duration: 0.30 },
        scale:   { duration: 0.25, ease: EASE_GENTLE },
        x: driftEnabled
          ? { duration: driftDur, ease: EASE_DRIFT, repeat: Infinity, repeatType: 'mirror', delay: driftDelay }
          : { duration: 0.30 },
        y: driftEnabled
          ? { duration: driftDur * 1.13, ease: EASE_DRIFT, repeat: Infinity, repeatType: 'mirror', delay: driftDelay + 0.4 }
          : { duration: 0.30 },
      }
    : stateTransition

  return (
    <motion.article
      onClick={onClick}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      className="absolute cursor-pointer group rounded-xl border overflow-hidden"
      style={{
        left:   spatial.card.x,
        top:    spatial.card.y,
        width:  '34%',
        rotate: `${spatial.card.rot}deg`,
        borderColor: isHovered || isSelected
          ? `color-mix(in oklab, ${domain.color} 50%, transparent)`
          : 'var(--map-border)',
        background: isHovered || isSelected
          ? domain.soft
          : 'var(--map-surface-overlay)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'border-color 0.22s ease, background 0.22s ease',
        zIndex: isSelected ? 20 : isOtherSelected ? 1 : 5,
        willChange: 'transform, opacity',
        boxShadow: isHovered
          ? `0 18px 40px -20px color-mix(in oklab, ${domain.color} 30%, transparent), 0 8px 20px -10px rgba(0,0,0,0.6)`
          : '0 6px 18px -10px rgba(0,0,0,0.5)',
      }}
      animate={animateProps}
      transition={transitionProps}
    >
      <motion.div
        className="absolute left-0 inset-y-0 w-[3px] rounded-l-xl"
        style={{ background: domain.color }}
        animate={{ opacity: isHovered || isSelected ? 1 : 0.45 }}
        transition={{ duration: 0.22 }}
      />

      <div className="pl-6 pr-5 pt-5 pb-5">
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-mono text-[9px] uppercase tracking-widest"
            style={{ color: domain.color }}
          >
            {domain.label}
          </span>
          <span className="text-neutral-600 text-[9px] select-none" aria-hidden="true">→</span>
        </div>

        <h2 className="font-editorial text-2xl sm:text-[26px] leading-tight text-cream mb-3 group-hover:text-white transition-colors duration-200">
          {domain.name}
        </h2>

        <p className="text-sm text-neutral-400 leading-relaxed">
          {domain.short}
        </p>

        {hasLiveData && (
          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
              {pad(scenarioCount, 2)} scenarios · {pad(ktCount, 2)} key trends
            </span>
            <span
              className="font-mono text-[9px] uppercase tracking-widest"
              style={{ color: domain.color }}
            >
              Explore →
            </span>
          </div>
        )}
        {!hasLiveData && (
          <div className="mt-4 pt-3 border-t border-neutral-800/60">
            <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600">
              Scenarios generating…
            </span>
          </div>
        )}
      </div>
    </motion.article>
  )
}

// ── Mobile fallback card ───────────────────────────────────────────────────

function MobileDomainCard({
  domain,
  hasLiveData, scenarioCount, ktCount,
  isSelected, isOtherSelected, phase,
  onClick,
}) {
  const isPulling = phase !== 'idle'
  const opacity = isPulling && !isSelected ? 0 : 1
  const scale   = isSelected && phase === 'warping' ? 4 : isSelected && phase === 'pulling' ? 1.08 : 1

  return (
    <motion.article
      onClick={onClick}
      className="relative cursor-pointer rounded-xl border overflow-hidden"
      style={{
        borderColor: isSelected
          ? `color-mix(in oklab, ${domain.color} 50%, transparent)`
          : 'var(--map-border)',
        background: isSelected ? domain.soft : 'var(--map-surface-overlay)',
        zIndex: isSelected ? 20 : isOtherSelected ? 1 : 5,
      }}
      animate={{ opacity, scale }}
      transition={
        phase === 'warping'
          ? { duration: WARP_EXIT_S, ease: EASE_ACCEL }
          : { duration: 0.30, ease: EASE_GENTLE }
      }
    >
      <div className="absolute left-0 inset-y-0 w-[3px]" style={{ background: domain.color }} />
      <div className="pl-5 pr-4 py-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: domain.color }}>
            {domain.label}
          </span>
          <span className="text-neutral-600 text-[9px]" aria-hidden="true">→</span>
        </div>
        <h2 className="font-editorial text-xl text-cream mb-2 leading-tight">{domain.name}</h2>
        <p className="text-[13px] text-neutral-400 leading-relaxed">{domain.short}</p>
        {hasLiveData && (
          <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 mt-3 pt-2 border-t border-neutral-800/60">
            {pad(scenarioCount, 2)} scenarios · {pad(ktCount, 2)} key trends
          </p>
        )}
      </div>
    </motion.article>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function MetaStat({ value, label }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-sm text-cream">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">{label}</span>
    </div>
  )
}
function Sep() {
  return <span className="text-neutral-800 select-none font-mono text-xs" aria-hidden="true">·</span>
}
function pad(n, width) {
  return String(n).padStart(width, '0')
}
