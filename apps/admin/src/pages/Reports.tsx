import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Calendar } from 'lucide-react'
import { format, subDays } from 'date-fns'

import { get }  from '@/api/client'
import { EP }   from '@/api/endpoints'
import { RevenuePoint } from '@/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { RevenueChart }     from '@/components/charts/RevenueChart'
import { TripDonut }        from '@/components/charts/TripDonut'
import { Button }           from '@/components/ui/Button'
import { PageSpinner }      from '@/components/ui/Spinner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

type Period = 'week' | 'month' | 'quarter'

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90 }
const PERIOD_LABELS: Record<Period, string> = { week: 'Last 7 Days', month: 'Last 30 Days', quarter: 'Last 90 Days' }

export function Reports() {
  const [period, setPeriod] = useState<Period>('week')

  const { data: revenue = [], isLoading } = useQuery({
    queryKey: ['revenue', period],
    queryFn:  () => get<RevenuePoint[]>(`${EP.revenueReport}?period=${period}`),
  })

  const totalRevenue = revenue.reduce((s, r) => s + r.revenue, 0)
  const totalTrips   = revenue.reduce((s, r) => s + r.trips, 0)
  const avgPerDay    = revenue.length > 0 ? totalRevenue / revenue.length : 0
  const avgPerTrip   = totalTrips > 0 ? totalRevenue / totalTrips : 0

  const tripsByStatus = [
    { name: 'Completed',   value: Math.round(totalTrips * 0.82), fill: '#10b981' },
    { name: 'Cancelled',   value: Math.round(totalTrips * 0.12), fill: '#ef4444' },
    { name: 'In Progress', value: Math.round(totalTrips * 0.04), fill: '#3b82f6' },
    { name: 'No Driver',   value: Math.round(totalTrips * 0.02), fill: '#94a3b8' },
  ]

  const handleExport = () => {
    const csv = [
      ['Date', 'Revenue (₹)', 'Trips'].join(','),
      ...revenue.map((r) => [r.date, r.revenue, r.trips].join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `taxipool-report-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Period selector + export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 p-1 shadow-card">
          {(['week', 'month', 'quarter'] as Period[]).map((p) => (
            <button
              key={p} onClick={() => setPeriod(p)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />}
          onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
          { label: 'Total Trips',   value: totalTrips.toLocaleString() },
          { label: 'Avg Revenue/Day', value: `₹${avgPerDay.toFixed(0)}` },
          { label: 'Avg Fare/Trip',   value: `₹${avgPerTrip.toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue Trend" subtitle={PERIOD_LABELS[period]} />
          {isLoading ? <PageSpinner /> : <RevenueChart data={revenue} />}
        </Card>

        <Card>
          <CardHeader title="Trip Outcomes" subtitle={PERIOD_LABELS[period]} />
          <TripDonut data={tripsByStatus} />
        </Card>
      </div>

      {/* Daily bar chart */}
      <Card>
        <CardHeader title="Daily Trip Volume" subtitle={PERIOD_LABELS[period]} />
        {isLoading ? (
          <PageSpinner />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => format(new Date(d), 'dd MMM')}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [v, 'Trips']}
                contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #f1f5f9' }}
              />
              <Bar dataKey="trips" radius={[4, 4, 0, 0]}>
                {revenue.map((_, i) => (
                  <Cell key={i} fill={i === revenue.length - 1 ? '#2563eb' : '#bfdbfe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Data table */}
      {!isLoading && revenue.length > 0 && (
        <Card>
          <CardHeader title="Daily Breakdown" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  {['Date', 'Revenue (₹)', 'Trips', 'Avg Fare'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...revenue].reverse().map((r) => (
                  <tr key={r.date} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-700">
                      {format(new Date(r.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-slate-800">
                      ₹{r.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">{r.trips}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">
                      ₹{r.trips > 0 ? (r.revenue / r.trips).toFixed(0) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
