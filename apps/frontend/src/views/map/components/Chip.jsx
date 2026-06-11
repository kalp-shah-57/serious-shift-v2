/**
 * Chip — tier label with a colored dot.
 * kind: 'macro' | 'key' | 'sub'
 */
export default function Chip({ kind = 'macro', children }) {
  return (
    <span
      className={`tier-${kind} inline-flex items-center text-[10px] tracking-[0.14em] uppercase font-mono text-neutral-400`}
    >
      <span className="tier-dot" />
      {children}
    </span>
  )
}
