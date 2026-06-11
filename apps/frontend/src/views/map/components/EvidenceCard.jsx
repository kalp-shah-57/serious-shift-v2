/**
 * EvidenceCard — renders a single claim.
 * Handles both old schema (thinker_name) and new schema (thinker) field names.
 * signal_strength can be a string ("signal","strong_signal") or legacy float.
 */
export default function EvidenceCard({ claim }) {
  const thinkerName = claim.thinker || claim.thinker_name || 'Unknown'
  const initials = thinkerName
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const toScore = s => {
    if (s === 'strong_signal') return 1.0
    if (s === 'signal')        return 0.6
    const n = Number(s)
    return isNaN(n) ? 0.4 : n
  }
  const strengthPct = toScore(claim.signal_strength) * 100

  return (
    <article className="p-6 sm:p-7 bg-neutral-900/30 border border-neutral-800 rounded-lg">
      <p className="font-editorial text-xl sm:text-[22px] leading-snug text-cream">
        &ldquo;{claim.text}&rdquo;
      </p>

      {claim.consumer_implication && (
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed border-l-2 border-neutral-700 pl-3">
          {claim.consumer_implication}
        </p>
      )}

      <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-mono text-xs shrink-0">
            {initials || '—'}
          </div>
          <div className="text-sm">
            <div className="text-cream leading-tight">{thinkerName}</div>
            {claim.source_date && (
              <div className="text-neutral-500 text-xs leading-tight">
                {claim.source_date.slice(0, 4)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 min-w-[160px]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 truncate max-w-[200px]">
            {claim.source_title || 'Source'}
          </div>
          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${strengthPct}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  )
}
