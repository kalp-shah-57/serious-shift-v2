import Chip from './Chip'
import DomainPill from './DomainPill'
import BookmarkButton from './BookmarkButton'
import { Icon } from '../icons'

/**
 * MacroCard — top-level scenario card.
 * Used in both the legacy drill-down view and the new flat map layout.
 * onOpen and onThinkerClick are optional; without them the card is display-only.
 */
export default function MacroCard({ macro, number, onOpen, onThinkerClick, keysCount, bookmarks, toggle }) {
  const domains    = macro.domains    || []
  const proponents = macro.proponents || []
  const skeptics   = macro.skeptics   || []

  const cardContent = (
    <>
      {toggle && <BookmarkButton id={macro.id} bookmarks={bookmarks} toggle={toggle} />}

      <div className="flex items-center justify-between pr-8">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-neutral-500">
          Scenario {number}
        </span>
        <Chip kind="macro">Macro</Chip>
      </div>

      <h2 className="font-editorial text-2xl sm:text-[28px] leading-tight text-cream">
        {macro.name}
      </h2>

      <p className="text-sm text-neutral-400 leading-relaxed">
        {macro.description}
      </p>

      {domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {domains.map(d => <DomainPill key={d} domain={d} />)}
        </div>
      )}

      {(proponents.length > 0 || skeptics.length > 0) && (
        <div className="flex flex-col gap-2 text-xs">
          {proponents.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 pt-0.5 shrink-0 w-[56px]">For</span>
              <div className="flex flex-wrap gap-1">
                {proponents.map(name => (
                  <ThinkerChip key={name} name={name} onClick={onThinkerClick} />
                ))}
              </div>
            </div>
          )}
          {skeptics.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 pt-0.5 shrink-0 w-[56px]">Skeptics</span>
              <div className="flex flex-wrap gap-1">
                {skeptics.map(name => (
                  <ThinkerChip key={name} name={name} onClick={onThinkerClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-neutral-500 border-t border-neutral-800">
        <span>
          {keysCount != null && `${keysCount} key trend${keysCount === 1 ? '' : 's'} · `}
          {macro.horizon}
        </span>
        {onOpen && <Icon.Arrow width="16" height="16" className="text-neutral-500" />}
      </div>
    </>
  )

  if (onOpen) {
    return (
      <button
        type="button"
        data-zoom-id={`macro-${macro.id}`}
        onClick={(e) => onOpen(macro, e)}
        className="map-clickable relative text-left p-6 sm:p-7 bg-neutral-900/40 border border-neutral-800 hover:border-neutral-700 rounded-lg border-l-[3px] tier-border-macro flex flex-col gap-4 focus:outline-none focus:ring-1 focus:ring-neutral-600"
      >
        {cardContent}
      </button>
    )
  }

  return (
    <div className="relative text-left p-6 sm:p-7 bg-neutral-900/40 border border-neutral-800 rounded-lg border-l-[3px] tier-border-macro flex flex-col gap-4">
      {cardContent}
    </div>
  )
}

function ThinkerChip({ name, onClick }) {
  if (!onClick) {
    return <span className="text-neutral-400 text-xs">{name}</span>
  }
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(name) }}
      className="text-xs text-neutral-400 hover:text-cream underline underline-offset-2 decoration-neutral-700 hover:decoration-neutral-500 transition-colors"
    >
      {name}
    </button>
  )
}
