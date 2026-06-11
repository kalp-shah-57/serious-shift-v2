import { useState, useMemo } from 'react'
import { useData } from '../hooks/useData'
import StatusBadge from '../components/StatusBadge'
import ConsensusDot from '../components/ConsensusDot'

const domains = ['All', 'agi_timeline', 'labor', 'consumer_behavior', 'technology_capability', 'economy', 'regulation', 'existential_risk']
const statuses = ['All', 'pending', 'true', 'partially_true', 'false', 'expired']
const timeframes = ['All', 'Next 6 months', 'Next 12 months']

export default function Predictions() {
  const { data: predictions, loading } = useData('predictions.json')
  const { data: thinkers } = useData('thinkers.json')
  const [domain, setDomain] = useState('All')
  const [status, setStatus] = useState('All')
  const [thinker, setThinker] = useState('All')
  const [timeframe, setTimeframe] = useState('All')

  const filtered = useMemo(() => {
    if (!predictions) return []
    let f = [...predictions]
    if (domain !== 'All') f = f.filter(p => p.domain === domain)
    if (status !== 'All') f = f.filter(p => p.status === status)
    if (thinker !== 'All') f = f.filter(p => p.thinker_name === thinker)
    if (timeframe === 'Next 6 months') {
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() + 6)
      f = f.filter(p => p.evaluation_date && new Date(p.evaluation_date) <= cutoff)
    } else if (timeframe === 'Next 12 months') {
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() + 12)
      f = f.filter(p => p.evaluation_date && new Date(p.evaluation_date) <= cutoff)
    }
    f.sort((a, b) => (a.evaluation_date || 'z').localeCompare(b.evaluation_date || 'z'))
    return f
  }, [predictions, domain, status, thinker, timeframe])

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-neutral-600 text-sm">Loading...</span></div>

  const thinkerNames = [...new Set(predictions?.map(p => p.thinker_name) || [])].sort()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-editorial text-3xl sm:text-4xl text-cream mb-2">Predictions Tracker</h1>
      <p className="text-neutral-500 text-sm mb-8">{predictions?.length} tracked predictions across {thinkerNames.length} thinkers</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Select label="Domain" value={domain} onChange={setDomain} options={domains} />
        <Select label="Status" value={status} onChange={setStatus} options={statuses} />
        <Select label="Thinker" value={thinker} onChange={setThinker} options={['All', ...thinkerNames]} />
        <Select label="Timeframe" value={timeframe} onChange={setTimeframe} options={timeframes} />
      </div>

      <p className="text-xs text-neutral-600 mb-4">{filtered.length} predictions shown</p>

      {/* Results */}
      <div className="space-y-0">
        {filtered.map(p => (
          <div key={p.id} className="border-t border-neutral-800 py-4 px-2">
            <div className="flex items-start gap-3">
              <ConsensusDot value={p.consensus_alignment} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-300 leading-relaxed">{p.claim_text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-400">{p.thinker_name}</span>
                  <span className={`font-mono text-[10px] font-semibold ${
                    p.credibility_score >= 53 ? 'text-green-400' : p.credibility_score >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>{p.credibility_score?.toFixed(1)}</span>
                  <StatusBadge status={p.status} />
                  <span className="font-mono text-[10px]">{p.prediction_id}</span>
                  {p.evaluation_date && (
                    <span className="text-neutral-600">eval: {p.evaluation_date}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 px-2 py-1.5 focus:outline-none focus:border-accent"
      aria-label={label}
    >
      {options.map(o => (
        <option key={o} value={o}>{o === 'All' ? `${label}: All` : o.replace(/_/g, ' ')}</option>
      ))}
    </select>
  )
}
