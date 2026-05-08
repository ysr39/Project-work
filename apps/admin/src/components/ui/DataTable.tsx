import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageSpinner } from './Spinner'

export interface Column<T> {
  key:       string
  header:    string
  width?:    string
  render:    (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns:    Column<T>[]
  data:       T[]
  loading?:   boolean
  emptyText?: string
  page?:      number
  total?:     number
  limit?:     number
  onPage?:    (page: number) => void
  rowKey:     (row: T) => string
}

export function DataTable<T>({
  columns, data, loading, emptyText = 'No data found',
  page = 1, total = 0, limit = 20, onPage, rowKey,
}: DataTableProps<T>) {
  const pages      = Math.max(1, Math.ceil(total / limit))
  const showPager  = !!onPage && pages > 1
  const start      = (page - 1) * limit + 1
  const end        = Math.min(page * limit, total)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                    col.width,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <PageSpinner />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-slate-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-sm text-slate-700 align-middle">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPager && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">
            Showing <span className="font-medium">{start}–{end}</span> of{' '}
            <span className="font-medium">{total}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPage(page - 1)}
              disabled={page === 1}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
              const p = i + Math.max(1, page - 2)
              return p <= pages ? (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  className={clsx(
                    'rounded px-2.5 py-1 text-xs font-medium',
                    p === page
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {p}
                </button>
              ) : null
            })}
            <button
              onClick={() => onPage(page + 1)}
              disabled={page === pages}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
