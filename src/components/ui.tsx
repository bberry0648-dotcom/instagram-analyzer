import type { ReactNode } from 'react'

export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line/70 bg-surface ${className}`}>{children}</div>
}

export function Stat({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: string | null }) {
  const up = delta?.startsWith('+')
  const down = delta?.startsWith('-')
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      {delta && (
        <p className={`mt-0.5 text-xs font-medium tabular-nums ${up ? 'text-good' : down ? 'text-weak' : 'text-muted'}`}>
          {up ? '▲ ' : down ? '▼ ' : ''}
          {delta.replace(/^[+-]/, '')} <span className="font-normal text-muted">지난번 대비</span>
        </p>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <Card className="p-5 text-sm text-muted">{children}</Card>
}
