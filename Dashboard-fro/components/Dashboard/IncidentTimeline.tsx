'use client'

import { Incident } from '@/hooks/useMonitoring'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

interface IncidentTimelineProps {
  incidents: Incident[]
}

export default function IncidentTimeline({ incidents }: IncidentTimelineProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-500'
      case 'medium':
        return 'text-yellow-500'
      case 'low':
        return 'text-blue-500'
      default:
        return 'text-gray-700 dark:text-white/80'
    }
  }

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20'
      case 'medium':
        return 'bg-yellow-500/20'
      case 'low':
        return 'bg-blue-500/20'
      default:
        return 'bg-white/10'
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'resolved') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    } else if (status === 'in-progress') {
      return <Clock className="h-5 w-5 text-orange-500" />
    } else {
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    }
  }

  return (
    <InternalGlassPanel>
      <div className="space-y-4">
        {incidents.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-white/60 py-8">No incidents</p>
        ) : (
          incidents.map((incident, idx) => (
            <div key={incident.id} className={`pb-4 ${idx !== incidents.length - 1 ? 'border-b border-border/30' : ''}`}>
              <div className="flex gap-4">
                {/* Timeline indicator */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`p-2 rounded-full ${getSeverityBg(incident.severity)}`}>
                    {getStatusIcon(incident.status)}
                  </div>
                  {idx !== incidents.length - 1 && (
                    <div className="w-0.5 h-8 bg-border/30" />
                  )}
                </div>

                {/* Incident details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{incident.description}</h4>
                      <p className="text-xs text-gray-600 dark:text-white/60 mt-1">{incident.type}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                      incident.severity === 'high' ? 'bg-red-500/20 text-red-500' :
                      incident.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      {incident.severity}
                    </span>
                  </div>

                  {incident.rootCause && (
                    <p className="text-xs text-gray-600 dark:text-white/60 mb-2">
                      <span className="font-semibold">Root Cause:</span> {incident.rootCause}
                    </p>
                  )}

                  <p className="text-xs text-gray-600 dark:text-white/60 mb-2">
                    <span className="font-semibold">Action:</span> {incident.remediationAction}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-white/60">
                    <span>{incident.createdAt.toLocaleString()}</span>
                    <span className={`font-semibold capitalize ${
                      incident.status === 'resolved' ? 'text-green-500' :
                      incident.status === 'in-progress' ? 'text-orange-500' :
                      'text-red-500'
                    }`}>
                      {incident.status}
                    </span>
                  </div>

                  {incident.resolvedAt && (
                    <p className="text-xs text-green-500 mt-1">
                      Resolved at {incident.resolvedAt.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </InternalGlassPanel>
  )
}
