/**
 * KtCard — second level of the hierarchy.
 *
 * Renders a Key Trend within an expanded scenario. Header shows name,
 * description, velocity tag, and sub-trend count. Click expands to reveal
 * sub-trends (each of which can further expand to show claims).
 *
 * Props:
 *   kt          — key-trend object (id, name, description, velocity, sub_trend_ids[])
 *   subTrends   — pre-resolved sub-trend objects for this KT
 *   palette     — domain palette ({ color, soft })
 *   index       — 0-based position within its parent scenario (for the row numeral)
 *   claimsBySub — lookup map { [subTrendId]: claim[] }
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE_WARP } from '../motion'
import SubTrendRow from './SubTrendRow'

const VELOCITY_LABEL = {
  accelerating:    'Accelerating',
  steady:          'Steady',
  decelerating:    'Decelerating',
  emergent:        'Emergent',
  early:           'Early',
  mature:          'Mature',
}

export default function KtCard({ kt, subTrends, palette, index, claimsBySub }) {
  const [expanded, setExpanded] = useState(false)

  const subCount = subTrends.length
  const hasSubTrends = subCount > 0
  const velocityLabel = VELOCITY_LABEL[kt.velocity] || kt.velocity || ''

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: expanded
          ? `color-mix(in oklab, ${palette.color} 35%, var(--map-border))`
          : 'var(--map-border)',
        background: expanded ? palette.soft : 'var(--map-surface)',
        transition: 'border-color 0.22s ease, background 0.22s ease',
      }}
    >
      <button
        type="button"
        onClick={hasSubTrends ? () => setExpanded(p => !p) : undefined}
        className={`w-full text-left p-4 sm:p-4 flex items-start gap-3.5 ${
          hasSubTrends ? 'cursor-pointer hover:bg-neutral-900/40' : 'cursor-default'
        } transition-colors`}
        aria-expanded={expanded}
      >
        {/* Left accent bar */}
        <span
          className="block w-[2px] self-stretch rounded-full shrink-0 mt-0.5"
          style={{
            background: palette.color,
            opacity: expanded ? 1 : 0.55,
          }}
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="font-mono text-[9px] uppercase tracking-widest tabular-nums"
              style={{ color: palette.color, opacity: 0.75 }}
            >
              KT {String(index + 1).padStart(2, '0')}
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
            {hasSubTrends && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 ml-auto">
                {String(subCount).padStart(2, '0')} sub-trends
              </span>
            )}
          </div>

          <h3 className="font-editorial text-lg sm:text-xl leading-tight text-cream mb-1">
            {kt.name}
          </h3>

          {kt.description && (
            <p className={`text-[13px] text-neutral-400 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
              {kt.description}
            </p>
          )}
        </div>

        {hasSubTrends && (
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.22 }}
            className="text-neutral-600 text-[9px] select-none shrink-0 mt-1.5"
            aria-hidden="true"
          >
            ▼
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && hasSubTrends && (
          <motion.div
            key="subs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.30, ease: EASE_WARP }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2 border-t border-neutral-800/60">
              {subTrends.map((st, i) => (
                <SubTrendRow
                  key={st.id}
                  subTrend={st}
                  claims={claimsBySub[st.id] || []}
                  palette={palette}
                  index={i}
                />
              ))}
              {/* Optional KT-level proponents / skeptics */}
              {(kt.proponents?.length > 0 || kt.skeptics?.length > 0) && (
                <div className="mt-3 pt-3 border-t border-neutral-800/40 flex gap-6 flex-wrap text-[11px]">
                  {kt.proponents?.length > 0 && (
                    <div>
                      <p className="font-mono text-[8px] uppercase tracking-widest text-neutral-600 mb-0.5">
                        Proponents
                      </p>
                      <p className="text-neutral-400">{kt.proponents.join(', ')}</p>
                    </div>
                  )}
                  {kt.skeptics?.length > 0 && (
                    <div>
                      <p className="font-mono text-[8px] uppercase tracking-widest text-neutral-600 mb-0.5">
                        Skeptics
                      </p>
                      <p className="text-neutral-400">{kt.skeptics.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
