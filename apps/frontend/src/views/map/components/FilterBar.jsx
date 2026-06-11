import DomainPill from './DomainPill'

const DOMAINS   = ['society', 'economy', 'consumers', 'organisations']
const VELOCITIES = [
  { value: 'accelerating', label: 'Accelerating' },
  { value: 'rising',       label: 'Rising' },
  { value: 'steady',       label: 'Steady' },
]

/**
 * FilterBar — multi-select filter for the Key Trends list.
 * filters: { domains: [], velocity: [], macros: [] }
 * setFilters: dispatch function
 * macros: array of macro objects for the macro filter options
 * resultCount: number of KTs currently visible (for the count badge)
 */
export default function FilterBar({ filters, setFilters, macros, resultCount, totalCount, stickyTop = 'top-28 sm:top-32' }) {
  const toggle = (key, value) => {
    setFilters(prev => {
      const arr = prev[key] || []
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      }
    })
  }

  const clearAll = () => setFilters(prev => ({ domains: [], velocity: [], ...(prev.macros !== undefined ? { macros: [] } : {}) }))
  const hasFilters = filters.domains.length > 0 || filters.velocity.length > 0 || (filters.macros || []).length > 0

  return (
    <div className={`border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm sticky ${stickyTop} z-20`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">

        {/* Domain filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mr-1">Domain</span>
          {DOMAINS.map(d => {
            const active = filters.domains.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle('domains', d)}
                className={`transition-opacity ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                title={`Filter by ${d}`}
              >
                <DomainPill domain={d} size="xs" />
              </button>
            )
          })}
        </div>

        {/* Velocity filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mr-1">Velocity</span>
          {VELOCITIES.map(({ value, label }) => {
            const active = filters.velocity.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle('velocity', value)}
                className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-widest transition-colors ${
                  active
                    ? 'border-neutral-500 text-neutral-200 bg-neutral-800'
                    : 'border-neutral-800 text-neutral-600 hover:border-neutral-700 hover:text-neutral-400'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Macro filters — only shown when macros are provided */}
        {macros && macros.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mr-1">Scenario</span>
          {macros.map(m => {
            const active = filters.macros.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle('macros', m.id)}
                className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-widest transition-colors max-w-[120px] truncate ${
                  active
                    ? 'border-[var(--map-macro)] text-[var(--map-macro)] bg-[var(--map-macro-soft)]'
                    : 'border-neutral-800 text-neutral-600 hover:border-neutral-700 hover:text-neutral-400'
                }`}
                title={m.name}
              >
                {m.name.length > 14 ? m.name.slice(0, 13) + '…' : m.name}
              </button>
            )
          })}
        </div>
        )}

        {/* Result count + clear */}
        <div className="ml-auto flex items-center gap-3">
          {hasFilters && (
            <span className="font-mono text-[10px] text-neutral-500">
              {resultCount}/{totalCount} trends
            </span>
          )}
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-cream transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
