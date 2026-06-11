import Chip from './Chip'
import BookmarkButton from './BookmarkButton'
import { Icon } from '../icons'

/**
 * KeyCard — key-trend card shown within a macro scenario.
 */
export default function KeyCard({ keyTrend, onOpen, subCount, bookmarks, toggle }) {
  return (
    <button
      type="button"
      data-zoom-id={`key-${keyTrend.id}`}
      onClick={(e) => onOpen(keyTrend, e)}
      className="map-clickable relative text-left p-6 bg-neutral-900/40 border border-neutral-800 hover:border-neutral-700 rounded-lg border-l-[3px] tier-border-key flex flex-col gap-3 focus:outline-none focus:ring-1 focus:ring-neutral-600"
    >
      <BookmarkButton id={keyTrend.id} bookmarks={bookmarks} toggle={toggle} />

      <div className="flex items-center justify-between pr-8">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-neutral-500">
          Key trend
        </span>
        <Chip kind="key">Key</Chip>
      </div>

      <h3 className="font-editorial text-xl leading-tight text-cream">
        {keyTrend.name}
      </h3>

      <p className="text-sm text-neutral-400 leading-relaxed">
        {keyTrend.description}
      </p>

      <div className="mt-auto pt-3 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-neutral-500 border-t border-neutral-800">
        <span>{subCount} sub-trend{subCount === 1 ? '' : 's'}</span>
        <Icon.Arrow width="16" height="16" className="text-neutral-500" />
      </div>
    </button>
  )
}
