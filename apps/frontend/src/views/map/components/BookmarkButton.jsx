import { Icon } from '../icons'

/**
 * BookmarkButton — toggle a bookmark id.
 * Must stop propagation so clicks don't also trigger the parent card.
 */
export default function BookmarkButton({ id, bookmarks, toggle }) {
  const active = bookmarks.includes(id)
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={active ? 'Remove bookmark' : 'Add bookmark'}
      data-active={active}
      className={`absolute top-4 right-4 p-1 rounded transition-colors ${
        active ? 'text-accent' : 'text-neutral-600 hover:text-neutral-300'
      } cursor-pointer`}
      onClick={(e) => {
        e.stopPropagation()
        toggle(id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation()
          e.preventDefault()
          toggle(id)
        }
      }}
    >
      <Icon.Bookmark filled={active} width="16" height="16" />
    </span>
  )
}
