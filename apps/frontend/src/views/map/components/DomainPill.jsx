/**
 * DomainPill — coloured domain tag for society / economy / consumers / organisations.
 */
const DOMAIN_STYLES = {
  society:       'bg-violet-950/60 text-violet-300  border-violet-800/50',
  economy:       'bg-amber-950/60  text-amber-300   border-amber-800/50',
  consumers:     'bg-sky-950/60    text-sky-300     border-sky-800/50',
  organisations: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
}

const DOMAIN_LABELS = {
  society:       'Society',
  economy:       'Economy',
  consumers:     'Consumers',
  organisations: 'Organisations',
}

export default function DomainPill({ domain, size = 'sm' }) {
  const style = DOMAIN_STYLES[domain] || 'bg-neutral-800 text-neutral-400 border-neutral-700'
  const label = DOMAIN_LABELS[domain] || domain

  return (
    <span
      className={`inline-flex items-center border rounded px-1.5 py-0.5 font-mono leading-none ${style} ${
        size === 'xs'
          ? 'text-[9px] tracking-[0.1em] uppercase'
          : 'text-[10px] tracking-[0.12em] uppercase'
      }`}
    >
      {label}
    </span>
  )
}
