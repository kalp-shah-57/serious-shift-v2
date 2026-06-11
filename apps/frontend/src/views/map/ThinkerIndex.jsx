import { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapDataContext, useMapLookup, slugify, findThinkerBySlug } from './MapDataContext'
import StickyBreadcrumb from './components/Breadcrumbs'
import { useData } from '../../hooks/useData'
import { deriveStances } from './deriveStances'
import { STAGGER_CARD, fadeUp, staggerContainer } from './motion'

/**
 * ThinkerIndex — /map/thinkers
 *
 * A flat, alphabetised list of every thinker whose work anchors the
 * evidence base. Each row links to that thinker's detail page.
 *
 * (Previous versions used a curated constellation showing ~10 thinkers;
 * for the soft launch we surface all of them.)
 */
export default function ThinkerIndex() {
  const { thinkers, by_thinker } = useMapLookup()
  // We need the raw map data (key_trends, sub_trends) for the derivation
  // helper. useMapLookup returns sanitised V2 collections; the raw context
  // value is the unmodified map.json which is fine here.
  const mapData = useContext(MapDataContext)

  // Lazy-load claims.json (24MB) — same hook ThinkerDetail already uses, so
  // the parse cost is shared across the two pages on a session.
  const { data: claimsRaw } = useData('claims.json')

  // Single derivation pass over all claims. Cheap re-runs are gated by
  // identity-stable inputs (the cached claims array and the context object).
  const { proponents, skeptics } = useMemo(
    () => deriveStances(claimsRaw, mapData),
    [claimsRaw, mapData],
  )

  // Per-thinker claim counts — same filter the profile body uses (non-dup,
  // qualifying signal). This is the count shown as "Nodes" on each card.
  // Falls back to the map.json by_thinker index while claims.json loads, so
  // the 10 originally-indexed thinkers don't briefly show 0.
  const nodesByName = useMemo(() => {
    if (!Array.isArray(claimsRaw)) return null
    const m = new Map()
    for (const c of claimsRaw) {
      if (c.duplicate_of != null) continue
      if (c.signal_strength !== 'signal' && c.signal_strength !== 'strong_signal') continue
      const n = c.thinker_name
      if (!n) continue
      m.set(n, (m.get(n) || 0) + 1)
    }
    return m
  }, [claimsRaw])

  // Compute lightweight stats per thinker, then sort alphabetically.
  const rows = thinkers
    .map(t => {
      const proponentOf = proponents.get(t.name)?.size ?? 0
      const skepticOf   = skeptics.get(t.name)?.size   ?? 0
      const nodeCount = nodesByName
        ? (nodesByName.get(t.name) || 0)
        : (by_thinker[t.name] || []).length
      return { ...t, proponentOf, skepticOf, nodeCount }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <StickyBreadcrumb crumbs={[
        { label: 'Home', to: '/map' },
        { label: 'Thinkers' },
      ]} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <motion.div
          className="mb-8 sm:mb-12"
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.05, 0.05)}
        >
          <motion.h1
            variants={fadeUp}
            className="font-editorial text-3xl sm:text-4xl text-cream mb-3"
          >
            Thinkers
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="text-neutral-400 text-sm leading-relaxed max-w-xl"
          >
            The {rows.length} thinkers whose work anchors the evidence base.
          </motion.p>
        </motion.div>

        <motion.ul
          className="divide-y divide-neutral-800/70 border-y border-neutral-800/70"
          initial="hidden"
          animate="visible"
          variants={staggerContainer(STAGGER_CARD * 0.4, 0.05)}
        >
          {rows.map(t => (
            <motion.li key={t.name} variants={fadeUp}>
              <Link
                to={`/map/thinkers/${slugify(t.name)}`}
                className="group flex items-center gap-4 py-3 sm:py-3.5 px-1 sm:px-2 hover:bg-neutral-900/30 transition-colors"
              >
                <ThinkerAvatar name={t.name} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-editorial text-base sm:text-lg leading-tight text-cream group-hover:text-white transition-colors truncate">
                    {t.name}
                  </p>
                  {t.affiliation && (
                    <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                      {t.affiliation}
                    </p>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-5 shrink-0 mr-2">
                  <Stat label="Nodes" value={t.nodeCount} />
                  <Stat label="Pro"   value={t.proponentOf} />
                  <Stat label="Skep"  value={t.skepticOf} />
                </div>
                <span
                  className="text-neutral-600 group-hover:text-neutral-400 transition-colors text-xs select-none"
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </>
  )
}

function Stat({ label, value }) {
  return (
    <div className="text-right">
      <div className="font-mono text-sm text-cream tabular-nums">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-600">
        {label}
      </div>
    </div>
  )
}

// ── ThinkerAvatar (shared export — used by ThinkerDetail & SubTrendDetail) ──

/**
 * Portrait avatar — used here and imported elsewhere.
 * `size` is either a number (px) or a preset string 'sm' | 'lg'.
 */
export function ThinkerAvatar({ name, size = 'sm' }) {
  const { thinkers } = useMapLookup()
  const meta = findThinkerBySlug(thinkers, slugifyName(name))
  const imageUrl = meta?.image_url || null

  const px = typeof size === 'number'
    ? size
    : size === 'lg' ? 96 : 40

  const sizeStyle = { width: px, height: px, minWidth: px, minHeight: px }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="rounded-full object-cover object-top shrink-0 grayscale"
        style={sizeStyle}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          if (e.currentTarget.nextSibling) {
            e.currentTarget.nextSibling.style.display = 'flex'
          }
        }}
      />
    )
  }

  const fontSize = px < 50 ? '0.7rem' : px < 80 ? '1rem' : '1.5rem'

  return (
    <div
      className="rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-mono shrink-0"
      style={{ ...sizeStyle, fontSize }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  )
}

function initials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function slugifyName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
