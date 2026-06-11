import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../hooks/useData'
import CredScore from '../components/CredScore'
import StatusBadge from '../components/StatusBadge'

export default function Leaderboard() {
  const { data: thinkers, loading } = useData('thinkers.json')
  const { data: predictions } = useData('predictions.json')
  const [expanded, setExpanded] = useState(null)

  if (loading || !thinkers) return <Loader />

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-editorial text-3xl sm:text-4xl text-cream mb-2">Credibility Leaderboard</h1>
      <p className="text-neutral-500 text-sm mb-10">
        Ranked by prediction accuracy and consensus positioning. Scores update as predictions become evaluable.
      </p>

      <div className="space-y-0">
        {thinkers.map((t, i) => {
          const isExpanded = expanded === t.id
          const tPreds = predictions?.filter(p => p.thinker_id === t.id) || []
          const isDramatic = t.credibility_score < 15

          return (
            <div
              key={t.id}
              className={`border-t border-neutral-800 ${isDramatic ? 'bg-red-950/20' : ''}`}
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : t.id)}
                className="w-full text-left py-5 px-4 flex items-center gap-4 sm:gap-6 hover:bg-neutral-900/50 transition-colors"
              >
                <span className={`font-mono text-sm w-6 text-right ${isDramatic ? 'text-red-400' : 'text-neutral-600'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="flex-1 min-w-0">
                  <Link
                    to={`/thinker/${encodeURIComponent(t.name)}`}
                    onClick={e => e.stopPropagation()}
                    className="text-cream font-medium hover:text-accent transition-colors"
                  >
                    {t.name}
                  </Link>
                  <p className="text-xs text-neutral-500 truncate">{t.affiliation}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <CredScore score={t.credibility_score} size={isDramatic ? 'lg' : 'md'} />
                  <p className="text-[10px] text-neutral-600 font-mono mt-0.5">
                    {t.evaluated_count}/{t.prediction_count} eval
                  </p>
                </div>

                {/* Accuracy/Outlier mini bar */}
                <div className="hidden sm:flex flex-col gap-1 w-24 flex-shrink-0">
                  <MiniBar label="Acc" value={t.prediction_accuracy} />
                  <MiniBar label="Out" value={t.outlier_factor} max={1} />
                </div>

                <span className="text-neutral-600 text-xs flex-shrink-0">{isExpanded ? '−' : '+'}</span>
              </button>

              {isExpanded && tPreds.length > 0 && (
                <div className="px-4 pb-6 ml-10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-neutral-600 uppercase tracking-wider text-left">
                        <th className="pb-2 font-medium">Prediction</th>
                        <th className="pb-2 font-medium w-20">Status</th>
                        <th className="pb-2 font-medium w-16 text-right">Consensus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tPreds.map(p => (
                        <tr key={p.id} className="border-t border-neutral-800/50">
                          <td className="py-2 pr-4 text-neutral-400">{p.claim_text?.slice(0, 100)}{p.claim_text?.length > 100 ? '...' : ''}</td>
                          <td className="py-2"><StatusBadge status={p.status} /></td>
                          <td className="py-2 text-right font-mono text-neutral-500">{p.consensus_alignment?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-12 border-t border-neutral-800 pt-6">
        <h3 className="text-xs uppercase tracking-widest text-neutral-600 mb-3">Methodology</h3>
        <p className="text-xs text-neutral-500 leading-relaxed">
          credibility = ((accuracy &times; 0.85) + (outlier_modifier &times; 0.15)) &times; 100.
          Accuracy = average of evaluated predictions (true=1.0, partial=0.5, false=0.0).
          Outlier modifier = 0.5 + (avg_consensus &times; 0.5). Default accuracy is 0.5 when no predictions are evaluable.
        </p>
      </div>
    </div>
  )
}

function MiniBar({ label, value, max = 1 }) {
  const pct = Math.min(((value || 0) / max) * 100, 100)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-neutral-600 w-5 font-mono">{label}</span>
      <div className="flex-1 h-1 bg-neutral-800 overflow-hidden">
        <div className="h-full bg-neutral-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><span className="text-neutral-600 text-sm">Loading...</span></div>
}
