/**
 * SubTrendDetail — /map/:domainSlug/:scenarioSlug/:ktSlug/:subTrendSlug
 *
 * The leaf of the hierarchy. This is the reading layer — minimal motion,
 * calm and fixed. Claims are listed inline with full thinker attribution,
 * portrait, source title, and a link to the thinker's profile page.
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useMapLookup, slugify } from './MapDataContext'
import StickyBreadcrumb from './components/Breadcrumbs'
import { ThinkerAvatar } from './ThinkerIndex'
import {
  useWarpEntry,
  WarpResolutionOverlay,
  HIDDEN_UP, VISIBLE, PAGE_EXIT,
  entranceTiming,
} from './warp'
import { paletteFor, pad } from './palette'

const SIGNAL_LABEL = {
  strong_signal: 'Strong',
  signal:        'Signal',
  background:    'Background',
  noise:         'Noise',
}

export default function SubTrendDetail() {
  const { domainSlug, scenarioSlug, ktSlug, subTrendSlug } = useParams()
  const {
    isV2, domainMap, thinkerByName,
    scenarioBySlug, ktBySlug, subTrendBySlug, claimsForSubTrend,
  } = useMapLookup()

  const domain   = domainMap[domainSlug]
  const scenario = scenarioBySlug(domainSlug, scenarioSlug)
  const kt       = ktBySlug(domainSlug, scenarioSlug, ktSlug)
  const sub      = subTrendBySlug(domainSlug, scenarioSlug, ktSlug, subTrendSlug)
  const palette  = paletteFor(domainSlug)

  const isWarpEntry = useWarpEntry(subTrendSlug)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const t = entranceTiming(isWarpEntry)

  if (!isV2 || !domain || !scenario || !kt || !sub) {
    return (
      <NotFound
        to={`/map/${domainSlug}/${scenarioSlug}/${ktSlug || ''}`}
        label="sub-trend"
      />
    )
  }

  const claims = claimsForSubTrend(sub.id)
  const uniqueThinkers = new Set(claims.map(c => c.thinker).filter(Boolean))
  const uniqueSources  = new Set(claims.map(c => c.source_title).filter(Boolean))

  return (
    <div
      className="relative"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, color-mix(in oklab, ${palette.color} 4%, transparent) 0%, transparent 60%)`,
      }}
    >
      <WarpResolutionOverlay active={isWarpEntry} tint={palette.color} />

      <StickyBreadcrumb
        crumbs={[
          { label: 'Home', to: '/map' },
          { label: domain.name,   to: `/map/${domainSlug}` },
          { label: scenario.name, to: `/map/${domainSlug}/${scenarioSlug}` },
          { label: kt.name,       to: `/map/${domainSlug}/${scenarioSlug}/${ktSlug}` },
          { label: sub.name },
        ]}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">

        {/* ── Sub-trend hero — calmer than upstream layers ── */}
        <div className="mb-10 sm:mb-12">
          {/* Tier-indicator chip. The parent KT name used to live here too
              ("Sub-Trend · {kt.name}") but is redundant with the breadcrumb,
              so we only keep the type label. Matches the chip pattern on
              Scenario / KT detail pages. */}
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
              Sub-Trend
            </span>
          </motion.div>

          <motion.h1
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.12 }}
            className="font-editorial text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.08] text-cream mb-5"
          >
            {sub.name}
          </motion.h1>

          {sub.description && (
            <motion.p
              initial={HIDDEN_UP}
              animate={mounted ? VISIBLE : undefined}
              transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.19 }}
              className="text-neutral-300 text-[15px] sm:text-base leading-relaxed mb-6"
            >
              {sub.description}
            </motion.p>
          )}

          <motion.div
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.26 }}
            className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
          >
            <MetaStat value={pad(claims.length, 2)} label="Claims" />
            <Sep />
            <MetaStat value={pad(uniqueThinkers.size, 2)} label="Thinkers" />
            <Sep />
            <MetaStat value={pad(uniqueSources.size, 2)} label="Sources" />
          </motion.div>
        </div>

        {/* ── Claims list — reading layer ── */}
        <motion.h2
          initial={HIDDEN_UP}
          animate={mounted ? VISIBLE : undefined}
          transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.30 }}
          className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-5"
        >
          Evidence · {pad(claims.length, 2)} {claims.length === 1 ? 'claim' : 'claims'}
        </motion.h2>

        {claims.length === 0 ? (
          <p className="text-neutral-500 text-sm">No claims recorded for this sub-trend.</p>
        ) : (
          <motion.ul
            initial={HIDDEN_UP}
            animate={mounted ? VISIBLE : undefined}
            transition={{ duration: t.dur, ease: t.ease, delay: t.base + 0.36 }}
            className="space-y-5"
          >
            {claims.map(claim => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                accent={palette.color}
                thinkerSlug={claim.thinker ? slugify(claim.thinker) : null}
                thinkerKnown={!!thinkerByName[claim.thinker]}
              />
            ))}
          </motion.ul>
        )}
      </div>
    </div>
  )
}

// ── ClaimRow ───────────────────────────────────────────────────────────────
function ClaimRow({ claim, accent, thinkerSlug, thinkerKnown }) {
  const credibility = claim.thinker_credibility
  const showCred = typeof credibility === 'number' && !Number.isNaN(credibility)
  const signalLabel = SIGNAL_LABEL[claim.signal_strength]

  return (
    <li
      className="border rounded-lg p-4 sm:p-5"
      style={{
        borderColor: 'var(--map-border)',
        background: 'var(--map-surface-strong)',
      }}
    >
      <div className="flex items-start gap-4">
        {claim.thinker && (
          <div className="shrink-0">
            <ThinkerAvatar name={claim.thinker} size={44} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[15px] sm:text-base leading-relaxed text-neutral-100">
            {claim.text}
          </p>

          <div className="mt-3 flex items-baseline flex-wrap gap-x-2 gap-y-1 text-[11px] text-neutral-500">
            {claim.thinker && (
              thinkerKnown && thinkerSlug ? (
                <Link
                  to={`/map/thinkers/${thinkerSlug}`}
                  className="text-neutral-200 font-medium hover:text-cream transition-colors"
                  style={{ borderBottom: `1px dashed color-mix(in oklab, ${accent} 40%, transparent)` }}
                >
                  {claim.thinker}
                </Link>
              ) : (
                <span className="text-neutral-200 font-medium">{claim.thinker}</span>
              )
            )}
            {showCred && (
              <span
                className="font-mono tabular-nums tracking-tight"
                style={{ color: accent }}
                title={`Credibility score: ${credibility.toFixed(1)}`}
              >
                {credibility.toFixed(1)}
              </span>
            )}
            {(claim.thinker || showCred) && claim.source_title && <Dot />}
            {claim.source_title && (
              <span className="text-neutral-400 italic truncate max-w-[40ch]">
                {claim.source_title}
              </span>
            )}
            {claim.source_date && (
              <>
                <Dot />
                <span className="font-mono text-[10px] text-neutral-600">
                  {formatDate(claim.source_date)}
                </span>
              </>
            )}
            {signalLabel && (
              <>
                <Dot />
                <span
                  className="font-mono uppercase tracking-widest text-[9px]"
                  style={{
                    color: claim.signal_strength === 'strong_signal'
                      ? accent
                      : 'rgb(115 115 115)',
                  }}
                >
                  {signalLabel}
                </span>
              </>
            )}
          </div>

          {claim.consumer_implication && (
            <div
              className="mt-3 pt-3 border-t text-[12.5px] text-neutral-400 leading-relaxed"
              style={{ borderColor: 'rgba(64, 64, 64, 0.4)' }}
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mr-1.5">
                Consumer impact
              </span>
              {claim.consumer_implication}
            </div>
          )}
        </div>
      </div>
    </li>
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

function Dot() {
  return <span className="text-neutral-700 select-none" aria-hidden="true">·</span>
}

function formatDate(s) {
  if (!s) return ''
  const m = String(s).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  if (!m) return s
  const [, y, mm, dd] = m
  if (dd) return `${y}-${mm}-${dd}`
  if (mm) return `${y}-${mm}`
  return y
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
