import { Icon } from '../icons'

/**
 * SubRow — flat list-row for a sub-trend inside a key trend.
 * Layout: [N01] [title] [arrow]
 */
export default function SubRow({ sub, number, onOpen }) {
  return (
    <button
      type="button"
      data-zoom-id={`sub-${sub.id}`}
      onClick={(e) => onOpen(sub, e)}
      className="map-clickable w-full text-left grid grid-cols-[70px_1fr_24px] items-center gap-4 px-5 py-4 bg-neutral-900/30 border border-neutral-800 hover:border-neutral-700 rounded-md border-l-[3px] tier-border-sub focus:outline-none focus:ring-1 focus:ring-neutral-600"
    >
      <span className="font-mono text-[11px] tracking-[0.18em] tier-sub">
        {number}
      </span>
      <span className="font-editorial text-lg text-cream leading-snug">
        {sub.name}
      </span>
      <Icon.Arrow width="16" height="16" className="text-neutral-500 justify-self-end" />
    </button>
  )
}
