import Chip from '../components/Chip'
import EvidenceCard from '../components/EvidenceCard'
import { Icon } from '../icons'
import { useMapLookup, deriveSignals } from '../MapDataContext'

/**
 * EvidenceLayer — detail view for one sub-trend.
 *   - Left: quote / claim cards for every claim attached to this sub.
 *   - Right sidebar: derived signals (count, sources, thinkers, avg
 *     signal strength) + sibling sub-trends within the same key trend.
 */
export default function EvidenceLayer({
  macro,
  keyTrend,
  sub,
  back,
  navigateToSub,
  bookmarks,
  toggle,
}) {
  const { subsByKey, claimsBySub, subNumber } = useMapLookup()
  const siblings = (subsByKey[keyTrend.id] || []).filter((s) => s.id !== sub.id)
  const claims = claimsBySub[sub.id] || []
  const signals = deriveSignals(claims)
  const active = bookmarks.includes(sub.id)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <button
        onClick={back}
        className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-8"
      >
        <Icon.Back width="14" height="14" /> {keyTrend.name}
      </button>

      <header
        data-zoom-id="layer-head"
        className="grid md:grid-cols-[1fr_320px] gap-10 mb-10 border-b border-neutral-800 pb-10"
      >
        <div>
          <p className="mb-5">
            <Chip kind="sub">Sub-trend {subNumber(sub)}</Chip>
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl leading-[1.1] text-cream">
            {sub.name}
          </h1>
          <p className="mt-5 text-neutral-400 text-base leading-relaxed max-w-2xl">
            {sub.description}
          </p>
        </div>
        <div className="text-sm border border-neutral-800 rounded-md divide-y divide-neutral-800 h-fit">
          <MetaRow label="Scenario" value={macro.name} />
          <MetaRow label="Key trend" value={keyTrend.name} />
          <MetaRow
            label="Evidence"
            value={`${String(claims.length).padStart(2, '0')} voice${claims.length === 1 ? '' : 's'}`}
          />
          <button
            onClick={() => toggle(sub.id)}
            aria-pressed={active}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-mono uppercase tracking-widest transition-colors ${
              active
                ? 'text-accent hover:text-accent-light'
                : 'text-neutral-400 hover:text-cream'
            }`}
          >
            <Icon.Bookmark filled={active} width="14" height="14" />
            {active ? 'Saved' : 'Save trend'}
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-[1fr_280px] gap-10">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500 mb-5">
            Evidence &middot; {claims.length} voice{claims.length === 1 ? '' : 's'}
          </p>
          {claims.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No claims linked to this sub-trend yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {claims.map((c) => (
                <EvidenceCard key={c.id} claim={c} />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-8">
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
              Signal
            </h4>
            <div className="border border-neutral-800 rounded-md divide-y divide-neutral-800">
              {signals.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 text-xs"
                >
                  <span className="text-neutral-500 font-mono uppercase tracking-widest text-[10px]">
                    {s.label}
                  </span>
                  <span className="text-cream font-mono">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {siblings.length > 0 && (
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
                More within {keyTrend.name}
              </h4>
              <div className="flex flex-col gap-1">
                {siblings.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigateToSub(s)}
                    className="grid grid-cols-[46px_1fr_16px] items-center gap-3 px-3 py-2 text-left border border-transparent hover:border-neutral-800 hover:bg-neutral-900/40 rounded-md transition-colors"
                  >
                    <span className="font-mono text-[10px] tier-sub tracking-widest">
                      {subNumber(s)}
                    </span>
                    <span className="text-sm text-neutral-300 leading-snug">
                      {s.name}
                    </span>
                    <Icon.Arrow width="14" height="14" className="text-neutral-600" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <dt className="text-neutral-500 font-mono text-[11px] uppercase tracking-widest whitespace-nowrap">
        {label}
      </dt>
      <dd className="text-cream font-mono text-xs text-right truncate">{value}</dd>
    </div>
  )
}
