import { clsx } from 'clsx'
import { ReactNode } from 'react'

export function Card({
  children, className, padding = true,
}: {
  children:  ReactNode
  className?: string
  padding?:   boolean
}) {
  return (
    <div className={clsx(
      'bg-white rounded-xl shadow-card border border-slate-100',
      padding && 'p-5',
      className,
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: {
  title:     string
  subtitle?: string
  action?:   ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
