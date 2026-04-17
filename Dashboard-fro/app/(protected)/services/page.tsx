'use client'

import { useMonitoring } from '@/hooks/useMonitoring'
import ServiceCard from '@/components/Dashboard/ServiceCard'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

export default function ServicesPage() {
  const { systemHealth, injectChaos } = useMonitoring()

  const healthyServices = systemHealth.services.filter(s => s.status === 'healthy').length
  const degradedServices = systemHealth.services.filter(s => s.status === 'degraded').length
  const downServices = systemHealth.services.filter(s => s.status === 'down').length

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
                {healthyServices}/{systemHealth.services.length}
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {systemHealth.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onInjectChaos={(type) => injectChaos(service.id, type)}
            />
          ))}
        </div>
      </div>

      {/* Service Dependencies */}
      <InternalGlassPanel>
        <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Service Dependencies</h2>
        <div className="space-y-4">
          {systemHealth.services.map((service) => (
            <div key={service.id} className="border-b border-border/30 pb-4 last:border-0">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{service.name}</h3>
              <div className="flex flex-wrap gap-2">
                {service.dependencies.map((dep) => (
                  <div key={dep} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm text-gray-600 dark:text-white/60">{dep}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </InternalGlassPanel>
    </div>
  )
}