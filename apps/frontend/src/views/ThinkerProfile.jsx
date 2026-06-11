import { useParams, Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useData } from '../hooks/useData'
import { sanitiseList } from '../utils/text'
import CredScore from '../components/CredScore'
import StatusBadge from '../components/StatusBadge'

export default function ThinkerProfile() {
  const { name } = useParams()
  const decoded = decodeURIComponent(name)
  const { data: thinkersRaw } = useData('thinkers.json')
  const { data: claimsRaw } = useData('claims.json')
  const { data: predictionsRaw } = useData('predictions.json')
  const { data: disagreementsRaw } = useData('disagreements.json')

  // Sanitise every record at the data-access boundary so visible bios, claim
  // text, predictions, and disagreement summaries never display "AGI".
  // `source_title` is preserved automatically (see src/utils/text.js).
  const thinkers      = useMemo(() => sanitiseList(thinkersRaw),      [thinkersRaw])
  const claims        = useMemo(() => sanitiseList(claimsRaw),        [claimsRaw])
  const predictions   = useMemo(() => sanitiseList(predictionsRaw),   [predictionsRaw])
  const disagreements = useMemo(() => sanitiseList(disagreementsRaw), [disagreementsRaw])

  const t = thinkers?.find(x => x.name === decoded)
  if (!t) return <div className="flex items-center justify-center h-64"><span className="text-neutral-600 text-sm">Loading...</span></div>

  const myClaims = claims?.filter(c => c.thinker_id === t.id)?.sort((a, b) => (a.source_date || '').localeCompare(b.source_date || '')) || []
  const myPreds = predictions?.filter(p => p.thinker_id === t.id) || []
  const myDisagreements = disagreements?.filter(d => d.thinker_a_id === t.id) || []

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <Link to="/leaderboard" className="text-xs text-neutral-600 hover:text-neutral-400 mb-2 inline-block">&larr; Back to leaderboard</Link>
          <h1 className="font-editorial text-3xl sm:text-4xl text-cream">{t.name}</h1>
          <p className="text-neutral-500 text-sm mt-1">{t.affiliation}</p>
          <p className="text-neutral-600 text-xs mt-1">{t.domain}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <CredScore score={t.credibility_score} size="lg" />
          <p className="text-[10px] text-neutral-600 font-mono mt-1">/100 credibility</p>
        </div>
      </div>

      {/* Bio */}
      {t.bio && (
        <div className="mb-10">
          <p className="text-neutral-400 text-sm leading-relaxed">{t.bio}</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <Stat label="AI Timeline" value={t.agi_timeline?.slice(0, 60)} />
        <Stat label="Predictions" value={`${t.prediction_count} tracked`} />
        <Stat label="Claims" value={`${t.claim_count} extracted`} />
        <Stat label="Sources" value={`${t.source_count} processed`} />
      </div>

      {/* Credibility Breakdown */}
      <Section title="Credibility Breakdown">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-2xl font-mono text-neutral-300">{t.prediction_accuracy?.toFixed(2) ?? 'N/A'}</p>
            <p className="text-[10px] text-neutral-600 uppercase tracking-wider mt-1">Accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-mono text-neutral-300">{t.outlier_factor?.toFixed(2) ?? 'N/A'}</p>
            <p className="text-[10px] text-neutral-600 uppercase tracking-wider mt-1">Outlier Factor</p>
          </div>
          <div>
            <p className="text-2xl font-mono text-neutral-300">{t.evaluated_count}/{t.prediction_count}</p>
            <p className="text-[10px] text-neutral-600 uppercase tracking-wider mt-1">Evaluated</p>
          </div>
        </div>
      </Section>

      {/* Predictions */}
      {myPreds.length > 0 && (
        <Section title="Predictions">
          <div className="space-y-0">
            {myPreds.map(p => (
              <div key={p.id} className="border-t border-neutral-800 py-3 flex items-start gap-3">
                <StatusBadge status={p.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-300">{p.claim_text}</p>
                  <p className="text-[10px] text-neutral-600 mt-1 font-mono">
                    {p.prediction_id} &middot; consensus: {p.consensus_alignment?.toFixed(2)} &middot; eval: {p.evaluation_date || 'TBD'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Disagreements */}
      {myDisagreements.length > 0 && (
        <Section title="Disagreements">
          <div className="space-y-2">
            {myDisagreements.map((d, i) => (
              <div key={i} className="text-sm">
                <span className="text-neutral-500">vs </span>
                <Link to={`/thinker/${encodeURIComponent(d.thinker_b_name)}`} className="text-accent hover:underline">{d.thinker_b_name}</Link>
                <span className="text-neutral-600"> on </span>
                <span className="text-neutral-400">{d.topic}</span>
                {d.description && <p className="text-xs text-neutral-600 ml-4 mt-0.5">{d.description.slice(0, 150)}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Claims timeline */}
      <Section title={`Claims Over Time (${myClaims.length})`}>
        <div className="space-y-0 max-h-96 overflow-y-auto">
          {myClaims.slice(0, 50).map(c => (
            <div key={c.id} className="border-t border-neutral-800/50 py-2">
              <p className="text-xs text-neutral-400">{c.claim_text?.slice(0, 150)}</p>
              <p className="text-[10px] text-neutral-600 mt-0.5">{c.source_date} &middot; {c.domain?.replace(/_/g, ' ')} &middot; {c.claim_type}</p>
            </div>
          ))}
          {myClaims.length > 50 && <p className="text-xs text-neutral-600 py-2">...and {myClaims.length - 50} more</p>}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-xs uppercase tracking-widest text-neutral-600 mb-4 pb-2 border-b border-neutral-800">{title}</h2>
      {children}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="border border-neutral-800 p-3">
      <p className="text-[10px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{value}</p>
    </div>
  )
}
