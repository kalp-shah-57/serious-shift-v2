/**
 * palette.js — domain color palette + horizon/velocity labels.
 *
 * Centralised so every map layer (landing, domain, scenario, KT, sub-trend)
 * uses the same tint and the colour persists down the warp hierarchy.
 */

export const DOMAIN_COLORS = {
  society:       { color: 'var(--map-macro)', soft: 'var(--map-macro-soft)' },
  economy:       { color: 'var(--map-key)',   soft: 'var(--map-key-soft)'   },
  consumers:     { color: 'var(--map-sub)',   soft: 'var(--map-sub-soft)'   },
  organisations: { color: '#6ee7b7',          soft: 'color-mix(in oklab, #6ee7b7 14%, transparent)' },
}

export const DEFAULT_PALETTE = DOMAIN_COLORS.society

export const HORIZON_LABELS = {
  '1-3 years':  'Near-term',
  '3-5 years':  'Mid-term',
  '5-10 years': 'Long-term',
}

export const VELOCITY_LABEL = {
  accelerating:  'Accelerating',
  steady:        'Steady',
  decelerating:  'Decelerating',
  emergent:      'Emergent',
  early:         'Early',
  mature:        'Mature',
}

export function paletteFor(domainId) {
  return DOMAIN_COLORS[domainId] || DEFAULT_PALETTE
}

export function pad(n, width) {
  return String(n).padStart(width, '0')
}
