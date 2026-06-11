/**
 * warp.jsx — shared cinematic warp transition primitives for the map.
 *
 * The pattern is identical at every layer (domain → scenario → KT → sub-trend):
 *
 *   • Source side: clicked card pulls toward viewport center + scales up,
 *     siblings fade out; a brief background blur sells the "going-to-warp"
 *     feel. After ~500ms the route changes and the card scales massively.
 *
 *   • Destination side: a fixed full-screen radial-gradient overlay
 *     starts opaque + slightly scaled, fades + scales down to clear.
 *     Page content fades up underneath with a delay so it lands AFTER
 *     the overlay has visibly cleared.
 *
 * Reverse navigation (breadcrumb / back-link) is a plain route change —
 * no source warp is run, the destination still does its overlay fade so
 * the visual still feels intentional, just faster.
 *
 * This is the same scale+translate technique used by MapLanding for the
 * original /map → /map/:domain warp — we just generalise it so grid
 * layouts at deeper layers can reuse the exact same atmosphere.
 */
import { useCallback, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  EASE_ACCEL, EASE_DECEL, EASE_GENTLE,
  WARP_PULL_MS, WARP_EXIT_S,
  WARP_ENTRY_S, WARP_SETTLE_S,
} from './motion'

// ── Warp signalling via sessionStorage ─────────────────────────────────────
// We use a single global key so any destination page can detect "I'm being
// arrived at via warp from <key>". The key is whatever the source decides
// — a domain id, scenario slug, KT slug, etc.
const SS_KEY = 'ss-map-warp-from'

function setWarpSignal(key) {
  try { sessionStorage.setItem(SS_KEY, key) } catch {}
}
function readAndClearWarpSignal() {
  try {
    const v = sessionStorage.getItem(SS_KEY)
    if (v != null) sessionStorage.removeItem(SS_KEY)
    return v
  } catch {
    return null
  }
}

/**
 * useWarpEntry(expectedKey) — destination hook.
 *
 * Returns true only on the first render that follows a warp navigation
 * whose source key matches `expectedKey`. Reads sessionStorage once and
 * clears it so a refresh after the warp doesn't re-trigger the overlay.
 */
export function useWarpEntry(expectedKey) {
  // Read synchronously on first render; capture in a ref so re-renders
  // don't flip the value back to false after the signal is cleared.
  const initial = useRef(null)
  if (initial.current === null) {
    const v = readAndClearWarpSignal()
    initial.current = v === expectedKey
  }
  return initial.current
}

/**
 * useWarpExit() — source hook for any page whose cards warp into a
 * deeper page. Returns:
 *
 *   phase          'idle' | 'pulling' | 'warping'
 *   selectedKey    the key passed to launch() (e.g. card id / slug)
 *   launch(key, destinationPath)
 *                  sets the warp signal, kicks off the pulling phase,
 *                  then after WARP_PULL_MS navigates to destinationPath.
 *   reducedMotion  pass-through for callers that want to disable visuals
 */
export function useWarpExit() {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState('idle')
  const [selectedKey, setSelectedKey] = useState(null)

  const launch = useCallback((key, destinationPath) => {
    if (phase !== 'idle') return
    setSelectedKey(key)
    setPhase('pulling')

    if (reducedMotion) {
      // Skip the cinematic timing — straight navigation.
      setWarpSignal(key)
      setTimeout(() => navigate(destinationPath), 16)
      return
    }

    setWarpSignal(key)
    setTimeout(() => {
      setPhase('warping')
      navigate(destinationPath)
    }, WARP_PULL_MS)
  }, [phase, reducedMotion, navigate])

  return { phase, selectedKey, launch, reducedMotion }
}

// ── Destination overlay ────────────────────────────────────────────────────
// Fixed full-screen radial gradient that scales+fades to clear. Mounted
// only when useWarpEntry() returned true.

const WARP_OVERLAY_INITIAL = { opacity: 1, scale: 1.45 }
const WARP_OVERLAY_ANIMATE = { opacity: 0, scale: 1.0  }
const WARP_OVERLAY_TRANS   = {
  duration: WARP_ENTRY_S + WARP_SETTLE_S * 0.5,
  ease: EASE_DECEL,
}

export function WarpResolutionOverlay({ active, tint }) {
  if (!active) return null
  // Use a tint hint (the destination domain's accent color) so each domain
  // arrives in its own atmospheric color.
  const gradient = tint
    ? `radial-gradient(ellipse at 50% 40%, color-mix(in oklab, ${tint} 28%, rgba(28,28,38,0.92)) 0%, rgba(12,12,18,0.4) 55%, rgba(0,0,0,0) 100%)`
    : 'radial-gradient(ellipse at 50% 40%, rgba(28,28,38,0.92) 0%, rgba(12,12,18,0.4) 55%, rgba(0,0,0,0) 100%)'
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 z-40 pointer-events-none"
      initial={WARP_OVERLAY_INITIAL}
      animate={WARP_OVERLAY_ANIMATE}
      transition={WARP_OVERLAY_TRANS}
      style={{
        background: gradient,
        transformOrigin: '50% 40%',
        willChange: 'transform, opacity',
      }}
    />
  )
}

// ── Atmosphere wrapper for the SOURCE side ─────────────────────────────────
// Wraps the grid that contains the warpable cards. Applies the brief
// background blur during the warp exit so it feels like the camera itself
// is moving.
export function WarpAtmosphere({ phase, children, className = '', style }) {
  const isWarping = phase === 'warping'
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      animate={
        isWarping && !reducedMotion
          ? { filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'] }
          : { filter: 'blur(0px)' }
      }
      transition={
        isWarping && !reducedMotion
          ? { duration: WARP_EXIT_S, ease: EASE_ACCEL, times: [0, 0.55, 1] }
          : { duration: 0.20 }
      }
      className={`relative ${className}`}
      style={{ willChange: 'filter', ...style }}
    >
      {children}
    </motion.div>
  )
}

// ── Warpable grid card ─────────────────────────────────────────────────────
// A card that participates in the cinematic warp on click. Measures its own
// position relative to viewport center on click, then animates toward that
// center while scaling up. Other cards (where isSelected=false but phase
// !== 'idle') fade out and shrink.
//
// This is the grid counterpart to MapLanding's absolutely-positioned
// asymmetric DomainCard — same visual behaviour, computed from real DOM
// coordinates so it works in any grid.
export function WarpableCard({
  cardKey,
  phase,
  isSelected,
  onClick,
  children,
  className = '',
  style,
  whileHover,
}) {
  const ref = useRef(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const reducedMotion = useReducedMotion()

  const handleClick = useCallback(() => {
    if (phase !== 'idle') return
    // Capture viewport-center offset now, before the animation starts.
    const el = ref.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const cardCx = rect.left + rect.width  / 2
      const cardCy = rect.top  + rect.height / 2
      const targetCx = window.innerWidth  / 2
      // Bias the target slightly above true center so the card lands where
      // a future hero would sit (matches MapLanding's 40% horizon).
      const targetCy = window.innerHeight * 0.40
      offsetRef.current = {
        x: targetCx - cardCx,
        y: targetCy - cardCy,
      }
    }
    onClick?.(cardKey)
  }, [phase, onClick, cardKey])

  // Compute target transform based on warp phase
  let targetScale = 1, targetOpacity = 1, targetX = 0, targetY = 0
  let stateTransition = { duration: 0.25, ease: EASE_GENTLE }

  if (phase === 'pulling') {
    if (isSelected) {
      targetScale   = 1.18
      targetX       = offsetRef.current.x * 0.22
      targetY       = offsetRef.current.y * 0.22
      stateTransition = { duration: WARP_PULL_MS / 1000, ease: EASE_ACCEL }
    } else {
      targetScale   = 0.94
      targetOpacity = 0
      stateTransition = { duration: WARP_PULL_MS / 1000, ease: EASE_ACCEL }
    }
  } else if (phase === 'warping') {
    if (isSelected) {
      targetScale   = 10
      targetX       = offsetRef.current.x
      targetY       = offsetRef.current.y
      stateTransition = { duration: WARP_EXIT_S, ease: EASE_ACCEL }
    } else {
      targetScale   = 0.94
      targetOpacity = 0
      stateTransition = { duration: WARP_EXIT_S, ease: EASE_ACCEL }
    }
  }

  const animateProps = phase === 'idle'
    ? { opacity: 1, scale: 1, x: 0, y: 0 }
    : { opacity: targetOpacity, scale: targetScale, x: targetX, y: targetY }

  // Disable hover effects while warping
  const hoverProps = phase === 'idle' && !reducedMotion ? whileHover : undefined

  return (
    <motion.div
      ref={ref}
      onClick={handleClick}
      animate={animateProps}
      transition={stateTransition}
      whileHover={hoverProps}
      className={className}
      style={{
        cursor: phase === 'idle' ? 'pointer' : 'default',
        zIndex: isSelected ? 20 : 1,
        willChange: 'transform, opacity',
        ...style,
      }}
    >
      {children}
    </motion.div>
  )
}

// ── Entrance helpers (destination side) ────────────────────────────────────
// All deep pages share the same content-fade-in choreography after a warp:
// items fade up with a base delay so they land AFTER the overlay clears.

export const HIDDEN_UP   = { opacity: 0, y: 18 }
export const VISIBLE     = { opacity: 1, y: 0  }
export const HIDDEN_DOWN = { opacity: 0, y: -6 }
export const PAGE_EXIT   = { opacity: 0, transition: { duration: 0.18 } }

/**
 * Compute entrance timing for a destination page.
 *   warpEntry — was this page arrived at via warp?
 */
export function entranceTiming(warpEntry) {
  return {
    base:   warpEntry ? WARP_ENTRY_S * 0.45 : 0,
    ease:   warpEntry ? EASE_DECEL : EASE_GENTLE,
    dur:    warpEntry ? 0.50 : 0.35,
  }
}
