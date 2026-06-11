import { useState, useMemo } from 'react'
import { useData } from '../hooks/useData'

const domainOptions = ['All', 'consumer_behavior', 'technology_capability', 'economy', 'labor', 'agi_timeline', 'enterprise', 'regulation', 'existential_risk', 'education']
const strengthOptions = ['All', 'strong_signal', 'signal', 'background', 'noise']
const typeOptions = ['All', 'prediction', 'analysis', 'opinion', 'fact', 'recommendation']

export default function Explore() {
  const { data: claims, loading } = useData('claims.json')
  const { data: thinkers } = useData('thinkers.json')
  const { data: claimConcepts } = useData('claim_concepts.json')
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('All')
  const [strength, setStrength] = useState('All')
  const [type, setType] = useState('All')
  const [selectedThinkers, setSelectedThinkers] = useState([])
  const [hideDuplicates, setHideDuplicates] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const filtered = useMemo(() => {
    if (!claims) return []
    let f = [...claims]
    // Hide duplicates by default
    if (hideDuplicates) f = f.filter(c => !c.duplicate_of)
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(c => c.claim_text?.toLowerCase().includes(q))
    }
    if (domain !== 'All') f = f.filter(c => c.domain === domain)
    if (strength !== 'All') f = f.filter(c => c.signal_strength === strength)
    if (type !== 'All') f = f.filter(c => c.claim_type === type)
    if (selectedThinkers.length > 0) f = f.filter(c => selectedThinkers.includes(c.thinker_name))
    // Already sorted by claim_weight DESC from export
    return f.slice(0, 200)
  }, [claims, search, domain, strength, type, selectedThinkers, hideDuplicates])

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-neutral-600 text-sm">Loading...</span></div>

  const totalActive = claims?.filter(c => !c.duplicate_of).length || 0
  const thinkerNames = [...new Set(claims?.map(c => c.thinker_name) || [])].sort()

  const toggleThinker = (name) => {
    setSelectedThinkers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-editorial text-3xl sm:text-4xl text-cream mb-2">Explore Claims</h1>
      <p className="text-neutral-500 text-sm mb-8">{totalActive.toLocaleString()} active claims from {thinkers?.length} thinkers</p>

      {/* Search */}
      <input
        type="text"
        placeholder="Search claims..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-neutral-900 border border-neutral-700 text-sm text-neutral-300 px-4 py-2.5 mb-4 focus:outline-none focus:border-accent placeholder-neutral-600"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <Sel value={domain} onChange={setDomain} options={domainOptions} label="Domain" />
        <Sel value={strength} onChange={setStrength} options={strengthOptions} label="Signal" />
        <Sel value={type} onChange={setType} options={typeOptions} label="Type" />
        <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={hideDuplicates}
            onChange={e => setHideDuplicates(e.target.checked)}
            className="accent-accent"
          />
          Hide duplicates
        </label>
      </div>

      {/* Thinker chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {thinkerNames.map(name => (
          <button
            key={name}
            onClick={() => toggleThinker(name)}
            className={`text-[11px] px-2 py-1 border transition-colors ${
              selectedThinkers.includes(name)
                ? 'border-accent text-accent'
                : 'border-neutral-700 text-neutral-500 hover:border-neutral-500'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="text-xs text-neutral-600 mb-4">{filtered.length} claims shown{filtered.length >= 200 ? ' (capped at 200)' : ''} &middot; sorted by weight</p>

      {/* Results */}
      <div className="space-y-0">
        {filtered.map(c => {
          const isExpanded = expandedId === c.id
          const concepts = claimConcepts?.filter(cc => cc.claim_id === c.id) || []
          const w = c.claim_weight
          return (
            <div key={c.id} className="border-t border-neutral-800">
              <button
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                className="w-full text-left py-3 px-2 hover:bg-neutral-900/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {/* Weight bar */}
                  <div className="flex-shrink-0 w-8 mt-1.5 flex flex-col items-center" title={`Weight: ${w?.toFixed(3) || '?'}`}>
                    <div className="w-1.5 h-6 bg-neutral-800 overflow-hidden rounded-sm">
                      <div
                        className="w-full bg-accent/70 rounded-sm"
                        style={{ height: `${Math.min((w || 0) * 100, 100)}%`, marginTop: 'auto' }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-neutral-600 mt-0.5">{w?.toFixed(2) || '-'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-300 leading-relaxed">{c.claim_text?.slice(0, 200)}{c.claim_text?.length > 200 ? '...' : ''}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="text-neutral-400 font-medium">{c.thinker_name}</span>
                      <span className="text-neutral-600">{c.source_date}</span>
                      <span className={`px-1.5 py-0.5 ${strengthColor(c.signal_strength)}`}>{c.signal_strength?.replace('_', ' ')}</span>
                      <span className="text-neutral-600">{c.domain?.replace(/_/g, ' ')}</span>
                      {c.freshness_score != null && (
                        <span className={`font-mono ${c.freshness_score >= 0.8 ? 'text-green-600' : c.freshness_score >= 0.4 ? 'text-neutral-600' : 'text-red-900'}`}>
                          f:{c.freshness_score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="px-2 pb-4 ml-10 text-xs text-neutral-500">
                  {c.consumer_implication && <p className="mb-2"><strong className="text-neutral-400">Consumer implication:</strong> {c.consumer_implication}</p>}
                  <p><strong className="text-neutral-400">Source:</strong> {c.source_title} (depth: {c.source_depth || '?'})</p>
                  <p><strong className="text-neutral-400">Type:</strong> {c.claim_type} &middot; <strong className="text-neutral-400">Specificity:</strong> {c.specificity}/5 &middot; <strong className="text-neutral-400">Weight:</strong> {w?.toFixed(4) || 'N/A'}</p>
                  {concepts.length > 0 && (
                    <p className="mt-1"><strong className="text-neutral-400">Concepts:</strong> {concepts.map(cc => cc.concept_name).join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Sel({ value, onChange, options, label }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 px-2 py-1.5 focus:outline-none focus:border-accent">
      {options.map(o => <option key={o} value={o}>{o === 'All' ? `${label}: All` : o.replace(/_/g, ' ')}</option>)}
    </select>
  )
}

function strengthColor(s) {
  const m = { strong_signal: 'bg-green-900/50 text-green-400', signal: 'bg-neutral-800 text-neutral-400', background: 'bg-neutral-800/50 text-neutral-500', noise: 'bg-neutral-900 text-neutral-600' }
  return m[s] || m.signal
}
