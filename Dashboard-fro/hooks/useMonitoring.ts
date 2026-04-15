import { useState, useCallback, useEffect } from 'react'

export interface Service {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  errorRate: number
  latency: number
  lastHealthCheck: Date
  dependencies: string[]
  metrics: {
    requestsPerSecond: number
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
  }
}

export interface Incident {
  id: string
  serviceId: string
  type: 'anomaly' | 'failure'
  severity: 'low' | 'medium' | 'high'
  description: string
  rootCause?: string
  remediationAction: string
  status: 'detected' | 'in-progress' | 'resolved'
  createdAt: Date
  resolvedAt?: Date
}

export interface SystemHealth {
  overallHealth: 'healthy' | 'degraded' | 'critical'
  uptime: number
  services: Service[]
  activeIncidents: number
  resolvedIncidents: number
}

const services = new Map<string, Service>()
const incidents = new Map<string, Incident[]>()

function initializeServices() {
  if (services.size === 0) {
    const servicesList: Service[] = [
      {
        id: 'svc-auth',
        name: 'Authentication Service',
        status: 'healthy',
        uptime: 99.98,
        errorRate: 0.02,
        latency: 45,
        lastHealthCheck: new Date(),
        dependencies: ['database'],
        metrics: {
          requestsPerSecond: 1200,
          cpuUsage: 32,
          memoryUsage: 48,
          diskUsage: 25,
        }
      },
      {
        id: 'svc-messaging',
        name: 'Messaging Service',
        status: 'healthy',
        uptime: 99.95,
        errorRate: 0.05,
        latency: 52,
        lastHealthCheck: new Date(),
        dependencies: ['database', 'cache'],
        metrics: {
          requestsPerSecond: 2500,
          cpuUsage: 48,
          memoryUsage: 62,
          diskUsage: 35,
        }
      },
      {
        id: 'svc-presence',
        name: 'Presence Service',
        status: 'healthy',
        uptime: 99.99,
        errorRate: 0.01,
        latency: 28,
        lastHealthCheck: new Date(),
        dependencies: ['cache', 'websocket'],
        metrics: {
          requestsPerSecond: 3200,
          cpuUsage: 55,
          memoryUsage: 70,
          diskUsage: 20,
        }
      },
      {
        id: 'svc-conversation',
        name: 'Conversation Service',
        status: 'degraded',
        uptime: 99.85,
        errorRate: 0.15,
        latency: 120,
        lastHealthCheck: new Date(),
        dependencies: ['database'],
        metrics: {
          requestsPerSecond: 800,
          cpuUsage: 72,
          memoryUsage: 81,
          diskUsage: 55,
        }
      },
      {
        id: 'svc-monitoring',
        name: 'Monitoring Service',
        status: 'healthy',
        uptime: 99.99,
        errorRate: 0,
        latency: 15,
        lastHealthCheck: new Date(),
        dependencies: ['metrics-db', 'logs-db'],
        metrics: {
          requestsPerSecond: 5000,
          cpuUsage: 42,
          memoryUsage: 55,
          diskUsage: 40,
        }
      },
    ]

    servicesList.forEach(svc => services.set(svc.id, svc))

    // Initialize incidents
    const incidentsList: Incident[] = [
      {
        id: 'inc-1',
        serviceId: 'svc-conversation',
        type: 'anomaly',
        severity: 'high',
        description: 'Elevated error rate detected in Conversation Service',
        rootCause: 'Database connection pool exhaustion',
        remediationAction: 'Restarted database connection pool',
        status: 'resolved',
        createdAt: new Date(Date.now() - 3600000),
        resolvedAt: new Date(Date.now() - 1800000),
      },
      {
        id: 'inc-2',
        serviceId: 'svc-messaging',
        type: 'anomaly',
        severity: 'medium',
        description: 'Increased memory usage detected',
        remediationAction: 'Triggered garbage collection',
        status: 'resolved',
        createdAt: new Date(Date.now() - 7200000),
        resolvedAt: new Date(Date.now() - 3600000),
      },
      {
        id: 'inc-3',
        serviceId: 'svc-conversation',
        type: 'anomaly',
        severity: 'high',
        description: 'CPU spike detected - monitoring for resolution',
        rootCause: 'Pending analysis',
        remediationAction: 'Auto-scaling triggered',
        status: 'in-progress',
        createdAt: new Date(Date.now() - 600000),
      },
    ]

    incidentsList.forEach(inc => {
      const existing = incidents.get(inc.serviceId) || []
      existing.push(inc)
      incidents.set(inc.serviceId, existing)
    })
  }
}

export function useMonitoring() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overallHealth: 'healthy',
    uptime: 99.97,
    services: [],
    activeIncidents: 0,
    resolvedIncidents: 0,
  })
  const [allIncidents, setAllIncidents] = useState<Incident[]>([])

  useEffect(() => {
    initializeServices()
    updateHealth()
  }, [])

  const updateHealth = useCallback(() => {
    const servicesList = Array.from(services.values())
    const incidentsList = Array.from(incidents.values()).flat()
    const activeIncs = incidentsList.filter(i => i.status !== 'resolved').length
    const resolvedIncs = incidentsList.filter(i => i.status === 'resolved').length

    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (servicesList.some(s => s.status === 'down')) {
      overallHealth = 'critical'
    } else if (servicesList.some(s => s.status === 'degraded')) {
      overallHealth = 'degraded'
    }

    const avgUptime = servicesList.length > 0
      ? servicesList.reduce((sum, s) => sum + s.uptime, 0) / servicesList.length
      : 99.97

    setSystemHealth({
      overallHealth,
      uptime: avgUptime,
      services: servicesList,
      activeIncidents: activeIncs,
      resolvedIncidents: resolvedIncs,
    })

    setAllIncidents(incidentsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
  }, [])

  const injectChaos = useCallback((serviceId: string, type: 'cpu-spike' | 'memory-leak' | 'crash') => {
    const service = services.get(serviceId)
    if (!service) return

    // Simulate chaos
    const newIncident: Incident = {
      id: `inc-${Date.now()}`,
      serviceId,
      type: 'failure',
      severity: type === 'crash' ? 'high' : 'medium',
      description: `${type} injected into ${service.name}`,
      remediationAction: 'System monitoring and auto-recovery activated',
      status: 'detected',
      createdAt: new Date(),
    }

    const existing = incidents.get(serviceId) || []
    existing.push(newIncident)
    incidents.set(serviceId, existing)

    // Update service status temporarily
    service.status = 'degraded'
    service.errorRate += 5
    service.latency += 50

    // Simulate recovery after 5 seconds
    setTimeout(() => {
      service.status = 'healthy'
      service.errorRate = Math.max(0, service.errorRate - 5)
      service.latency = Math.max(10, service.latency - 50)

      // Mark incident as resolved
      const incsForService = incidents.get(serviceId) || []
      const incident = incsForService.find(i => i.id === newIncident.id)
      if (incident) {
        incident.status = 'resolved'
        incident.resolvedAt = new Date()
      }

      updateHealth()
    }, 5000)

    updateHealth()
  }, [updateHealth])

  const remediateFailed = useCallback((incidentId: string) => {
    // Find and resolve incident
    for (const [serviceId, incs] of incidents.entries()) {
      const incident = incs.find(i => i.id === incidentId)
      if (incident) {
        incident.status = 'resolved'
        incident.resolvedAt = new Date()
        break
      }
    }
    updateHealth()
  }, [updateHealth])

  return {
    systemHealth,
    allIncidents,
    injectChaos,
    remediateFailed,
    updateHealth,
  }
}
