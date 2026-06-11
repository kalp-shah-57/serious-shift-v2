/**
 * motion.js — Single source of truth for all Framer Motion constants
 * used across the /map section.
 *
 * Import from here. Never hardcode durations or easings in components.
 *
 * // TODO (future): Audio cues would slot in here as a parallel system:
 * //   SOUND_FORWARD  — subtle whoosh when a card expands
 * //   SOUND_REVERSE  — quieter descending tone on back navigation
 * //   SOUND_STAGGER  — faint tick per item in stagger sequences
 * //   SOUND_ORBITAL  — soft resonance when KT orbits snap into position
 */

// ── Easing curves ──────────────────────────────────────────────────────────
export const EASE_WARP   = [0.22, 1, 0.36, 1]        // Forward: expansive out-expo
export const EASE_BACK   = [0.4, 0, 0.2, 1]           // Reverse: tighter ease-in-out
export const EASE_GENTLE = [0.25, 0.46, 0.45, 0.94]   // Content fade-in

// Cinematic warp easing: aggressive acceleration into the warp, soft deceleration out.
export const EASE_ACCEL  = [0.7, 0, 0.84, 0]          // Phase 1-2: pull + warp out
export const EASE_DECEL  = [0, 0, 0.2, 1]             // Phase 3-4: resolve + settle
export const EASE_DRIFT  = [0.45, 0, 0.55, 1]         // Quasi-sine for 0-G float loops

// Shared-element morph: card → hero, dot → scenario card.
// Slow start, fast middle, slow end — gives "warp" pacing as a single curve.
export const EASE_MORPH  = [0.7, 0, 0.2, 1]

// ── Durations (seconds) ────────────────────────────────────────────────────
export const DUR_MORPH    = 0.65   // card → hero shared-element morph
export const DUR_WARP_OUT = 0.42   // non-selected card warp exit
export const DUR_WARP_IN  = 0.38   // cards animate back in on landing
export const DUR_HERO_IN  = 0.40   // detail-page hero content entrance
export const DUR_CONTENT  = 0.35   // KT / sub-trend stagger items
export const DUR_REVERSE  = 0.45   // back-navigation reverse morph
export const DUR_FAST     = 0.20   // quick micro-interactions

// ── Stagger delays (seconds) ───────────────────────────────────────────────
export const STAGGER_KT   = 0.08   // key trend list items
export const STAGGER_SUB  = 0.05   // sub-trend items within a KT
export const STAGGER_CARD = 0.04   // card items in a grid

// ── Navigation delay ───────────────────────────────────────────────────────
/** ms between click and route change — gives the warp animation time to run */
export const NAV_DELAY_MS = 620

// ── Cinematic warp timing (seconds) ────────────────────────────────────────
// Total perceived duration: ~2200ms broken into 4 phases.
//   Phase 1 (0–500ms)    pulling      MapLanding still mounted, others fade
//   Phase 2 (500–1400ms) warping      MapLanding exits, selected card scales out
//   Phase 3 (1400–2000ms) resolving   DomainDetail mounts, content emerges from depth
//   Phase 4 (2000–2400ms) settling    Content lands, drift returns
// Legacy phased-warp constants — kept for any remaining references.
export const WARP_PULL_MS    = 500
export const WARP_EXIT_S     = 0.90
export const WARP_BLUR_PEAK_S = 0.40
export const WARP_ENTRY_S    = 0.95
export const WARP_SETTLE_S   = 0.45

// ── Shared-element morph timing ───────────────────────────────────────────
// The morph is a single continuous animation, not a sequence of phases.
// Atmosphere effects (background blur, non-clicked card fade, text content
// fade-in) overlay on top without interrupting the morph.
export const MORPH_FORWARD_S = 2.0   // card → hero, dot → scenario card
export const MORPH_REVERSE_S = 0.80  // hero → card on back-nav
// Atmosphere timings (ms, expressed relative to the click moment)
export const ATMO_BLUR_START_MS  = 200
export const ATMO_BLUR_END_MS    = 1200
export const ATMO_FADE_OUT_MS    = 800     // non-clicked cards fade out duration
export const TEXT_REVEAL_DELAY_MS = 1500   // text content begins fading in at this point
export const TEXT_REVEAL_DUR_S   = 0.55    // text fade-in duration
export const REVERSE_TOTAL_S = 0.70    // Reverse animation (back-nav)

// ── 0-G drift config ──────────────────────────────────────────────────────
/** Per-card subtle continuous drift. Different phase per card by index. */
export const DRIFT_DURATIONS = [7.4, 8.6, 9.2, 6.8]  // seconds per card cycle
export const DRIFT_PHASES    = [0, 1.7, 3.1, 4.4]    // seconds offset per card

// ── Reusable Framer Motion variants ────────────────────────────────────────

// ── Reusable Framer Motion variants ────────────────────────────────────────

/**
 * DOMAIN_SPATIAL — asymmetric "zero-G" placement of the four domain cards.
 *
 * Coordinates are percentages of the spatial container, defining the TOP-LEFT
 * of each card (cards are absolutely positioned). Slight rotations add to the
 * non-grid feel. Cluster centers tag where the card's associated dot cluster
 * anchors — typically offset toward the card's outer edge so the dots feel
 * like they belong "behind" the card.
 *
 * On mobile (<640px) MapLanding falls back to a simple stacked layout and
 * ignores these positions.
 */
export const DOMAIN_SPATIAL = {
  society: {
    card:    { x: '4%',  y: '4%',  rot: -1.2 },
    cluster: { cx: '14%', cy: '20%' },
  },
  economy: {
    card:    { x: '54%', y: '12%', rot:  1.5 },
    cluster: { cx: '82%', cy: '24%' },
  },
  consumers: {
    card:    { x: '2%',  y: '54%', rot:  0.8 },
    cluster: { cx: '18%', cy: '78%' },
  },
  organisations: {
    card:    { x: '56%', y: '60%', rot: -0.6 },
    cluster: { cx: '84%', cy: '76%' },
  },
}

/**
 * Per-cluster dot positions (relative offsets from cluster center, in %).
 * Each cluster has 10 dots of varying size and base opacity. The same set is
 * used for the 4 clusters but the cluster-level transform is what positions
 * them on screen.
 *
 * Sizes (in px), opacities (0..1), and color hints chosen for warm-cool
 * variance against the dark backdrop.
 */
export const CLUSTER_DOTS = [
  { dx: -42, dy: -28, r: 4.5, op: 0.38, hue: 'warm'  },
  { dx:  18, dy: -50, r: 3.0, op: 0.30, hue: 'cool'  },
  { dx:  60, dy: -16, r: 6.5, op: 0.42, hue: 'amber' },
  { dx: -64, dy:   8, r: 3.5, op: 0.28, hue: 'cool'  },
  { dx:  10, dy:  12, r: 8.0, op: 0.32, hue: 'warm'  },
  { dx:  46, dy:  34, r: 4.0, op: 0.36, hue: 'amber' },
  { dx: -28, dy:  46, r: 5.5, op: 0.30, hue: 'warm'  },
  { dx:  72, dy:  56, r: 3.0, op: 0.26, hue: 'cool'  },
  { dx: -56, dy:  62, r: 6.0, op: 0.34, hue: 'amber' },
  { dx:  24, dy:  80, r: 3.5, op: 0.28, hue: 'warm'  },
]

/**
 * Atmosphere dots — not associated with any cluster, drift independently
 * across the whole field for depth. Positions are absolute % of the field.
 */
export const ATMOSPHERE_DOTS = [
  { x: 38,  y:  8,  r: 2.5, op: 0.18, hue: 'cool'  },
  { x: 88,  y: 48,  r: 3.0, op: 0.22, hue: 'warm'  },
  { x:  6,  y: 36,  r: 2.0, op: 0.16, hue: 'amber' },
  { x: 68,  y: 88,  r: 2.8, op: 0.20, hue: 'cool'  },
  { x: 46,  y: 92,  r: 2.0, op: 0.18, hue: 'warm'  },
  { x: 12,  y: 96,  r: 3.2, op: 0.22, hue: 'amber' },
  { x: 94,  y: 12,  r: 2.4, op: 0.18, hue: 'warm'  },
  { x: 42,  y: 46,  r: 2.0, op: 0.14, hue: 'cool'  },
  { x: 30,  y: 26,  r: 2.6, op: 0.16, hue: 'amber' },
  { x: 76,  y: 64,  r: 2.2, op: 0.18, hue: 'cool'  },
  { x:  8,  y: 70,  r: 2.6, op: 0.20, hue: 'warm'  },
  { x: 60,  y: 38,  r: 2.0, op: 0.14, hue: 'cool'  },
]

/** Hue → CSS color. Warm whites, faded blues, soft amber — all dark-theme friendly. */
export const DOT_HUE_FILL = {
  warm:  'rgb(248, 240, 226)',  // warm white
  cool:  'rgb(160, 196, 232)',  // faded blue
  amber: 'rgb(232, 178, 116)',  // soft amber
}

/** Fade upward: items in lists, content blocks */
export const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0  },
}

/** Plain fade without translate */
export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
}

/** Container that staggers its children. Call with desired stagger time. */
export const staggerContainer = (staggerTime = STAGGER_KT, delay = 0.1) => ({
  hidden:  {},
  visible: {
    transition: { staggerChildren: staggerTime, delayChildren: delay },
  },
})

/**
 * Compute the radial exit direction for a card warping away from the selected card.
 *
 * Assumes a 3-column grid (desktop layout). The direction vector points
 * from the selected card's grid position toward the other card, so each
 * card scatters outward from the focal point.
 *
 * @param {number} cardIdx    index of the card being warped out
 * @param {number} selectedIdx index of the clicked (selected) card
 * @param {number} xMag       horizontal magnitude in px (default 140)
 * @param {number} yMag       vertical magnitude in px (default 100)
 */
export function radialExit(cardIdx, selectedIdx, xMag = 140, yMag = 100) {
  const COLS = 3
  const cRow = Math.floor(cardIdx  / COLS), cCol = cardIdx  % COLS
  const sRow = Math.floor(selectedIdx / COLS), sCol = selectedIdx % COLS
  const dx = cCol - sCol
  const dy = cRow - sRow
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // If a card shares a row+col with the selected (shouldn't happen with unique indices,
  // but guard anyway): exit diagonally down-right as a fallback.
  const nx = dx === 0 && dy === 0 ? 1 : dx / len
  const ny = dx === 0 && dy === 0 ? 1 : dy / len
  return { x: nx * xMag, y: ny * yMag }
}
