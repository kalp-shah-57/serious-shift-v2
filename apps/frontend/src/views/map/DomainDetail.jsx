/**
 * DomainDetail — /map/:domainSlug (also matches the legacy
 * /map/domains/:domainId for back-compat).
 *
 * Renders the key trends for a domain as warpable cards. Clicking a card
 * fires the cinematic warp transition and navigates to the key-trend page
 * (/map/:domainSlug/:ktSlug) — siblings fade out, the selected card scales
 * toward the camera, then the route changes mid-transition. Below the cards,
 * the domain's AI-synthesised patterns close the page.
 *
 * Arriving via warp from MapLanding shows the destination radial-gradient
 * overlay; content fades up underneath after the overlay clears.
 */
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useMapLookup } from './MapDataContext'
import {
  useWarpEntry, useWarpExit,
  WarpResolutionOverlay, WarpAtmosphere, WarpableCard,
  HIDDEN_UP, VISIBLE, PAGE_EXIT,
  entranceTiming,
} from './warp'
import { paletteFor, VELOCITY_LABEL, pad } from './palette'
import { STAGGER_CARD, EASE_GENTLE } from './motion'

export default function DomainDetail() {
  // Accept both the new `:domainSlug` param and the legacy `:domainId` param.
  const params = useParams()
  const domainId = params.domainSlug || params.domainId
  const {
    isV2, domainMap, ktsByDomain, ktsByDomainId,
    subTrendsByKtId, insightsByDomain, ktSlug,
  } = useMapLookup()

  const domain   = domainMap[domainId]
  const palette  = paletteFor(domainId)
  // Prefer the domain's explicit ordered key_trend_ids; fall back to the
  // domain_id-keyed grouping if that list is absent.
  const kts = (ktsByDomainId[domainId]?.length ? ktsByDomainId[domainId] : ktsByDomain[domainId]) || []
  const insights = insightsByDomain[domainId] || []

  const isWarpEntry = useWarpEntry(domainId)
  const { phase, selectedKey, launch } = useWarpExit()

  // Mount-trigger so FM 12 + R19 entrance animations actually fire on
  // route navigation (without this they stall at initial state).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const t = entranceTiming(isWarpEntry)

  // ── No data yet ───────────────────────────────────────────────────────────
  if (!isV2 || !domain) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={PAGE_EXIT}
        className="max-w-2xl mx-auto px-4 pt-16 pb-24 text-center"
      >
        <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 mb-3">
          AI × {domainId || 'domain'}
        </p>
        <h1 className="font-editorial text-3xl text-cream mb-4">
          Key Trends generating…
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed mb-8">
          The domain-first generator hasn't run yet.
        </p>
        <Link
          to="/map"
          className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Back to overview
        </Link>
      </motion.div>
    )
  }

  const totalSubs = kts.reduce((n, kt) => n + (subTrendsByKtId[kt.id] || []).length, 0)
  const settleStagger = STAGGER_CARD + 0.04

  return (
    <div
      className="relative"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, color-mix(in oklab, ${palette.color} 6%, transparent) 0%, transparent 60%)`,
      }}
    >
      <WarpResolutionOverlay active={isWarpEntry} tint={palette.color} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16">

        {/* ── Domain hero ── */}
        <div className="mb-12 sm:mb-16">
          {/* In-page breadcrumb — replaces the old sticky "Overview › X" bar
              and the "AI × X / WORLD" eyebrow with a single per-domain-colored
              "Home › Domain" trail. "Home" routes back to the map landing. */}
          <motion.nav
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.05 }}
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 mb-3 font-mono text-xs uppercase tracking-widest"
            style={{ color: palette.color }}
          >
            <Link
              to="/map"
              className="hover:underline underline-offset-4 transition-opacity hover:opacity-80"
              style={{ color: palette.color }}
            >
              Home
            </Link>
            <span aria-hidden="true" style={{ opacity: 0.6 }}>›</span>
            <span aria-current="page">{domain.name}</span>
          </motion.nav>

          <motion.h1
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.12 }}
            className="font-editorial text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.04] text-cream max-w-3xl mb-4"
          >
            {domain.name}
          </motion.h1>

          <motion.p
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.19 }}
            className="text-neutral-400 text-base leading-relaxed max-w-xl mb-6"
          >
            {domain.short_description || domain.description}
          </motion.p>

          <motion.div
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.26 }}
            className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
          >
            <MetaStat value={pad(kts.length, 2)} label="Key Trends" />
            <Sep />
            <MetaStat value={pad(totalSubs, 2)} label="Sub-Trends" />
          </motion.div>
        </div>

        {/* ── Key Trend cards — warp-into-page on click ── */}
        {kts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-2">
              No key trends yet
            </p>
          </div>
        ) : (
          <WarpAtmosphere phase={phase}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
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
                      delay: t.base + 0.34 + i * settleStagger,
                    }}
                  >
                    <KtWarpCard
                      kt={kt}
                      subCount={subs.length}
                      palette={palette}
                      phase={phase}
                      isSelected={selectedKey === kSlug}
                      onLaunch={() => launch(kSlug, `/map/${domainId}/${kSlug}`)}
                    />
                  </motion.div>
                )
              })}
            </div>
          </WarpAtmosphere>
        )}

        {/* ── AI-synthesised patterns — domain closing section ── */}
        {insights.length > 0 && (
          <motion.section
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.5 }}
            className="mt-16 sm:mt-20"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-neutral-800/80" />
              <span
                className="font-mono text-[9px] uppercase tracking-widest shrink-0 px-1"
                style={{ color: palette.color }}
              >
                AI-Synthesised Patterns · {pad(insights.length, 2)}
              </span>
              <div className="h-px flex-1 bg-neutral-800/80" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map(ins => (
                <article
                  key={ins.id}
                  className="border rounded-lg p-5 sm:p-6"
                  style={{ borderColor: 'var(--map-border)', background: 'var(--map-surface-strong)' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-editorial text-lg leading-snug text-cream">{ins.name}</h3>
                    <span className="font-mono text-[8px] uppercase tracking-widest border border-violet-900/60 text-violet-500 rounded px-1.5 py-0.5 shrink-0">
                      AI
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 leading-relaxed">{ins.description}</p>
                  {ins.contributing_claim_ids?.length > 0 && (
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mt-3 pt-3 border-t border-neutral-800/60">
                      {ins.contributing_claim_ids.length} supporting claim{ins.contributing_claim_ids.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  )
}

// ── KtWarpCard — a key trend rendered as a warpable card ───────────────────
function KtWarpCard({ kt, subCount, palette, phase, isSelected, onLaunch }) {
  const [hovered, setHovered] = useState(false)
  const velocityLabel = VELOCITY_LABEL[kt.velocity] || kt.velocity || ''
  const active = hovered || isSelected

  return (
    <WarpableCard
      cardKey={kt.id}
      phase={phase}
      isSelected={isSelected}
      onClick={onLaunch}
      className="group rounded-xl border overflow-hidden relative h-full"
      style={{
        borderColor: active
          ? `color-mix(in oklab, ${palette.color} 50%, transparent)`
          : 'var(--map-border)',
        background: active ? palette.soft : 'var(--map-surface-overlay)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'border-color 0.22s ease, background 0.22s ease',
        boxShadow: hovered
          ? `0 18px 40px -20px color-mix(in oklab, ${palette.color} 30%, transparent), 0 8px 20px -10px rgba(0,0,0,0.6)`
          : '0 6px 18px -10px rgba(0,0,0,0.5)',
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

        <div className="pl-6 pr-5 pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: palette.color }}>
              Key Trend
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

          <h2 className="font-editorial text-xl sm:text-2xl leading-tight text-cream mb-2 group-hover:text-white transition-colors">
            {kt.name}
          </h2>

          {kt.subtitle && (
            <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3">
              {kt.subtitle}
            </p>
          )}

          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between">
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
