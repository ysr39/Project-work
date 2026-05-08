import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, FileText } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

import { get, patch } from '@/api/client'
import { EP }         from '@/api/endpoints'
import { DriverProfile } from '@/types'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { Button }             from '@/components/ui/Button'
import { Modal }              from '@/components/ui/Modal'
import { Card, CardHeader }   from '@/components/ui/Card'
import { PageSpinner }        from '@/components/ui/Spinner'

export function Drivers() {
  const qc = useQueryClient()
  const [tab,     setTab]     = useState<'pending' | 'all'>('pending')
  const [detail,  setDetail]  = useState<DriverProfile | null>(null)
  const [confirm, setConfirm] = useState<{ driver: DriverProfile; action: 'approve' | 'reject' } | null>(null)

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['drivers', 'pending'],
    queryFn:  () => get<DriverProfile[]>(EP.pendingDrivers),
    enabled:  tab === 'pending',
  })

  const { data: allDrivers, isLoading: allLoading } = useQuery({
    queryKey: ['drivers', 'all'],
    queryFn:  () => get<{ users: DriverProfile[]; total: number }>('/users?role=DRIVER'),
    enabled:  tab === 'all',
  })

  const actionMutation = useMutation({
    mutationFn: ({ driver, action }: { driver: DriverProfile; action: 'approve' | 'reject' }) =>
      action === 'approve'
        ? patch(EP.approveDriver(driver.id))
        : patch(EP.rejectDriver(driver.id)),
    onSuccess: (_, { action }) => {
      toast.success(`Driver ${action}d`)
      qc.invalidateQueries({ queryKey: ['drivers'] })
      setConfirm(null)
      setDetail(null)
    },
  })

  const pendingColumns: Column<DriverProfile>[] = [
    {
      key: 'driver', header: 'Driver',
      render: (d) => (
        <div>
          <p className="font-medium text-slate-800">{d.user.fullName ?? '—'}</p>
          <p className="text-xs text-slate-400">{d.user.phone}</p>
        </div>
      ),
    },
    {
      key: 'vehicle', header: 'Vehicle',
      render: (d) => d.vehicle ? (
        <div>
          <p className="text-sm text-slate-700">{d.vehicle.make} {d.vehicle.model}</p>
          <p className="text-xs text-slate-400">{d.vehicle.plateNumber}</p>
        </div>
      ) : <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key: 'docs', header: 'Documents',
      render: (d) => {
        const approved = d.documents?.filter(doc => doc.status === 'APPROVED').length ?? 0
        const total    = d.documents?.length ?? 0
        return (
          <span className={clsx(
            'text-xs font-medium',
            approved === total && total > 0 ? 'text-emerald-600' : 'text-amber-600',
          )}>
            {approved}/{total} verified
          </span>
        )
      },
    },
    {
      key: 'license', header: 'License',
      render: (d) => <span className="text-sm font-mono text-slate-600">{d.licenseNumber}</span>,
    },
    {
      key: 'actions', header: 'Actions',
      render: (d) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />}
            onClick={() => setDetail(d)}>
            Review
          </Button>
          <Button size="sm" variant="primary" icon={<CheckCircle className="h-3.5 w-3.5" />}
            onClick={() => setConfirm({ driver: d, action: 'approve' })}>
            Approve
          </Button>
          <Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />}
            onClick={() => setConfirm({ driver: d, action: 'reject' })}>
            Reject
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {(['pending', 'all'] as const).map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t === 'pending'
              ? `Pending Approvals${pending.length ? ` (${pending.length})` : ''}`
              : 'All Drivers'}
          </button>
        ))}
      </div>

      {tab === 'pending' ? (
        <DataTable
          columns={pendingColumns}
          data={pending}
          loading={pendingLoading}
          rowKey={(d) => d.id}
          emptyText="No pending approvals 🎉"
        />
      ) : (
        <DataTable
          columns={[
            ...pendingColumns.slice(0, 3),
            {
              key: 'status', header: 'Status',
              render: (d) => statusBadge(d.approvalStatus),
            },
            {
              key: 'online', header: 'Online',
              render: (d) => (
                <span className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  d.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                )}>
                  <span className={clsx('h-1.5 w-1.5 rounded-full', d.isOnline ? 'bg-emerald-500' : 'bg-slate-400')} />
                  {d.isOnline ? 'Online' : 'Offline'}
                </span>
              ),
            },
            {
              key: 'rating', header: 'Rating',
              render: (d) => <span className="text-sm">{d.ratingAvg?.toFixed(1) ?? '—'} ⭐</span>,
            },
          ]}
          data={allDrivers?.users ?? []}
          loading={allLoading}
          rowKey={(d) => d.id}
          total={allDrivers?.total}
        />
      )}

      {/* Driver detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Driver Details" maxWidth="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Name"    value={detail.user.fullName ?? '—'} />
              <InfoRow label="Phone"   value={detail.user.phone}          />
              <InfoRow label="License" value={detail.licenseNumber}       />
              <InfoRow label="Status"  value={detail.approvalStatus}      />
              {detail.vehicle && <>
                <InfoRow label="Vehicle" value={`${detail.vehicle.make} ${detail.vehicle.model}`} />
                <InfoRow label="Plate"   value={detail.vehicle.plateNumber} />
                <InfoRow label="Type"    value={detail.vehicle.vehicleType} />
                <InfoRow label="Capacity" value={String(detail.vehicle.capacity)} />
              </>}
            </div>

            {detail.documents && detail.documents.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Documents</p>
                <div className="space-y-2">
                  {detail.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{doc.documentType.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(doc.status)}
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:underline">View</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.approvalStatus === 'PENDING' && (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="danger"  onClick={() => setConfirm({ driver: detail, action: 'reject' })}>
                  Reject
                </Button>
                <Button variant="primary" onClick={() => setConfirm({ driver: detail, action: 'approve' })}>
                  Approve Driver
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Confirm ${confirm?.action}`}>
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to{' '}
              <span className="font-semibold">{confirm.action}</span>{' '}
              <span className="font-semibold">{confirm.driver.user.fullName ?? confirm.driver.user.phone}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant={confirm.action === 'approve' ? 'primary' : 'danger'}
                loading={actionMutation.isPending}
                onClick={() => actionMutation.mutate(confirm)}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}
