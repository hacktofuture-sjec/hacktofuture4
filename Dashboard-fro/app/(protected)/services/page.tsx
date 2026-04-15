'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { fetchAgentAnalyze, type AgentAnalyzeResponse } from '@/lib/agent-analyze'
import ServiceCard from '@/components/Dashboard/ServiceCard'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import type { Service } from '@/hooks/useMonitoring'

const normalizeServiceId = (value?: string | null) => (value || '').trim().toLowerCase()

const toServiceStatus = (backendHealth?: string, mode?: string, reachable?: boolean): 'healthy' | 'degraded' | 'down' => {
  const normalizedHealth = normalizeServiceId(backendHealth)
  const normalizedMode = normalizeServiceId(mode)

  if (reachable === false) return 'down'
  if (normalizedHealth.includes('critical') || normalizedHealth.includes('down') || normalizedHealth.includes('error') || normalizedHealth.includes('crash')) {
    return 'down'
  }
  if (normalizedHealth.includes('degraded') || normalizedHealth.includes('warning') || normalizedMode.includes('latency')) {
    return 'degraded'
  }

  return 'healthy'
}

function transformBackendToServices(data: AgentAnalyzeResponse): Service[] {
  const monitorServices = data.monitoring?.services ?? []

  return monitorServices.map((service, index) => {
    const status = toServiceStatus(service.health, service.mode, service.reachable)
    const restartCount = data.kubernetesSignals?.restartCount ?? 0

    return {
      id: normalizeServiceId(service.service),
      name: service.service,
      status,
      uptime: status === 'healthy' ? 99.9 : status === 'degraded' ? 95.5 : 80.0,
      errorRate: status === 'healthy' ? 0.05 : status === 'degraded' ? 0.25 : 2.0,
      latency: status === 'healthy' ? 45 : status === 'degraded' ? 120 : 500,
      lastHealthCheck: new Date(),
      dependencies: [],
      metrics: {
        requestsPerSecond: 1000 + index * 200,
        cpuUsage: status === 'healthy' ? 35 : status === 'degraded' ? 65 : 95,
        memoryUsage: status === 'healthy' ? 50 : status === 'degraded' ? 75 : 92,
        diskUsage: 25 + index * 5,
      },
    }
  })
}

export default function ServicesPage() {
  const [analyze, setAnalyze] = useState<AgentAnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const next = await fetchAgentAnalyze()
        if (!isMounted) return
        setAnalyze(next)
        setError(null)
      } catch (err) {
        if (!isMounted) return
        const message = err instanceof Error ? err.message : 'Failed to fetch services'
        setError(message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    const interval = window.setInterval(load, 4000)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [])

  const services = useMemo(() => transformBackendToServices(analyze ?? { success: false }), [analyze])

  const healthyServices = services.filter(s => s.status === 'healthy').length
  const degradedServices = services.filter(s => s.status === 'degraded').length
  const downServices = services.filter(s => s.status === 'down').length

  return (
    <div className="space-y-6 p-6 text-gray-900 dark:text-white">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Services</h1>
        <p className="text-gray-600 dark:text-white/60">Live health, dependencies, and chaos testing for each workload.</p>
      </div>
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <InternalGlassPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-sm text-gray-600 dark:text-white/60">Healthy</p>
              <p className="text-2xl font-bold text-green-500">
                {healthyServices}/{services.length}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </InternalGlassPanel>

        <InternalGlassPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-sm text-gray-600 dark:text-white/60">Degraded</p>
              <p className="text-2xl font-bold text-yellow-500">{degradedServices}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </InternalGlassPanel>

        <InternalGlassPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-2 text-sm text-gray-600 dark:text-white/60">Down</p>
              <p className="text-2xl font-bold text-red-500">{downServices}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </InternalGlassPanel>
      </div>

      {/* Services Grid */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">All Services</h2>
        {loading && <p className="text-gray-600 dark:text-white/60">Loading services...</p>}
        {error && <p className="text-red-500">Failed to load services: {error}</p>}
        {!loading && !error && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onInjectChaos={(type) => {
                  // Chaos injection would be implemented separately
                  console.log(`Injecting ${type} for ${service.id}`)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Service Dependencies */}
      <InternalGlassPanel>
        <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Service Dependencies</h2>
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.id} className="border-b border-border/30 pb-4 last:border-0">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{service.name}</h3>
              <div className="flex flex-wrap gap-2">
                {service.dependencies.length > 0 ? (
                  service.dependencies.map((dep) => (
                    <div key={dep} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm text-gray-600 dark:text-white/60">{dep}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-gray-600 dark:text-white/60">No explicit dependencies configured</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </InternalGlassPanel>
    </div>
  )
}
