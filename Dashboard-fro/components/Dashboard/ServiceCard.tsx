'use client'

import { Service } from '@/hooks/useMonitoring'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Activity, MoreVertical } from 'lucide-react'
import { useState } from 'react'

interface ServiceCardProps {
  service: Service
  onInjectChaos: (type: 'cpu-spike' | 'memory-leak' | 'crash') => void
}

export default function ServiceCard({ service, onInjectChaos }: ServiceCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'degraded':
        return 'text-yellow-500'
      case 'down':
        return 'text-red-500'
      default:
        return 'text-gray-700 dark:text-white/80'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20'
      case 'degraded':
        return 'bg-yellow-500/20'
      case 'down':
        return 'bg-red-500/20'
      default:
        return 'bg-white/10'
    }
  }

  return (
    <InternalGlassPanel>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{service.name}</h3>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${getStatusBg(service.status)}`}>
                {service.status === 'healthy' ? (
                  <CheckCircle2 className={`h-4 w-4 ${getStatusColor(service.status)}`} />
                ) : (
                  <AlertTriangle className={`h-4 w-4 ${getStatusColor(service.status)}`} />
                )}
              </div>
              <span className={`text-sm font-medium capitalize ${getStatusColor(service.status)}`}>
                {service.status}
              </span>
            </div>
          </div>

          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <InternalGlassPanel
                density="none"
                className="absolute right-0 top-full z-20 mt-1 min-w-max rounded-xl p-1 shadow-[0_8px_32px_rgba(0,0,0,0.65)]"
              >
                <p className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-white/60">Inject Chaos:</p>
                <button
                  type="button"
                  onClick={() => {
                    onInjectChaos('cpu-spike')
                    setShowMenu(false)
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-orange-500 hover:bg-white/10"
                >
                  CPU Spike
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInjectChaos('memory-leak')
                    setShowMenu(false)
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-yellow-500 hover:bg-white/10"
                >
                  Memory Leak
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInjectChaos('crash')
                    setShowMenu(false)
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-red-500 hover:bg-white/10"
                >
                  Service Crash
                </button>
              </InternalGlassPanel>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-white/60">Uptime</span>
            <span className="font-semibold text-gray-900 dark:text-white">{service.uptime.toFixed(2)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
              style={{ width: `${service.uptime}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-white/60">Error Rate</span>
            <span className={service.errorRate > 0.1 ? 'text-orange-500' : 'text-green-500'}>
              {service.errorRate.toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-white/60">Latency</span>
            <span className="text-gray-900 dark:text-white">{service.latency}ms</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-white/60">RPS</span>
            <span className="text-gray-900 dark:text-white">{service.metrics.requestsPerSecond}</span>
          </div>
        </div>

        {/* Resource Usage */}
        <div className="space-y-2 text-xs border-t border-border/30 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-white/80">CPU: {service.metrics.cpuUsage}%</span>
            <div className="h-1.5 w-16 rounded-full bg-white/10">
              <div
                className="bg-orange-500 h-1.5 rounded-full"
                style={{ width: `${service.metrics.cpuUsage}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-white/80">Memory: {service.metrics.memoryUsage}%</span>
            <div className="h-1.5 w-16 rounded-full bg-white/10">
              <div
                className="bg-blue-500 h-1.5 rounded-full"
                style={{ width: `${service.metrics.memoryUsage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Dependencies */}
        <div className="text-xs border-t border-border/30 pt-3">
          <p className="text-gray-600 dark:text-white/60 mb-2">Dependencies</p>
          <div className="flex flex-wrap gap-1">
            {service.dependencies.map((dep) => (
              <span key={dep} className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs">
                {dep}
              </span>
            ))}
          </div>
        </div>
      </div>
    </InternalGlassPanel>
  )
}
