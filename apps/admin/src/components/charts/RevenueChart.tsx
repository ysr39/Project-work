import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { RevenuePoint } from '@/types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">
        {format(parseISO(label), 'dd MMM yyyy')}
      </p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium">
            {p.dataKey === 'revenue' ? `₹${p.value.toLocaleString()}` : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="tripGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(parseISO(d), 'dd MMM')}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          yAxisId="revenue"
          orientation="left"
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          yAxisId="trips"
          orientation="right"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle" iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
        <Area
          yAxisId="revenue" type="monotone" dataKey="revenue"
          name="Revenue (₹)" stroke="#2563eb" strokeWidth={2}
          fill="url(#revGrad)"
        />
        <Area
          yAxisId="trips" type="monotone" dataKey="trips"
          name="Trips" stroke="#10b981" strokeWidth={2}
          fill="url(#tripGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
