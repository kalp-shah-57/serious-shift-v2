import { Icon } from '../icons'
import { useMapLookup } from '../MapDataContext'

/**
 * BookmarksLayer — flat view of everything the user has bookmarked
 * (macros, key trends, or sub-trends). Click to open, Remove to clear.
 */
export default function BookmarksLayer({
  bookmarks,
  clearBookmark,
  onOpenMacro,
  onOpenKey,
  onOpenSub,
}) {
  const { macroMap, keyMap, subMap } = useMapLookup()

  const items = bookmarks
    .map((id) => {
      if (macroMap[id]) {
        return {
          kind: 'Macro',
          tier: 'macro',
          node: macroMap[id],
          open: () => onOpenMacro(macroMap[id]),
        }
      }
      if (keyMap[id]) {
        return {
          kind: 'Key',
          tier: 'key',
          node: keyMap[id],
          open: () => onOpenKey(keyMap[id]),
        }
      }
      if (subMap[id]) {
        return {
          kind: 'Sub',
          tier: 'sub',
          node: subMap[id],
          open: () => onOpenSub(subMap[id]),
        }
      }
      return null
    })
    .filter(Boolean)

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
          Saved
        </p>
        <h1 className="font-editorial text-4xl text-cream">Nothing saved yet.</h1>
        <p className="mt-5 text-neutral-400 text-base leading-relaxed">
          Bookmark trends from anywhere in the map — they'll collect here.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
        Saved
      </p>
      <h1 className="font-editorial text-3xl sm:text-4xl text-cream">
        Your bookmarked trends.
      </h1>
      <p className="mt-3 mb-10 text-neutral-400 text-sm leading-relaxed">
        {items.length} item{items.length === 1 ? '' : 's'} across the map.
      </p>

      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div
            key={i}
            className={`grid grid-cols-[70px_1fr_auto_24px] items-center gap-4 px-5 py-4 bg-neutral-900/30 border border-neutral-800 rounded-md border-l-[3px] tier-border-${it.tier} hover:border-neutral-700 transition-colors`}
          >
            <button
              onClick={it.open}
              className="contents text-left"
              aria-label={`Open ${it.node.name}`}
            >
              <span
                className={`tier-${it.tier} font-mono text-[10px] tracking-widest uppercase`}
              >
                {it.kind}
              </span>
              <span className="font-editorial text-lg text-cream leading-snug">
                {it.node.name}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearBookmark(it.node.id)
              }}
              className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors px-2"
            >
              Remove
            </button>
            <Icon.Arrow
              width="16"
              height="16"
              className="text-neutral-600 cursor-pointer"
              onClick={it.open}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
