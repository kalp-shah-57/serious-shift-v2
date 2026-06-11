export default function StatusBadge({ status }) {
  const cls = {
    true: 'badge-true',
    false: 'badge-false',
    partially_true: 'badge-partially_true',
    pending: 'badge-pending',
    expired: 'badge-expired',
  }[status] || 'badge-pending'

  const label = status === 'partially_true' ? 'Partial' : status || 'pending'

  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${cls}`}>
      {label}
    </span>
  )
}
