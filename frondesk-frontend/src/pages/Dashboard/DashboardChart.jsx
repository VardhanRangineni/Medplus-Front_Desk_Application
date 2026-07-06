import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function VisitorFlowChart({ points = [] }) {
  if (!points.length) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#ccc', fontSize: 13,
      }}>
        No visitor data yet today
      </div>
    );
  }

  const chartData = points.map((p) => ({ label: p.label, visitors: p.all }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -28 }}>
        <defs>
          <linearGradient id="visitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C2181D" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#C2181D" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: '#aaa' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 9, fill: '#ccc' }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          formatter={(v) => [v, 'Visitors']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
          itemStyle={{ color: '#C2181D' }}
        />
        <Area
          type="monotone"
          dataKey="visitors"
          stroke="#C2181D"
          strokeWidth={2}
          fill="url(#visitFill)"
          dot={{ r: 3.5, fill: '#C2181D', stroke: '#fff', strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
