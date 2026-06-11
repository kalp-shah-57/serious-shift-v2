export default function CredScore({ score, size = 'md' }) {
  const color = score >= 53 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
  const sz = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  return (
    <span className={`font-mono font-bold ${color} ${sz}`}>
      {typeof score === 'number' ? score.toFixed(1) : score}
    </span>
  )
}
