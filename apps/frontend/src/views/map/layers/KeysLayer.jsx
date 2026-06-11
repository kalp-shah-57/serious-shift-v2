import Chip from '../components/Chip'
import KeyCard from '../components/KeyCard'
import { Icon } from '../icons'
import { useMapLookup } from '../MapDataContext'

/**
 * KeysLayer — shows the key trends that belong to a specific macro.
 * The macro itself is looked up from the macroId carried in path state.
 */
export default function KeysLayer({ macro, onOpenKey, back, bookmarks, toggle }) {
  const { keysByMacro, subsByKey, macroNumber } = useMapLookup()
  const keys = keysByMacro[macro.id] || []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <button
        onClick={back}
        className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-8"
      >
        <Icon.Back width="14" height="14" /> Scenarios
      </button>

      <header
        data-zoom-id="layer-head"
        className="grid md:grid-cols-[1fr_300px] gap-10 mb-10 border-b border-neutral-800 pb-10"
      >
        <div>
          <p className="mb-5">
            <Chip kind="macro">Scenario {macroNumber(macro)}</Chip>
          </p>
          <h1 className="font-editorial text-4xl sm:text-5xl leading-[1.05] text-cream">
            {macro.name}
          </h1>
          <p className="mt-5 text-neutral-400 text-base leading-relaxed max-w-2xl">
            {macro.description}
          </p>
        </div>
        <dl className="text-sm border border-neutral-800 rounded-md divide-y divide-neutral-800 h-fit">
          <MetaRow label="Horizon" value={macro.horizon} />
          <MetaRow label="Region" value={macro.region} />
          <MetaRow
            label="Key trends"
            value={String(keys.length).padStart(2, '0')}
          />
        </dl>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {keys.map((k) => (
          <KeyCard
            key={k.id}
            keyTrend={k}
            onOpen={onOpenKey}
            subCount={(subsByKey[k.id] || []).length}
            bookmarks={bookmarks}
            toggle={toggle}
          />
        ))}
      </div>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-neutral-500 font-mono text-[11px] uppercase tracking-widest">
        {label}
      </dt>
      <dd className="text-cream font-mono text-xs">{value}</dd>
    </div>
  )
}
