import { clsx } from 'clsx'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const styles: Record<Variant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50  text-amber-700  ring-amber-200',
  danger:  'bg-red-50    text-red-700    ring-red-200',
  info:    'bg-blue-50   text-blue-700   ring-blue-200',
  neutral: 'bg-slate-50  text-slate-600  ring-slate-200',
}

export function Badge({ label, variant = 'neutral', dot = false }: {
  label:    string
  variant?: Variant
  dot?:     boolean
}) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
      'text-xs font-medium ring-1 ring-inset',
      styles[variant],
    )}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', {
        'bg-emerald-500': variant === 'success',
        'bg-amber-500':   variant === 'warning',
        'bg-red-500':     variant === 'danger',
        'bg-blue-500':    variant === 'info',
        'bg-slate-400':   variant === 'neutral',
      })} />}
      {label}
    </span>
  )
}

// Convenience mappings
export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    ACTIVE:       { label: 'Active',       variant: 'success' },
    APPROVED:     { label: 'Approved',     variant: 'success' },
    COMPLETED:    { label: 'Completed',    variant: 'success' },
    CAPTURED:     { label: 'Paid',         variant: 'success' },
    PENDING:      { label: 'Pending',      variant: 'warning' },
    SEARCHING:    { label: 'Searching',    variant: 'warning' },
    MATCHED:      { label: 'Matched',      variant: 'info'    },
    ARRIVING:     { label: 'Arriving',     variant: 'info'    },
    ARRIVED:      { label: 'Arrived',      variant: 'info'    },
    IN_PROGRESS:  { label: 'In Progress',  variant: 'info'    },
    SUSPENDED:    { label: 'Suspended',    variant: 'danger'  },
    BANNED:       { label: 'Banned',       variant: 'danger'  },
    REJECTED:     { label: 'Rejected',     variant: 'danger'  },
    CANCELLED:    { label: 'Cancelled',    variant: 'danger'  },
    REFUNDED:     { label: 'Refunded',     variant: 'neutral' },
    FAILED:       { label: 'Failed',       variant: 'danger'  },
  }
  const cfg = map[status] ?? { label: status, variant: 'neutral' as Variant }
  return <Badge label={cfg.label} variant={cfg.variant} dot />
}
