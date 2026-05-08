import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size    = 'sm' | 'md' | 'lg'

const variantCls: Record<Variant, string> = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-primary-500',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost:     'text-slate-600 hover:bg-slate-100 focus:ring-primary-500',
}
const sizeCls: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  icon?:     ReactNode
  children:  ReactNode
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg font-medium',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variantCls[variant], sizeCls[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
