/**
 * SpatialBackdrop — radial gradient "depth" backdrop behind the domain field.
 *
 * Theme-aware via the --map-spatial-backdrop CSS var defined in map.css:
 *   - Dark mode: a bluish-grey halo lighter than the body, reads as deep space.
 *   - Light mode: a warm paper "spotlight" — slightly brighter than the cream
 *     page bg in the upper-centre, fading to transparent.
 *
 * Sits behind everything; pointer-events: none.
 */
export default function SpatialBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{ background: 'var(--map-spatial-backdrop)' }}
    />
  )
}
