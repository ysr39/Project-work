import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label:     string
  value:     string | number
  icon:      ReactNode
  iconBg:    string
  change?:   number   // percent, positive = up
  prefix?:   string
  loading?:  boolean
}

export function StatCard({ label, value, icon, iconBg, change, prefix, loading }: StatCardProps) {
  const isUp   = (change ?? 0) > 0
  const isDown = (change ?? 0) < 0

  return (
    <div className="bg-white rounded-xl shadow-card border border-slate-100 p-5">
      <div className="flex items-start justify-between">
        <div className={clsx('p-2.5 rounded-lg', iconBg)}>
          {icon}
        </div>
        {change !== undefined && (
          <span className={clsx(
            'inline-flex items-center gap-0.5 text-xs font-medium',
            isUp   && 'text-emerald-600',
            isDown && 'text-red-500',
            !isUp && !isDown && 'text-slate-400',
          )}>
            {isUp   && <TrendingUp  className="h-3.5 w-3.5" />}
            {isDown && <TrendingDown className="h-3.5 w-3.5" />}
            {!isUp && !isDown && <Minus className="h-3.5 w-3.5" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-7 w-24 bg-slate-100 animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-bold text-slate-800 tracking-tight">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  )
}
