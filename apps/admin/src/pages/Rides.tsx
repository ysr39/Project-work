import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { clsx } from 'clsx'

import { get }   from '@/api/client'
import { EP }    from '@/api/endpoints'
import { Trip, TripStatus } from '@/types'
import { DataTable, Column } from '@/components/ui/DataTable'
import { statusBadge }       from '@/components/ui/Badge'
import { Button }            from '@/components/ui/Button'
import { Modal }             from '@/components/ui/Modal'
import { SearchInput }       from '@/components/ui/SearchInput'
import { Card }              from '@/components/ui/Card'

const STATUSES: TripStatus[] = [
  'SEARCHING', 'MATCHED', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
]

export function Rides() {
  const [page,   setPage]   = useState(1)
  const [status, setStatus] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Trip | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['trips', page, status, search],
    queryFn:  () => get<{ trips: Trip[]; total: number }>(EP.adminTrips, {
      page, limit: 20,
      ...(status !== 'ALL' ? { status } : {}),
      ...(search ? { search } : {}),
    }),
  })

  const columns: Column<Trip>[] = [
    {
      key: 'id', header: 'Trip ID',
      render: (t) => (
        <span className="font-mono text-xs text-slate-500">{t.id.slice(0, 8)}…</span>
      ),
    },
    {
      key: 'route', header: 'Route',
      render: (t) => (
        <div>
          <p className="text-sm font-medium text-slate-800 truncate max-w-[160px]">{t.pickupAddress}</p>
          <p className="text-xs text-slate-400 truncate max-w-[160px]">→ {t.dropoffAddress}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (t) => statusBadge(t.status),
    },
    {
      key: 'driver', header: 'Driver',
      render: (t) => t.driver ? (
        <div>
          <p className="text-sm text-slate-700">{t.driver.user.fullName ?? '—'}</p>
          <p className="text-xs text-slate-400">{t.driver.vehicle.plateNumber}</p>
        </div>
      ) : <span className="text-xs text-slate-400">Unassigned</span>,
    },
    {
      key: 'seats', header: 'Seats',
      render: (t) => (
        <span className="text-sm text-slate-600">{t.seatsFilled}/{t.totalSeats}</span>
      ),
    },
    {
      key: 'fare', header: 'Fare',
      render: (t) => (
        <span className="text-sm font-semibold text-slate-800">
          {t.totalFare ? `₹${Number(t.totalFare).toFixed(0)}` : '—'}
        </span>
      ),
    },
    {
      key: 'created', header: 'Created',
      render: (t) => (
        <span className="text-xs text-slate-400">
          {format(new Date(t.createdAt), 'dd MMM, HH:mm')}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      render: (t) => (
        <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />}
          onClick={() => setDetail(t)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="sm:w-72" placeholder="Search by ID or address…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => { setStatus('ALL'); setPage(1) }}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                status === 'ALL' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              ALL
            </button>
            {STATUSES.map((s) => (
              <button
                key={s} onClick={() => { setStatus(s); setPage(1) }}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  status === s ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={data?.trips ?? []}
        loading={isLoading}
        rowKey={(t) => t.id}
        total={data?.total ?? 0}
        page={page}
        limit={20}
        onPage={setPage}
      />

      {/* Trip detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Trip Details" maxWidth="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs text-slate-400">{detail.id}</p>
                <div className="mt-1 flex items-center gap-2">
                  {statusBadge(detail.status)}
                  <span className="text-xs text-slate-400">{detail.tripType}</span>
                </div>
              </div>
              <p className="text-lg font-bold text-slate-800">
                {detail.totalFare ? `₹${Number(detail.totalFare).toFixed(0)}` : '—'}
              </p>
            </div>

            {/* Route */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Pickup</p>
                  <p className="text-sm font-medium text-slate-800">{detail.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Drop-off</p>
                  <p className="text-sm font-medium text-slate-800">{detail.dropoffAddress}</p>
                </div>
              </div>
            </div>

            {/* Driver */}
            {detail.driver && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Driver</p>
                <p className="text-sm font-medium text-slate-800">{detail.driver.user.fullName}</p>
                <p className="text-xs text-slate-400">{detail.driver.user.phone}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {detail.driver.vehicle.make} {detail.driver.vehicle.model} · {detail.driver.vehicle.plateNumber}
                </p>
              </div>
            )}

            {/* Passengers */}
            {detail.passengers.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Passengers ({detail.passengers.length})
                </p>
                <div className="space-y-2">
                  {detail.passengers.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <div>
                        <p className="text-sm text-slate-700">{p.rider.fullName ?? '—'}</p>
                        <p className="text-xs text-slate-400">{p.rider.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(p.status)}
                        <span className="text-sm font-medium text-slate-700">₹{Number(p.finalFare).toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <p>Created: {format(new Date(detail.createdAt), 'dd MMM yyyy, HH:mm')}</p>
              {detail.completedAt && (
                <p>Completed: {format(new Date(detail.completedAt), 'dd MMM yyyy, HH:mm')}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
