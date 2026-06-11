import DomainPill from './DomainPill'
import Chip from './Chip'
import { useMapLookup } from '../MapDataContext'

/**
 * SubCard — expandable sub-trend card.
 * Shows name, description, domains, link count.
 * Expands to show connections grouped by relationship type.
 *
 * Props:
 *   sub      — sub-trend object from map.json
 *   isOpen   — controlled open state
 *   onToggle — called when header is clicked
 */

const REL_META = {
  reinforces:       { label: 'Reinforces',        color: 'text-emerald-400', border: 'border-emerald-900/50' },
  contradicts:      { label: 'Contradicts',        color: 'text-red-400',     border: 'border-red-900/50'     },
  prerequisite_for: { label: 'Prerequisite for',   color: 'text-violet-400',  border: 'border-violet-900/50'  },
  competes_with:    { label: 'Competes with',      color: 'text-amber-400',   border: 'border-amber-900/50'   },
  accelerated_by:   { label: 'Accelerated by',     color: 'text-sky-400',     border: 'border-sky-900/50'     },
}

const TIER_LABEL = {
  sub_trend: 'Sub-trend',
  key_trend: 'Key Trend',
  macro:     'Scenario',
}

function resolveEntity(type, id, { stByDbId, ktByDbId, macroByDbId }) {
  if (type === 'sub_trend') return stByDbId[id]    || null
  if (type === 'key_trend') return ktByDbId[id]    || null
  if (type === 'macro')     return macroByDbId[id] || null
  return null
}

export default function SubCard({ sub, isOpen, onToggle }) {
  const { linksByStDbId, stByDbId, ktByDbId, macroByDbId } = useMapLookup()
  const links  = sub.db_id != null ? (linksByStDbId[sub.db_id] || []) : []
  const domains = sub.domains || []

  // Top 1-2 connections by strength (highest first) for the inline preview
  const topLinks = [...links]
    .sort((a, b) => (b.strength || 0) - (a.strength || 0))
    .slice(0, 2)
    .map(link => {
      const isSource  = link.source_type === 'sub_trend' && link.source_id === sub.db_id
      const otherType = isSource ? link.target_type : link.source_type
      const otherId   = isSource ? link.target_id   : link.source_id
      const entity    = resolveEntity(otherType, otherId, { stByDbId, ktByDbId, macroByDbId })
      return { link, entity }
    })

  // Group by relationship type
  const grouped = {}
  for (const link of links) {
    const rel = link.relationship
    if (!grouped[rel]) grouped[rel] = []
    grouped[rel].push(link)
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${isOpen ? 'border-neutral-700' : 'border-neutral-800'}`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={links.length > 0 ? onToggle : undefined}
        className={`w-full text-left p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
          links.length > 0
            ? 'bg-neutral-900/40 hover:bg-neutral-900/70 cursor-pointer'
            : 'bg-neutral-900/30 cursor-default'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Chip kind="sub">Sub-trend</Chip>
            {links.length > 0 && (
              <span className="font-mono text-[9px] tracking-widest uppercase text-neutral-500 border border-neutral-800 rounded px-1.5 py-0.5">
                {links.length} connection{links.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h4 className="font-editorial text-base sm:text-lg leading-snug text-cream mb-1">
            {sub.name}
          </h4>
          {sub.description && (
            <p className={`text-xs text-neutral-500 leading-relaxed ${isOpen ? '' : 'line-clamp-2'}`}>
              {sub.description}
            </p>
          )}
          {domains.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {domains.map(d => <DomainPill key={d} domain={d} size="xs" />)}
            </div>
          )}

          {/* Inline connection preview — hidden when panel is open */}
          {!isOpen && topLinks.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 shrink-0">
                Connects to
              </span>
              {topLinks.map(({ link, entity }, i) => {
                const meta = REL_META[link.relationship] || { label: link.relationship, color: 'text-neutral-400' }
                return (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px]">
                    {i > 0 && <span className="text-neutral-700 select-none">·</span>}
                    <span className="text-neutral-300 font-medium leading-none">
                      {entity?.name || `#${link.source_type === 'sub_trend' && link.source_id === sub.db_id ? link.target_id : link.source_id}`}
                    </span>
                    <span className={`font-mono text-[8px] uppercase tracking-wider ${meta.color} leading-none`}>
                      ({meta.label})
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
        {links.length > 0 && (
          <span className="text-neutral-600 shrink-0 mt-1 text-[10px] select-none">
            {isOpen ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Expanded connection panel */}
      {isOpen && links.length > 0 && (
        <div className="border-t border-neutral-800 bg-neutral-950/60 p-4 sm:p-5 space-y-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600">
            Connections · {links.length} total
          </p>
          {Object.entries(grouped).map(([relType, relLinks]) => {
            const meta = REL_META[relType] || { label: relType, color: 'text-neutral-400', border: 'border-neutral-800' }
            return (
              <div key={relType}>
                <span className={`font-mono text-[9px] uppercase tracking-widest ${meta.color} block mb-2`}>
                  {meta.label} ({relLinks.length})
                </span>
                <div className="space-y-2">
                  {relLinks.map((link, i) => {
                    const isSource  = link.source_type === 'sub_trend' && link.source_id === sub.db_id
                    const otherType = isSource ? link.target_type : link.source_type
                    const otherId   = isSource ? link.target_id   : link.source_id
                    const entity    = resolveEntity(otherType, otherId, { stByDbId, ktByDbId, macroByDbId })
                    const tierLabel = TIER_LABEL[otherType] || otherType

                    return (
                      <div
                        key={i}
                        className={`text-xs border ${meta.border} rounded p-3 bg-neutral-900/30`}
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <span className="font-mono text-[8px] uppercase tracking-widest text-neutral-600 shrink-0 mt-0.5 w-14">
                            {tierLabel}
                          </span>
                          <span className="text-neutral-300 leading-snug font-medium">
                            {entity?.name || `#${otherId}`}
                          </span>
                        </div>
                        {link.reasoning && (
                          <p className="text-neutral-500 leading-relaxed text-[11px] mt-1">
                            {link.reasoning}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
