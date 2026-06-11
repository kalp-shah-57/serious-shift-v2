import { useMemo, useState } from 'react'
import { Icon } from '../icons'
import { useMapLookup } from '../MapDataContext'

/**
 * SearchBar — filters macros / key_trends / sub_trends by name or
 * description. On select, calls the appropriate open handler.
 */
export default function SearchBar({ onOpenMacro, onOpenKey, onOpenSub }) {
  const { macros, key_trends, sub_trends, subNumber } = useMapLookup()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return null
    const match = (s) => (s || '').toLowerCase().includes(qq)
    return {
      macros: macros.filter(m => match(m.name) || match(m.description)).slice(0, 5),
      keys: key_trends.filter(k => match(k.name) || match(k.description)).slice(0, 6),
      subs: sub_trends.filter(s => match(s.name) || match(s.description)).slice(0, 8),
    }
  }, [q, macros, key_trends, sub_trends])

  const hasAny =
    results && (results.macros.length + results.keys.length + results.subs.length) > 0

  return (
    <div className="relative w-full max-w-md">
      <Icon.Search
        width="14"
        height="14"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
      />
      <input
        type="text"
        placeholder="Search scenarios, key trends, sub-trends…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        className="w-full h-9 pl-9 pr-3 text-sm bg-neutral-900/60 border border-neutral-800 rounded-md text-cream placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-80 overflow-auto bg-neutral-950 border border-neutral-800 rounded-md shadow-2xl">
          {!hasAny && (
            <div className="px-4 py-3 text-xs text-neutral-500">No matches</div>
          )}
          {renderGroup('Scenarios', results.macros, 'macro', onOpenMacro, setQ, setOpen)}
          {renderGroup('Key trends', results.keys, 'key', onOpenKey, setQ, setOpen)}
          {renderGroup(
            'Sub-trends',
            results.subs,
            'sub',
            onOpenSub,
            setQ,
            setOpen,
            subNumber,
          )}
        </div>
      )}
    </div>
  )
}

function renderGroup(label, items, kind, openFn, setQ, setOpen, subNumber) {
  if (!items?.length) return null
  return (
    <div className="py-1">
      <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-neutral-600">
        {label}
      </div>
      {items.map(it => (
        <button
          key={it.id}
          className="w-full flex items-center justify-between text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900 transition-colors"
          onMouseDown={(e) => {
            // onMouseDown so the click lands before onBlur closes the dropdown.
            e.preventDefault()
            setQ('')
            setOpen(false)
            setTimeout(() => openFn(it), 10)
          }}
        >
          <span className="truncate pr-3">{it.name}</span>
          <span className={`tier-${kind} text-[10px] font-mono uppercase tracking-widest`}>
            <span className="tier-dot" />
            {kind === 'sub' && subNumber ? subNumber(it) : label.slice(0, -1)}
          </span>
        </button>
      ))}
    </div>
  )
}
