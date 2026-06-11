/**
 * StarField — ambient parallax dot field behind the domain bubbles.
 *
 * Architecture:
 *   - 4 cluster wrappers (one per domain) — each a motion.div at a fixed
 *     percentage position, with internal child dots laid out as static
 *     <div>s at relative offsets. Animated as a UNIT for drift / scale /
 *     opacity (one motion runtime per cluster, not per dot).
 *   - ~12 atmosphere dots — independent motion.divs drifting across the field.
 *
 * Total animated nodes: 4 + 12 = 16. Static dots inside clusters: 4×10 = 40.
 * All animation properties are transform + opacity (GPU-accelerated).
 *
 * Props:
 *   domains       — domain objects from MapDataContext (need .id)
 *   hoveredId     — currently hovered domain id (cluster brightens, others dim)
 *   selectedId    — currently selected (clicked / warping) domain id
 *   phase         — 'idle' | 'pulling' | 'warping'
 *   reducedMotion — when true, all loop animations are disabled
 */
import { motion } from 'framer-motion'
import {
  DOMAIN_SPATIAL, CLUSTER_DOTS, ATMOSPHERE_DOTS, DOT_HUE_FILL,
  EASE_DRIFT, EASE_ACCEL,
  WARP_EXIT_S,
} from '../motion'

// ── Component ──────────────────────────────────────────────────────────────

export default function StarField({
  domains,
  hoveredId,
  selectedId,
  phase = 'idle',
  reducedMotion = false,
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ willChange: 'transform' }}
    >
      {/* ── Atmosphere dots — slow independent drift across the whole field ── */}
      {ATMOSPHERE_DOTS.map((d, i) => (
        <AtmosphereDot
          key={`atmo-${i}`}
          d={d}
          phase={phase}
          reducedMotion={reducedMotion}
          seed={i}
        />
      ))}

      {/* ── Per-domain clusters ── */}
      {domains.map((domain, i) => {
        const spatial = DOMAIN_SPATIAL[domain.id]
        if (!spatial) return null
        return (
          <Cluster
            key={domain.id}
            cx={spatial.cluster.cx}
            cy={spatial.cluster.cy}
            isHovered={hoveredId === domain.id}
            isSelected={selectedId === domain.id}
            isOtherHovered={hoveredId !== null && hoveredId !== domain.id}
            phase={phase}
            reducedMotion={reducedMotion}
            seed={i}
          />
        )
      })}
    </div>
  )
}

// ── Cluster ────────────────────────────────────────────────────────────────

function Cluster({
  cx, cy,
  isHovered, isSelected, isOtherHovered,
  phase, reducedMotion, seed,
}) {
  // Determine opacity / scale by phase
  let groupOpacity = 1
  let groupScale   = 1

  if (phase === 'pulling') {
    if (isSelected)             { groupOpacity = 1;   groupScale = 1.30 }
    else                        { groupOpacity = 0;   groupScale = 0.92 }
  } else if (phase === 'warping') {
    if (isSelected)             { groupOpacity = 0;   groupScale = 8.5 }
    else                        { groupOpacity = 0;   groupScale = 0.92 }
  } else {
    // idle: hover state controls opacity
    if (isHovered)              groupOpacity = 1
    else if (isOtherHovered)    groupOpacity = 0.45
    else                        groupOpacity = 0.85
  }

  // Cluster-level transition for scale/opacity changes
  const stateTransition =
    phase === 'warping'
      ? { duration: WARP_EXIT_S, ease: EASE_ACCEL }
      : phase === 'pulling'
      ? { duration: 0.42, ease: EASE_ACCEL }
      : { duration: 0.32, ease: 'easeOut' }

  // Drift loop: per-cluster sine drift — different phase per cluster.
  // Hovered clusters drift ~40% faster (the user spec).
  const driftCycle = (isHovered ? 6.0 : 9.0) + seed * 0.8
  const a = (seed * 13) % 7 - 3
  const b = (seed * 17) % 5 - 2
  const driftX = [0, 6 + a, -5 + b, 0]
  const driftY = [0, -5 + b, 7 + a, 0]

  const driftEnabled = !reducedMotion && phase === 'idle'

  return (
    <motion.div
      className="absolute"
      style={{
        left: cx,
        top:  cy,
        width:  '1px',          // anchor point — children position relative
        height: '1px',
        willChange: 'transform, opacity',
      }}
      animate={{
        opacity: groupOpacity,
        scale:   groupScale,
        x: driftEnabled ? driftX : 0,
        y: driftEnabled ? driftY : 0,
      }}
      transition={{
        opacity: stateTransition,
        scale:   stateTransition,
        x: driftEnabled
          ? { duration: driftCycle, ease: EASE_DRIFT, repeat: Infinity, repeatType: 'mirror' }
          : { duration: 0.30 },
        y: driftEnabled
          ? { duration: driftCycle * 1.13, ease: EASE_DRIFT, repeat: Infinity, repeatType: 'mirror', delay: 0.4 }
          : { duration: 0.30 },
      }}
    >
      {CLUSTER_DOTS.map((d, i) => (
        <ClusterDot key={i} d={d} isHovered={isHovered} isSelected={isSelected} phase={phase} />
      ))}
    </motion.div>
  )
}

function ClusterDot({ d, isHovered, isSelected, phase }) {
  // Per-dot opacity — hover boosts the entire cluster, but each dot keeps its own base.
  const baseOp = d.op
  const dotOp =
    phase === 'idle'
      ? (isHovered ? Math.min(1, baseOp + 0.30) : baseOp)
      : (phase === 'pulling' && isSelected) ? Math.min(1, baseOp + 0.40)
      : baseOp

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left:   `${d.dx}px`,
        top:    `${d.dy}px`,
        width:  `${d.r * 2}px`,
        height: `${d.r * 2}px`,
        marginLeft: `${-d.r}px`,
        marginTop:  `${-d.r}px`,
        backgroundColor: DOT_HUE_FILL[d.hue],
        boxShadow:
          d.hue === 'amber'
            ? `0 0 ${d.r * 3}px rgba(232, 178, 116, 0.25)`
            : d.hue === 'cool'
            ? `0 0 ${d.r * 3}px rgba(160, 196, 232, 0.20)`
            : `0 0 ${d.r * 2.5}px rgba(248, 240, 226, 0.18)`,
      }}
      animate={{ opacity: dotOp }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    />
  )
}

// ── Atmosphere dots ─────────────────────────────────────────────────────────

function AtmosphereDot({ d, phase, reducedMotion, seed }) {
  const opacity =
    phase === 'pulling' || phase === 'warping' ? 0 : d.op

  const cycle = 14 + seed * 0.6
  const a = (seed * 11) % 5 - 2
  const b = (seed * 19) % 7 - 3
  const driftX = [0, 8 + a, -7 + b, 0]
  const driftY = [0, -6 + b, 9 + a, 0]

  const driftEnabled = !reducedMotion && phase === 'idle'

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left:   `${d.x}%`,
        top:    `${d.y}%`,
        width:  `${d.r * 2}px`,
        height: `${d.r * 2}px`,
        marginLeft: `${-d.r}px`,
        marginTop:  `${-d.r}px`,
        backgroundColor: DOT_HUE_FILL[d.hue],
        willChange: 'transform, opacity',
      }}
      animate={{
        opacity,
        x: driftEnabled ? driftX : 0,
        y: driftEnabled ? driftY : 0,
      }}
      transition={{
        opacity: { duration: 0.45, ease: 'easeOut' },
        x: driftEnabled
          ? { duration: cycle, ease: EASE_DRIFT, repeat: Infinity, repeatType: 'mirror' }
          : { duration: 0.30 },
        y: driftEnabled
          ? { duration: cycle * 1.07, ease: EASE_DRIFT, repeat: Infinity, repeatType: 'mirror', delay: 0.6 }
          : { duration: 0.30 },
      }}
    />
  )
}
