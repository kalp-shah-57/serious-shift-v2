/**
 * ClaimItem — leaf in the domain → scenario → KT → sub-trend → claim tree.
 *
 * Renders one claim with its thinker attribution + source + credibility
 * badge. Pure presentational; no internal state.
 *
 * Props:
 *   claim  — claim object from map.json (id, text, thinker, thinker_credibility,
 *            source_title, source_date, signal_strength, consumer_implication)
 *   accent — domain accent color (CSS var or hex) used for the credibility chip
 */

const SIGNAL_LABEL = {
  strong_signal: 'Strong',
  signal:        'Signal',
  background:    'Background',
  noise:         'Noise',
}

export default function ClaimItem({ claim, accent }) {
  const credibility = claim.thinker_credibility
  const showCred = typeof credibility === 'number' && !Number.isNaN(credibility)
  const signalLabel = SIGNAL_LABEL[claim.signal_strength]

  return (
    <article className="border-l border-neutral-800/80 pl-3 py-1.5">
      <p className="text-[13px] leading-relaxed text-neutral-200">
        {claim.text}
      </p>

      <div className="mt-1.5 flex items-baseline flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] text-neutral-500">
        {claim.thinker && (
          <span className="text-neutral-300 font-medium">
            {claim.thinker}
          </span>
        )}
        {showCred && (
          <span
            className="font-mono tabular-nums tracking-tight"
            style={{ color: accent }}
            title={`Credibility score: ${credibility.toFixed(1)}`}
          >
            {credibility.toFixed(1)}
          </span>
        )}
        {(claim.thinker || showCred) && claim.source_title && <Dot />}
        {claim.source_title && (
          <span className="text-neutral-500 italic truncate max-w-[28ch]">
            {claim.source_title}
          </span>
        )}
        {claim.source_date && (
          <>
            <Dot />
            <span className="font-mono text-[10px] text-neutral-600">
              {formatDate(claim.source_date)}
            </span>
          </>
        )}
        {signalLabel && (
          <>
            <Dot />
            <span
              className="font-mono uppercase tracking-widest text-[9px]"
              style={{
                color:
                  claim.signal_strength === 'strong_signal'
                    ? accent
                    : 'rgb(115 115 115)',
              }}
            >
              {signalLabel}
            </span>
          </>
        )}
      </div>
    </article>
  )
}

function Dot() {
  return (
    <span className="text-neutral-700 select-none" aria-hidden="true">·</span>
  )
}

function formatDate(s) {
  // Accept either YYYY-MM-DD or YYYY-MM or YYYY.
  if (!s) return ''
  const m = String(s).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  if (!m) return s
  const [, y, mm, dd] = m
  if (dd) return `${y}-${mm}-${dd}`
  if (mm) return `${y}-${mm}`
  return y
}
