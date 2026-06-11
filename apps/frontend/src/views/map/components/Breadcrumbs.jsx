/**
 * StickyBreadcrumb — persistent wayfinding bar that sticks below the
 * app header (h-28 mobile / h-32 desktop). The previous map sub-nav was
 * removed during the soft-launch redesign.
 *
 * Props:
 *   crumbs — array of { label, to? }
 *            If `to` is set the segment is a <Link>; otherwise plain text.
 *            The last crumb is always rendered as the "current" page.
 *
 * Usage:
 *   <StickyBreadcrumb crumbs={[
 *     { label: 'Home', to: '/map' },
 *     { label: 'Thinkers', to: '/map/thinkers' },
 *     { label: 'Tyler Cowen' },
 *   ]} />
 */
import { Fragment } from 'react'
import { Link } from 'react-router-dom'

export default function StickyBreadcrumb({ crumbs }) {
  if (!crumbs || crumbs.length === 0) return null

  return (
    <div className="sticky top-28 sm:top-32 z-20 bg-neutral-950/90 backdrop-blur-sm border-b border-neutral-800/60">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center gap-2 overflow-x-auto"
        aria-label="Breadcrumb"
      >
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && (
                /* Bigger + darker separator so it reads cleanly in light mode
                   too (where the old text-neutral-700 resolved to near-white). */
                <span className="text-neutral-400 shrink-0 select-none text-sm">›</span>
              )}
              {c.to && !isLast ? (
                <Link
                  to={c.to}
                  className="font-mono text-xs uppercase tracking-widest text-neutral-500 hover:text-cream transition-colors whitespace-nowrap shrink-0"
                >
                  {c.label}
                </Link>
              ) : (
                /* Current page: bold + cream (which is near-black in light
                   mode via the theme override). Makes the active crumb the
                   visual anchor of the bar. */
                <span
                  className={`font-mono text-xs uppercase tracking-widest whitespace-nowrap shrink-0 ${
                    isLast ? 'text-cream font-bold' : 'text-neutral-500'
                  }`}
                >
                  {c.label}
                </span>
              )}
            </Fragment>
          )
        })}
      </nav>
    </div>
  )
}
