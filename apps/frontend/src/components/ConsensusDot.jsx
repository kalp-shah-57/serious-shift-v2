export default function ConsensusDot({ value }) {
  const v = parseFloat(value) || 0
  const hue = v * 120 // 0 = red, 120 = green
  return (
    <span
      className="inline-block w-3 h-3 rounded-full"
      style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
      title={`Consensus: ${v.toFixed(2)}`}
    />
  )
}
