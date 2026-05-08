import { useQuery } from '@tanstack/react-query'
import {
  Users, Car, MapPin, DollarSign,
  CheckCircle, Clock, AlertTriangle, Star,
} from 'lucide-react'
import { get } from '@/api/client'
import { EP } from '@/api/endpoints'
import { KpiData, RevenuePoint } from '@/types'
import { StatCard    } from '@/components/ui/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { TripDonut   } from '@/components/charts/TripDonut'

export function Dashboard() {
  const { data: kpi, isLoading: kpiLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  () => get<KpiData>(EP.dashboard),
    refetchInterval: 30_000,
  })

  const { data: revenue = [] } = useQuery({
    queryKey: ['revenue', 'week'],
    queryFn:  () => get<RevenuePoint[]>(`${EP.revenueReport}?period=week`),
  })

  const donutData = [
    { name: 'Completed',   value: 142 },
    { name: 'Cancelled',   value: 18  },
    { name: 'In Progress', value: kpi?.activeTrips ?? 0 },
    { name: 'Searching',   value: 7   },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={kpi?.totalUsers ?? 0}
          icon={<Users className="h-5 w-5 text-primary-600" />}
          iconBg="bg-primary-50"
          loading={kpiLoading}
          change={8.2}
        />
        <StatCard
          label="Active Drivers"
          value={kpi?.totalDrivers ?? 0}
          icon={<Car className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          loading={kpiLoading}
          change={3.1}
        />
        <StatCard
          label="Trips Today"
          value={kpi?.completedToday ?? 0}
          icon={<CheckCircle className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
          loading={kpiLoading}
        />
        <StatCard
          label="Revenue Today"
          value={kpi?.revenueToday ?? 0}
          icon={<DollarSign className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
          loading={kpiLoading}
          prefix="₹"
          change={12.5}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Trips"
          value={kpi?.activeTrips ?? 0}
          icon={<MapPin className="h-5 w-5 text-sky-600" />}
          iconBg="bg-sky-50"
          loading={kpiLoading}
        />
        <StatCard
          label="Pending Approvals"
          value={kpi?.pendingApprovals ?? 0}
          icon={<Clock className="h-5 w-5 text-orange-600" />}
          iconBg="bg-orange-50"
          loading={kpiLoading}
        />
        <StatCard
          label="Cancellation Rate"
          value={`${kpi?.cancellationRate?.toFixed(1) ?? 0}%`}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          loading={kpiLoading}
        />
        <StatCard
          label="Avg Rating"
          value={kpi?.avgRating?.toFixed(2) ?? '—'}
          icon={<Star className="h-5 w-5 text-yellow-500" />}
          iconBg="bg-yellow-50"
          loading={kpiLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue & Trips — Last 7 Days"
            subtitle="Daily revenue vs trip volume"
          />
          {revenue.length > 0 ? (
            <RevenueChart data={revenue} />
          ) : (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-slate-400">No revenue data yet</p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Trip Breakdown" subtitle="Status distribution" />
          <TripDonut data={donutData} />
        </Card>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'This Week',  value: kpi?.revenueThisWeek  },
          { label: 'This Month', value: kpi?.revenueThisMonth },
          { label: 'Avg per Trip', value: kpi?.completedToday && kpi?.revenueToday
              ? kpi.revenueToday / kpi.completedToday : 0 },
        ].map(({ label, value }) => (
          <Card key={label} className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-lg font-bold text-slate-800">
              ₹{(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}
