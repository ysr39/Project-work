import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { format }    from 'date-fns'
import toast         from 'react-hot-toast'

import { get, post } from '@/api/client'
import { EP }        from '@/api/endpoints'
import { Payment }   from '@/types'
import { DataTable, Column } from '@/components/ui/DataTable'
import { statusBadge }       from '@/components/ui/Badge'
import { Button }            from '@/components/ui/Button'
import { Modal }             from '@/components/ui/Modal'
import { SearchInput }       from '@/components/ui/SearchInput'
import { Card }              from '@/components/ui/Card'
import { StatCard }          from '@/components/ui/StatCard'

export function Payments() {
  const qc = useQueryClient()
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState('ALL')
  const [refund,  setRefund]  = useState<Payment | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, search, status],
    queryFn:  () => get<{ payments: Payment[]; total: number; summary: { totalRevenue: number; totalRefunded: number; pendingCount: number } }>(
      EP.payments, {
        page, limit: 20,
        ...(search ? { search } : {}),
        ...(status !== 'ALL' ? { status } : {}),
      },
    ),
  })

  const refundMutation = useMutation({
    mutationFn: (payment: Payment) => post(EP.refund(payment.id)),
    onSuccess: () => {
      toast.success('Refund initiated')
      qc.invalidateQueries({ queryKey: ['payments'] })
      setRefund(null)
    },
  })

  const columns: Column<Payment>[] = [
    {
      key: 'id', header: 'Payment ID',
      render: (p) => (
        <span className="font-mono text-xs text-slate-500">{p.id.slice(0, 8)}…</span>
      ),
    },
    {
      key: 'rider', header: 'Rider',
      render: (p) => (
        <div>
          <p className="text-sm text-slate-800">{p.rider?.fullName ?? '—'}</p>
          <p className="text-xs text-slate-400">{p.rider?.phone}</p>
        </div>
      ),
    },
    {
      key: 'trip', header: 'Trip',
      render: (p) => (
        <span className="font-mono text-xs text-slate-500">{p.tripId.slice(0, 8)}…</span>
      ),
    },
    {
      key: 'amount', header: 'Amount',
      render: (p) => (
        <span className="text-sm font-semibold text-slate-800">₹{(p.amount / 100).toFixed(0)}</span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (p) => statusBadge(p.status),
    },
    {
      key: 'refund', header: 'Refund',
      render: (p) => p.refundAmount
        ? <span className="text-xs text-emerald-600 font-medium">₹{(p.refundAmount / 100).toFixed(0)}</span>
        : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'stripe', header: 'Stripe PI',
      render: (p) => (
        <span className="font-mono text-xs text-slate-400">{p.stripePaymentIntentId.slice(0, 12)}…</span>
      ),
    },
    {
      key: 'date', header: 'Date',
      render: (p) => (
        <span className="text-xs text-slate-400">{format(new Date(p.createdAt), 'dd MMM, HH:mm')}</span>
      ),
    },
    {
      key: 'actions', header: 'Actions',
      render: (p) => p.status === 'CAPTURED' ? (
        <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => setRefund(p)}>
          Refund
        </Button>
      ) : null,
    },
  ]

  const summary = data?.summary
  const totalRevenue   = (summary?.totalRevenue   ?? 0) / 100
  const totalRefunded  = (summary?.totalRefunded  ?? 0) / 100

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-card">
          <p className="text-xs text-slate-500">Total Revenue</p>
          <p className="mt-1 text-xl font-bold text-slate-800">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-card">
          <p className="text-xs text-slate-500">Total Refunded</p>
          <p className="mt-1 text-xl font-bold text-red-600">₹{totalRefunded.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-card">
          <p className="text-xs text-slate-500">Pending Payments</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{summary?.pendingCount ?? 0}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="sm:w-72" placeholder="Search by rider or Stripe PI…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <div className="flex items-center gap-2">
            {['ALL', 'PENDING', 'CAPTURED', 'REFUNDED', 'FAILED'].map((s) => (
              <button
                key={s} onClick={() => { setStatus(s); setPage(1) }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === s
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={data?.payments ?? []}
        loading={isLoading}
        rowKey={(p) => p.id}
        total={data?.total ?? 0}
        page={page}
        limit={20}
        onPage={setPage}
      />

      {/* Refund confirm */}
      <Modal open={!!refund} onClose={() => setRefund(null)} title="Confirm Refund">
        {refund && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              This will initiate a full refund of{' '}
              <span className="font-bold">₹{(refund.amount / 100).toFixed(0)}</span>{' '}
              via Stripe. This action cannot be undone.
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-400">Rider:</span> {refund.rider?.fullName ?? '—'}</p>
              <p><span className="text-slate-400">Stripe PI:</span> <span className="font-mono text-xs">{refund.stripePaymentIntentId}</span></p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRefund(null)}>Cancel</Button>
              <Button
                variant="danger"
                loading={refundMutation.isPending}
                onClick={() => refundMutation.mutate(refund)}
              >
                Issue Refund
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
