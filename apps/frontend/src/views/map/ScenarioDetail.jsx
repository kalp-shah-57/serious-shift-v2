/**
 * ScenarioDetail — /map/:domainSlug/:scenarioSlug
 *
 * Cinematic destination for a scenario clicked on the domain page. Hero
 * shows the scenario, then the four key trends below render as warpable
 * cards — clicking one fires the warp into the KT page.
 */
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useMapLookup } from './MapDataContext'
import StickyBreadcrumb from './components/Breadcrumbs'
import {
  useWarpEntry, useWarpExit,
  WarpResolutionOverlay, WarpAtmosphere, WarpableCard,
  HIDDEN_UP, VISIBLE, PAGE_EXIT,
  entranceTiming,
} from './warp'
import { paletteFor, HORIZON_LABELS, VELOCITY_LABEL, pad } from './palette'
import { STAGGER_CARD, EASE_GENTLE } from './motion'

export default function ScenarioDetail() {
  const { domainSlug, scenarioSlug: scnSlug } = useParams()
  const {
    isV2, domainMap,
    ktsByScenarioId, subTrendsByKtId,
    scenarioBySlug, ktSlug,
  } = useMapLookup()

  const domain   = domainMap[domainSlug]
  const scenario = scenarioBySlug(domainSlug, scnSlug)
  const palette  = paletteFor(domainSlug)
  const kts      = scenario ? (ktsByScenarioId[scenario.id] || []) : []

  const isWarpEntry = useWarpEntry(scnSlug)
  const { phase, selectedKey, launch } = useWarpExit()

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const t = entranceTiming(isWarpEntry)
  const settleStagger = STAGGER_CARD + 0.04

  if (!isV2 || !domain || !scenario) {
    return <NotFound to={`/map/${domainSlug || ''}`} label="domain" />
  }

  const horizonLabel = HORIZON_LABELS[scenario.horizon] || scenario.horizon || ''
  const totalSubs = kts.reduce((n, kt) => n + (subTrendsByKtId[kt.id] || []).length, 0)

  return (
    <div
      className="relative"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, color-mix(in oklab, ${palette.color} 6%, transparent) 0%, transparent 60%)`,
      }}
    >
      <WarpResolutionOverlay active={isWarpEntry} tint={palette.color} />

      <StickyBreadcrumb
        crumbs={[
          { label: 'Home', to: '/map' },
          { label: domain.name, to: `/map/${domainSlug}` },
          { label: scenario.name },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16">

        {/* ── Scenario hero ── */}
        <div className="mb-12 sm:mb-16">
          <motion.div
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.05 }}
            className="flex items-center gap-2 mb-3 flex-wrap"
          >
            <span
              className="font-mono text-[9px] uppercase tracking-widest"
              style={{ color: palette.color }}
            >
              Scenario
            </span>
            {horizonLabel && (
              <span
                className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                style={{
                  color: palette.color,
                  borderColor: `color-mix(in oklab, ${palette.color} 28%, transparent)`,
                }}
              >
                {horizonLabel}
              </span>
            )}
            {scenario.plausibility && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
                {scenario.plausibility}
              </span>
            )}
          </motion.div>

          <motion.h1
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.12 }}
            className="font-editorial text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.04] text-cream max-w-3xl mb-5"
          >
            {scenario.name}
          </motion.h1>

          <motion.p
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.19 }}
            className="text-neutral-300 text-base sm:text-[17px] leading-relaxed max-w-3xl mb-6"
          >
            {scenario.description}
          </motion.p>

          {(scenario.proponents?.length > 0 || scenario.skeptics?.length > 0) && (
            <motion.div
              initial={HIDDEN_UP}
              animate={mounted ? VISIBLE : undefined}
              transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.24 }}
              className="flex gap-x-8 gap-y-3 flex-wrap mb-6"
            >
              {scenario.proponents?.length > 0 && (
                <ThinkerList
                  label="Proponents"
                  names={scenario.proponents}
                  accent={palette.color}
                />
              )}
              {scenario.skeptics?.length > 0 && (
                <ThinkerList
                  label="Skeptics"
                  names={scenario.skeptics}
                  accent="rgb(115 115 115)"
                />
              )}
            </motion.div>
          )}

          <motion.div
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.30 }}
            className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
          >
            <MetaStat value={pad(kts.length, 2)} label="Key Trends" />
            <Sep />
            <MetaStat value={pad(totalSubs, 2)} label="Sub-Trends" />
          </motion.div>
        </div>

        {/* ── KT cards — warp on click ── */}
        <motion.h2
          initial={HIDDEN_UP}
          animate={mounted ? VISIBLE : undefined}
          transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.34 }}
          className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-4"
        >
          Key Trends · {pad(kts.length, 2)}
        </motion.h2>

        {kts.length === 0 ? (
          <p className="text-neutral-500 text-sm">No key trends yet for this scenario.</p>
        ) : (
          <WarpAtmosphere phase={phase}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {kts.map((kt, i) => {
                const subs  = subTrendsByKtId[kt.id] || []
                const kSlug = ktSlug(kt)
                return (
                  <motion.div
                    key={kt.id}
                    initial={HIDDEN_UP}
                    animate={mounted ? VISIBLE : undefined}
                    transition={{
                      duration: t.dur,
                      ease: t.ease,
                      delay: t.base + 0.42 + i * settleStagger,
                    }}
                  >
                    <KtWarpCard
                      kt={kt}
                      index={i}
                      subCount={subs.length}
                      palette={palette}
                      phase={phase}
                      isSelected={selectedKey === kSlug}
                      onLaunch={() =>
                        launch(kSlug, `/map/${domainSlug}/${scnSlug}/${kSlug}`)
                      }
                    />
                  </motion.div>
                )
              })}
            </div>
          </WarpAtmosphere>
        )}
      </div>
    </div>
  )
}

// ── KtWarpCard ─────────────────────────────────────────────────────────────
function KtWarpCard({ kt, index, subCount, palette, phase, isSelected, onLaunch }) {
  const [hovered, setHovered] = useState(false)
  const active = hovered || isSelected
  const velocityLabel = VELOCITY_LABEL[kt.velocity] || kt.velocity || ''

  return (
    <WarpableCard
      cardKey={kt.id}
      phase={phase}
      isSelected={isSelected}
      onClick={onLaunch}
      className="group rounded-xl border overflow-hidden relative h-full"
      style={{
        borderColor: active
          ? `color-mix(in oklab, ${palette.color} 45%, transparent)`
          : 'var(--map-border)',
        background: active ? palette.soft : 'var(--map-surface-strong)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'border-color 0.22s ease, background 0.22s ease',
        boxShadow: hovered
          ? `0 14px 32px -18px color-mix(in oklab, ${palette.color} 26%, transparent), 0 6px 16px -8px rgba(0,0,0,0.55)`
          : '0 4px 14px -8px rgba(0,0,0,0.45)',
      }}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_GENTLE } }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="contents"
      >
        <div
          className="absolute left-0 inset-y-0 w-[3px] rounded-l-xl"
          style={{ background: palette.color, opacity: active ? 1 : 0.5 }}
        />

        <div className="pl-5 pr-4 pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[9px] uppercase tracking-widest tabular-nums"
                style={{ color: palette.color, opacity: 0.85 }}
              >
                KT {pad(index + 1, 2)}
              </span>
              {velocityLabel && (
                <span
                  className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                  style={{
                    color: palette.color,
                    borderColor: `color-mix(in oklab, ${palette.color} 25%, transparent)`,
                  }}
                >
                  {velocityLabel}
                </span>
              )}
            </div>
            <span className="text-neutral-600 text-[9px] select-none" aria-hidden="true">→</span>
          </div>

          <h3 className="font-editorial text-lg sm:text-xl leading-tight text-cream mb-2 group-hover:text-white transition-colors">
            {kt.name}
          </h3>

          {kt.description && (
            <p className="text-[13px] text-neutral-400 leading-relaxed line-clamp-2">
              {kt.description}
            </p>
          )}

          <div className="mt-3 pt-2.5 border-t border-neutral-800/60 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
              {pad(subCount, 2)} sub-trends
            </span>
            <span
              className="font-mono text-[9px] uppercase tracking-widest"
              style={{ color: palette.color }}
            >
              Enter →
            </span>
          </div>
        </div>
      </div>
    </WarpableCard>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ThinkerList({ label, names, accent }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-1">
        {label}
      </p>
      <p className="text-[12px] text-neutral-300" style={{ color: accent }}>
        {names.join(' · ')}
      </p>
    </div>
  )
}

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

function NotFound({ to, label }) {
  const navigate = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={PAGE_EXIT}
      className="max-w-2xl mx-auto px-4 pt-16 pb-24 text-center"
    >
      <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 mb-3">
        Not found
      </p>
      <h1 className="font-editorial text-3xl text-cream mb-6">
        Couldn't find that {label}.
      </h1>
      <button
        type="button"
        onClick={() => navigate(to)}
        className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        ← Back
      </button>
    </motion.div>
  )
}
