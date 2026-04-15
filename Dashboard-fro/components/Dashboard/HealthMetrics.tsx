'use client'

import { Service } from '@/hooks/useMonitoring'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'

interface HealthMetricsProps {
  services: Service[]
}

export default function HealthMetrics({ services }: HealthMetricsProps) {
  // Prepare data for performance chart
  const performanceData = services.map((s) => ({
    name: s.name.split(' ')[0],
    latency: s.latency,
    errorRate: s.errorRate * 100,
    uptime: s.uptime,
  }))

  // Prepare data for resource usage chart
  const resourceData = services.map((s) => ({
    name: s.name.split(' ')[0],
    cpu: s.metrics.cpuUsage,
    memory: s.metrics.memoryUsage,
    disk: s.metrics.diskUsage,
  }))

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Performance Metrics */}
      <InternalGlassPanel>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Service Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.45)" />
            <YAxis stroke="rgba(255,255,255,0.45)" />
            <Tooltip
              contentStyle={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
              }}
              cursor={{ fill: 'rgba(100, 100, 200, 0.1)' }}
            />
            <Legend />
            <Bar dataKey="latency" fill="var(--chart-1)" name="Latency (ms)" radius={[8, 8, 0, 0]} />
            <Bar dataKey="errorRate" fill="var(--chart-2)" name="Error Rate %" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </InternalGlassPanel>

      {/* Resource Usage */}
      <InternalGlassPanel>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Resource Usage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={resourceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.45)" />
            <YAxis stroke="rgba(255,255,255,0.45)" />
            <Tooltip
              contentStyle={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
              }}
              cursor={{ fill: 'rgba(100, 100, 200, 0.1)' }}
            />
            <Legend />
            <Bar dataKey="cpu" fill="var(--chart-3)" name="CPU %" radius={[8, 8, 0, 0]} />
            <Bar dataKey="memory" fill="var(--chart-4)" name="Memory %" radius={[8, 8, 0, 0]} />
            <Bar dataKey="disk" fill="var(--chart-5)" name="Disk %" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </InternalGlassPanel>
    </div>
  )
}
