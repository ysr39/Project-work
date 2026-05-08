import { Search } from 'lucide-react'
import { InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        type="search"
        className={clsx(
          'w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3',
          'text-sm text-slate-800 placeholder-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
        )}
        {...props}
      />
    </div>
  )
}
