import Chip from '../components/Chip'
import SubRow from '../components/SubRow'
import { Icon } from '../icons'
import { useMapLookup } from '../MapDataContext'

/**
 * SubsLayer — flat list of sub-trends within a key trend.
 * The containing macro is the currently-active macro from path state.
 */
export default function SubsLayer({ macro, keyTrend, onOpenSub, back }) {
  const { subsByKey, subNumber } = useMapLookup()
  const subs = subsByKey[keyTrend.id] || []
  const velocityLabel = keyTrend.velocity
    ? keyTrend.velocity.charAt(0).toUpperCase() + keyTrend.velocity.slice(1)
    : 'Steady'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <button
        onClick={back}
        className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-8"
      >
        <Icon.Back width="14" height="14" /> {macro.name}
      </button>

      <header
        data-zoom-id="layer-head"
        className="grid md:grid-cols-[1fr_280px] gap-10 mb-10 border-b border-neutral-800 pb-10"
      >
        <div>
          <p className="mb-5">
            <Chip kind="key">Key trend</Chip>
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl leading-[1.1] text-cream">
            {keyTrend.name}
          </h1>
          <p className="mt-5 text-neutral-400 text-base leading-relaxed max-w-2xl">
            {keyTrend.description}
          </p>
        </div>
        <dl className="text-sm border border-neutral-800 rounded-md divide-y divide-neutral-800 h-fit">
          <MetaRow label="Scenario" value={macro.name} />
          <MetaRow
            label="Sub-trends"
            value={String(subs.length).padStart(2, '0')}
          />
          <MetaRow label="Velocity" value={velocityLabel} />
        </dl>
      </header>

      <div className="flex flex-col gap-2">
        {subs.map((s) => (
          <SubRow key={s.id} sub={s} number={subNumber(s)} onOpen={onOpenSub} />
        ))}
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
