import Chip from '../components/Chip'
import MacroCard from '../components/MacroCard'
import { useMapLookup } from '../MapDataContext'

/**
 * MacrosLayer — top-level grid of scenario cards.
 */
export default function MacrosLayer({ onOpenMacro, bookmarks, toggle }) {
  const { macros, keysByMacro, sub_trends, macroNumber } = useMapLookup()
  const totalKeys = Object.values(keysByMacro).reduce(
    (acc, ks) => acc + ks.length,
    0,
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <header
        data-zoom-id="layer-head"
        className="grid md:grid-cols-[1fr_300px] gap-10 mb-12 border-b border-neutral-800 pb-10"
      >
        <div>
          <p className="mb-5">
            <Chip kind="macro">2026 Edition</Chip>
          </p>
          <h1 className="font-editorial text-4xl sm:text-5xl leading-[1.05] text-cream">
            Six scenarios for the decade of consumer realignment.
          </h1>
          <p className="mt-5 text-neutral-400 text-base leading-relaxed max-w-xl">
            Each scenario reframes the forces reshaping demand — how people decide,
            belong, and spend. Open one to see the key trends it contains, and the
            sub-trends underneath.
          </p>
        </div>
        <dl className="text-sm border border-neutral-800 rounded-md divide-y divide-neutral-800 h-fit">
          <MetaRow label="Scenarios" value={String(macros.length).padStart(2, '0')} />
          <MetaRow label="Key trends" value={String(totalKeys).padStart(2, '0')} />
          <MetaRow
            label="Sub-trends"
            value={String(sub_trends.length).padStart(2, '0')}
          />
          <MetaRow label="Updated" value="Apr 2026" />
        </dl>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {macros.map((m) => (
          <MacroCard
            key={m.id}
            macro={m}
            number={macroNumber(m)}
            onOpen={onOpenMacro}
            keysCount={keysByMacro[m.id]?.length || 0}
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
