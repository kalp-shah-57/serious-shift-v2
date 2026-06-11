import { useEffect, useRef } from 'react'

/**
 * ZoomOverlay — shared-element clone that expands from the clicked
 * card's rect toward the destination layer's measured head rect.
 *
 * Sequencing (important — changed from the first version):
 *   1. Parent sets zoomState with {start, end: null, color}. Overlay
 *      mounts at source rect, opacity 1. Geometry transitions are
 *      already "armed" via CSS; nothing animates yet because we don't
 *      write new geometry until `end` is known.
 *   2. Parent measures the destination layer's head rect in a
 *      useLayoutEffect and updates zoomState with the real `end`.
 *   3. Our effect fires on the new zoomState. One rAF later we write
 *      end geometry + opacity 0 — both transitions begin together.
 *      (One rAF is enough because React committed the previous
 *      geometry before the browser paint that ends this frame.)
 *   4. 380ms later (350ms animation + 30ms safety buffer so we don't
 *      cut off mid-fade) we call onEnd and the parent unmounts us.
 *
 * Race protection: if zoomState changes mid-flight (user clicks a
 * second card during an animation) the effect's cleanup cancels the
 * in-flight rAF and timer, and the next run reads the new
 * zoomState. Inline styles from the previous run are overwritten in
 * the new raf.
 */
export default function ZoomOverlay({ zoomState, onEnd }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!zoomState || !zoomState.end) return
    const el = ref.current
    if (!el) return

    const raf = requestAnimationFrame(() => {
      el.style.top = zoomState.end.top + 'px'
      el.style.left = zoomState.end.left + 'px'
      el.style.width = zoomState.end.width + 'px'
      el.style.height = zoomState.end.height + 'px'
      el.style.opacity = '0'
    })
    // 350ms animation + 30ms buffer so opacity fade (which finishes
    // at +350ms via delay) doesn't get cut off by early unmount.
    const timer = setTimeout(onEnd, 380)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [zoomState, onEnd])

  if (!zoomState) return null
  const { start, color } = zoomState

  return (
    <div
      ref={ref}
      className="zoom-overlay"
      style={{
        top: start.top,
        left: start.left,
        width: start.width,
        height: start.height,
        borderLeftColor: `var(${color})`,
      }}
    />
  )
}
