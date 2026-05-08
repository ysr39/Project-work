import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']

interface Slice { name: string; value: number }

export function TripDonut({ data }: { data: Slice[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data} cx="50%" cy="45%"
          innerRadius={60} outerRadius={88}
          paddingAngle={3} dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [v.toLocaleString(), 'Trips']}
          contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
