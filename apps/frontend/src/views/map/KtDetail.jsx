/**
 * KtDetail — /map/:domainSlug/:scenarioSlug/:ktSlug
 *
 * The third layer of the hierarchy. Renders the key trend's hero
 * (name + velocity + description + proponents/skeptics) and below it
 * a grid of the 5 sub-trends as warpable cards. Click a sub-trend →
 * warp into the reading layer.
 */
import { useParams, useNavigate } from 'react-router-dom'
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
import { paletteFor, VELOCITY_LABEL, pad } from './palette'
import { STAGGER_CARD, EASE_GENTLE } from './motion'

export default function KtDetail() {
  const { domainSlug, scenarioSlug, ktSlug: kSlug } = useParams()
  const {
    isV2, domainMap,
    subTrendsByKtId, claimsBySubTrendId,
    scenarioBySlug, ktBySlug, subSlug,
  } = useMapLookup()

  const domain   = domainMap[domainSlug]
  const scenario = scenarioBySlug(domainSlug, scenarioSlug)
  const kt       = ktBySlug(domainSlug, scenarioSlug, kSlug)
  const palette  = paletteFor(domainSlug)
  const subs     = kt ? (subTrendsByKtId[kt.id] || []) : []

  const isWarpEntry = useWarpEntry(kSlug)
  const { phase, selectedKey, launch } = useWarpExit()

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const t = entranceTiming(isWarpEntry)
  const settleStagger = STAGGER_CARD + 0.04

  if (!isV2 || !domain || !scenario || !kt) {
    return <NotFound to={`/map/${domainSlug}/${scenarioSlug || ''}`} label="key trend" />
  }

  const velocityLabel = VELOCITY_LABEL[kt.velocity] || kt.velocity || ''
  const totalClaims = subs.reduce(
    (n, st) => n + (claimsBySubTrendId[st.id] || []).length, 0
  )

  return (
    <div
      className="relative"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, color-mix(in oklab, ${palette.color} 5%, transparent) 0%, transparent 60%)`,
      }}
    >
      <WarpResolutionOverlay active={isWarpEntry} tint={palette.color} />

      <StickyBreadcrumb
        crumbs={[
          { label: 'Home', to: '/map' },
          { label: domain.name, to: `/map/${domainSlug}` },
          { label: scenario.name, to: `/map/${domainSlug}/${scenarioSlug}` },
          { label: kt.name },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16">

        {/* ── KT hero ── */}
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
              Key Trend
            </span>
            {velocityLabel && (
              <span
                className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                style={{
                  color: palette.color,
                  borderColor: `color-mix(in oklab, ${palette.color} 28%, transparent)`,
                }}
              >
                {velocityLabel}
              </span>
            )}
          </motion.div>

          <motion.h1
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.12 }}
            className="font-editorial text-3xl sm:text-4xl lg:text-5xl leading-[1.06] text-cream max-w-3xl mb-5"
          >
            {kt.name}
          </motion.h1>

          {kt.description && (
            <motion.p
              initial={HIDDEN_UP}
              animate={mounted ? VISIBLE : undefined}
              transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.19 }}
              className="text-neutral-300 text-base leading-relaxed max-w-3xl mb-6"
            >
              {kt.description}
            </motion.p>
          )}

          {(kt.proponents?.length > 0 || kt.skeptics?.length > 0) && (
            <motion.div
              initial={HIDDEN_UP}
              animate={mounted ? VISIBLE : undefined}
              transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.24 }}
              className="flex gap-x-8 gap-y-3 flex-wrap mb-6"
            >
              {kt.proponents?.length > 0 && (
                <ThinkerList label="Proponents" names={kt.proponents} accent={palette.color} />
              )}
              {kt.skeptics?.length > 0 && (
                <ThinkerList label="Skeptics" names={kt.skeptics} accent="rgb(115 115 115)" />
              )}
            </motion.div>
          )}

          <motion.div
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.30 }}
            className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
          >
            <MetaStat value={pad(subs.length, 2)} label="Sub-Trends" />
            <Sep />
            <MetaStat value={pad(totalClaims, 2)} label="Claims" />
          </motion.div>
        </div>

        {/* ── Sub-trend cards — warp on click ── */}
        <motion.h2
          initial={HIDDEN_UP}
          animate={mounted ? VISIBLE : undefined}
          transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.34 }}
          className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-4"
        >
          Sub-Trends · {pad(subs.length, 2)}
        </motion.h2>

        {subs.length === 0 ? (
          <p className="text-neutral-500 text-sm">No sub-trends for this key trend.</p>
        ) : (
          <WarpAtmosphere phase={phase}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {subs.map((st, i) => {
                const claims = claimsBySubTrendId[st.id] || []
                const stSlug = subSlug(st)
                return (
                  <motion.div
                    key={st.id}
                    initial={HIDDEN_UP}
                    animate={mounted ? VISIBLE : undefined}
                    transition={{
                      duration: t.dur,
                      ease: t.ease,
                      delay: t.base + 0.42 + i * settleStagger,
                    }}
                  >
                    <SubTrendWarpCard
                      sub={st}
                      index={i}
                      claimCount={claims.length}
                      palette={palette}
                      phase={phase}
                      isSelected={selectedKey === stSlug}
                      onLaunch={() =>
                        launch(
                          stSlug,
                          `/map/${domainSlug}/${scenarioSlug}/${kSlug}/${stSlug}`,
                        )
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

// ── SubTrendWarpCard ───────────────────────────────────────────────────────
function SubTrendWarpCard({ sub, index, claimCount, palette, phase, isSelected, onLaunch }) {
  const [hovered, setHovered] = useState(false)
  const active = hovered || isSelected

  return (
    <WarpableCard
      cardKey={sub.id}
      phase={phase}
      isSelected={isSelected}
      onClick={onLaunch}
      className="group rounded-lg border overflow-hidden relative h-full"
      style={{
        borderColor: active
          ? `color-mix(in oklab, ${palette.color} 40%, transparent)`
          : 'var(--map-border)',
        background: active
          ? `color-mix(in oklab, ${palette.color} 5%, var(--map-surface-strong))`
          : 'var(--map-surface-strong)',
        transition: 'border-color 0.22s ease, background 0.22s ease',
      }}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_GENTLE } }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="contents"
      >
        <div
          className="absolute left-0 inset-y-0 w-[2px] rounded-l-lg"
          style={{ background: palette.color, opacity: active ? 1 : 0.45 }}
        />

        <div className="pl-4 pr-3.5 pt-3.5 pb-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="font-mono text-[9px] uppercase tracking-widest tabular-nums"
              style={{ color: palette.color, opacity: 0.85 }}
            >
              ST {pad(index + 1, 2)}
            </span>
            <span className="text-neutral-600 text-[9px] select-none" aria-hidden="true">→</span>
          </div>

          <h3 className="font-editorial text-base sm:text-lg leading-snug text-cream mb-1.5 group-hover:text-white transition-colors">
            {sub.name}
          </h3>

          {sub.description && (
            <p className="text-[12.5px] text-neutral-400 leading-relaxed line-clamp-3">
              {sub.description}
            </p>
          )}

          <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
              {pad(claimCount, 2)} {claimCount === 1 ? 'claim' : 'claims'}
            </span>
            <span
              className="font-mono text-[9px] uppercase tracking-widest"
              style={{ color: palette.color }}
            >
              Read →
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
      <p className="text-[12px]" style={{ color: accent }}>
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
