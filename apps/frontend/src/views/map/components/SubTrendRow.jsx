/**
 * SubTrendRow — third level of the hierarchy.
 *
 * Renders a sub-trend row inside a KT. Header shows name + description +
 * claim count. Click expands to reveal up to N claim items, with a
 * "show more" affordance if there are more claims than fit.
 *
 * Props:
 *   subTrend — sub-trend object (id, name, description, claim_ids[])
 *   claims   — pre-resolved array of claim objects (from claimsBySubTrendId)
 *   palette  — domain palette ({ color, soft })
 *   index    — 0-based position within its parent KT (for the row numeral)
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE_WARP } from '../motion'
import ClaimItem from './ClaimItem'

const INITIAL_CLAIMS_SHOWN = 6

export default function SubTrendRow({ subTrend, claims, palette, index }) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const total = claims.length
  const visibleClaims = showAll ? claims : claims.slice(0, INITIAL_CLAIMS_SHOWN)
  const moreCount = total - INITIAL_CLAIMS_SHOWN

  const hasClaims = total > 0

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{
        borderColor: expanded
          ? `color-mix(in oklab, ${palette.color} 30%, var(--map-border))`
          : 'var(--map-border)',
        background: expanded
          ? `color-mix(in oklab, ${palette.color} 4%, transparent)`
          : 'transparent',
        transition: 'border-color 0.20s ease, background 0.20s ease',
      }}
    >
      <button
        type="button"
        onClick={hasClaims ? () => setExpanded(p => !p) : undefined}
        className={`w-full text-left px-3.5 py-2.5 flex items-start gap-3 ${
          hasClaims ? 'cursor-pointer hover:bg-neutral-900/40' : 'cursor-default'
        } transition-colors`}
        aria-expanded={expanded}
      >
        <span
          className="font-mono text-[8px] mt-[5px] shrink-0 tabular-nums"
          style={{ color: palette.color, opacity: 0.7 }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="font-editorial text-[15px] sm:text-base leading-snug text-cream">
              {subTrend.name}
            </h4>
            {hasClaims && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 shrink-0">
                {String(total).padStart(2, '0')} {total === 1 ? 'claim' : 'claims'}
              </span>
            )}
          </div>
          {subTrend.description && (
            <p className={`text-[12.5px] text-neutral-400 leading-relaxed mt-0.5 ${expanded ? '' : 'line-clamp-2'}`}>
              {subTrend.description}
            </p>
          )}
        </div>

        {hasClaims && (
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.20 }}
            className="text-neutral-600 text-[9px] select-none shrink-0 mt-1"
            aria-hidden="true"
          >
            ▼
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && hasClaims && (
          <motion.div
            key="claims"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE_WARP }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 pt-1 space-y-2.5 border-t border-neutral-800/60">
              {visibleClaims.map(claim => (
                <ClaimItem key={claim.id} claim={claim} accent={palette.color} />
              ))}
              {!showAll && moreCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowAll(true) }}
                  className="font-mono text-[9px] uppercase tracking-widest hover:underline mt-1"
                  style={{ color: palette.color }}
                >
                  Show {moreCount} more {moreCount === 1 ? 'claim' : 'claims'} →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
