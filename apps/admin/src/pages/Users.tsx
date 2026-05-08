import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Shield, ShieldOff, Ban } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

import { get, patch } from '@/api/client'
import { EP }         from '@/api/endpoints'
import { User }       from '@/types'
import { DataTable, Column }    from '@/components/ui/DataTable'
import { Badge, statusBadge }   from '@/components/ui/Badge'
import { Button }               from '@/components/ui/Button'
import { Modal }                from '@/components/ui/Modal'
import { SearchInput }          from '@/components/ui/SearchInput'
import { Card }                 from '@/components/ui/Card'

type Action = 'suspend' | 'ban' | 'reinstate'

export function Users() {
  const qc = useQueryClient()
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [roleFilter, setRole] = useState<string>('ALL')
  const [modal, setModal]     = useState<{ user: User; action: Action } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn:  () => get<{ users: User[]; total: number }>(EP.users, {
      page, limit: 20,
      ...(search  ? { search } : {}),
      ...(roleFilter !== 'ALL' ? { role: roleFilter } : {}),
    }),
  })

  const mutation = useMutation({
    mutationFn: ({ user, action }: { user: User; action: Action }) => {
      const url = action === 'suspend'  ? EP.suspendUser(user.id)
                : action === 'ban'      ? EP.banUser(user.id)
                :                        EP.reinstateUser(user.id)
      return patch(url)
    },
    onSuccess: (_, { action }) => {
      toast.success(`User ${action}d successfully`)
      qc.invalidateQueries({ queryKey: ['users'] })
      setModal(null)
    },
  })

  const columns: Column<User>[] = [
    {
      key: 'user', header: 'User',
      render: (u) => (
        <div>
          <p className="font-medium text-slate-800">{u.fullName ?? '—'}</p>
          <p className="text-xs text-slate-400">{u.phone}</p>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      render: (u) => (
        <Badge
          label={u.role}
          variant={u.role === 'DRIVER' ? 'info' : 'neutral'}
        />
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (u) => statusBadge(u.status),
    },
    {
      key: 'trips', header: 'Trips',
      render: (u) => (
        <span className="text-sm text-slate-600">
          {u.riderProfile?.totalTrips ?? 0}
        </span>
      ),
    },
    {
      key: 'rating', header: 'Rating',
      render: (u) => (
        <span className="text-sm text-slate-600">
          {u.riderProfile?.ratingAvg?.toFixed(1) ?? '—'}
        </span>
      ),
    },
    {
      key: 'joined', header: 'Joined',
      render: (u) => (
        <span className="text-xs text-slate-400">
          {format(new Date(u.createdAt), 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      key: 'actions', header: 'Actions',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          {u.status !== 'SUSPENDED' && u.status !== 'BANNED' && (
            <Button
              size="sm" variant="secondary"
              icon={<ShieldOff className="h-3.5 w-3.5" />}
              onClick={() => setModal({ user: u, action: 'suspend' })}
            >
              Suspend
            </Button>
          )}
          {u.status === 'ACTIVE' && (
            <Button
              size="sm" variant="danger"
              icon={<Ban className="h-3.5 w-3.5" />}
              onClick={() => setModal({ user: u, action: 'ban' })}
            >
              Ban
            </Button>
          )}
          {(u.status === 'SUSPENDED' || u.status === 'BANNED') && (
            <Button
              size="sm" variant="primary"
              icon={<Shield className="h-3.5 w-3.5" />}
              onClick={() => setModal({ user: u, action: 'reinstate' })}
            >
              Reinstate
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="sm:w-72"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <div className="flex items-center gap-2">
            {['ALL', 'RIDER', 'DRIVER'].map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setPage(1) }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  roleFilter === r
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.users ?? []}
        loading={isLoading}
        rowKey={(u) => u.id}
        total={data?.total ?? 0}
        page={page}
        limit={20}
        onPage={setPage}
        emptyText="No users found"
      />

      {/* Confirm modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`Confirm ${modal?.action}`}
      >
        {modal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to{' '}
              <span className="font-semibold text-slate-800">{modal.action}</span>{' '}
              <span className="font-semibold text-slate-800">{modal.user.fullName ?? modal.user.phone}</span>?
              {modal.action === 'ban' && (
                <span className="text-red-600"> This will permanently restrict their access.</span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                variant={modal.action === 'reinstate' ? 'primary' : 'danger'}
                loading={mutation.isPending}
                onClick={() => mutation.mutate(modal)}
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
