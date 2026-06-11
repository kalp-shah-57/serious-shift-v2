import { useMemo } from 'react'
import { useData } from '../hooks/useData'
import { sanitiseEntity, sanitiseList } from '../utils/text'

export default function Daily() {
  const { data: dailyRaw, loading } = useData('daily.json')

  // Sanitise visible text fields at the boundary so daily briefings never
  // display "AGI". `source_title` is preserved automatically.
  const daily = useMemo(() => {
    if (!dailyRaw) return dailyRaw
    const sanitised = sanitiseEntity(dailyRaw)
    if (Array.isArray(dailyRaw.sections)) {
      sanitised.sections = sanitiseList(dailyRaw.sections)
    }
    if (Array.isArray(dailyRaw.keynote_updates_recommended)) {
      sanitised.keynote_updates_recommended =
        sanitiseList(dailyRaw.keynote_updates_recommended)
    }
    return sanitised
  }, [dailyRaw])

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-neutral-600 text-sm">Loading...</span></div>
  if (!daily || !daily.sections?.length) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
      <h1 className="font-editorial text-3xl text-cream mb-4">Daily Briefing</h1>
      <p className="text-neutral-500">No daily briefing available yet. Run <code className="font-mono text-xs bg-neutral-800 px-1.5 py-0.5">python3 generate_keynote.py --daily</code> to generate one.</p>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <section className="border-b border-neutral-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <p className="text-[10px] uppercase tracking-widest text-accent mb-3">Daily Intelligence Update</p>
          <h1 className="font-editorial text-3xl sm:text-4xl text-cream">{daily.date}</h1>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {daily.new_claims_analyzed} new claims analyzed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              {daily.historical_claims_referenced} historical reference points
            </span>
          </div>
        </div>
      </section>

      {/* Sections */}
      {daily.sections.map((section, idx) => (
        <section key={idx} className="border-t border-neutral-800">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-mono text-accent text-sm">{String(idx + 1).padStart(2, '0')}</span>
              <h2 className="font-editorial text-xl sm:text-2xl text-cream leading-tight">{section.title}</h2>
            </div>

            <div className="prose-body text-neutral-300 text-sm leading-relaxed">
              {section.body.split('\n\n').filter(p => p.trim()).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {/* Keynote impact */}
            {section.keynote_impact && (
              <div className="mt-6 border-l-2 border-accent/30 pl-4">
                <p className="text-[10px] uppercase tracking-widest text-accent/60 mb-1">Keynote Impact</p>
                <p className="text-xs text-neutral-400">{section.keynote_impact}</p>
              </div>
            )}

            {/* Predictions affected */}
            {section.predictions_affected?.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-neutral-600">Predictions affected:</span>
                {section.predictions_affected.map(p => (
                  <span key={p} className="font-mono text-[10px] text-amber-400/80 bg-amber-950/30 px-1.5 py-0.5">{p}</span>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Recommended updates */}
      {daily.keynote_updates_recommended?.length > 0 && (
        <section className="border-t border-neutral-800 bg-neutral-900/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <h3 className="text-xs uppercase tracking-widest text-neutral-600 mb-4">Recommended Keynote Updates</h3>
            {daily.keynote_updates_recommended.map((u, i) => (
              <div key={i} className="flex items-start gap-3 mb-3">
                <span className={`text-[10px] px-1.5 py-0.5 font-mono ${
                  u.action === 'weaken' ? 'bg-red-950/40 text-red-400' :
                  u.action === 'strengthen' ? 'bg-green-950/40 text-green-400' :
                  'bg-neutral-800 text-neutral-400'
                }`}>{u.action}</span>
                <span className="text-xs text-neutral-400">Section {u.section}: {u.reason}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
