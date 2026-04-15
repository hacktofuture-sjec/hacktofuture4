'use client'

import { Incident } from '@/hooks/useMonitoring'
import { cn } from '@/lib/utils'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Zap, X } from 'lucide-react'
import { useState } from 'react'

interface AnomalyAlertProps {
  incident: Incident
  onRemediate: () => void
}

export default function AnomalyAlert({ incident, onRemediate }: AnomalyAlertProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20 border-red-500/30'
      case 'medium':
        return 'bg-yellow-500/20 border-yellow-500/30'
      case 'low':
        return 'bg-blue-500/20 border-blue-500/30'
      default:
        return 'border-white/10 bg-black/20'
    }
  }

  const getSeverityIcon = (severity: string) => {
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

  return (
    <InternalGlassPanel
      density="compact"
      className={cn('border', getSeverityColor(incident.severity))}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-2 rounded-lg flex-shrink-0 ${getSeverityColor(incident.severity)}`}>
            <AlertTriangle className={`h-5 w-5 ${getSeverityIcon(incident.severity)}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{incident.description}</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                incident.severity === 'high' ? 'bg-red-500/30 text-red-500' :
                incident.severity === 'medium' ? 'bg-yellow-500/30 text-yellow-500' :
                'bg-blue-500/30 text-blue-500'
              }`}>
                {incident.severity}
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-white/60 mb-2">{incident.remediationAction}</p>

            {incident.rootCause && (
              <p className="text-xs text-gray-600 dark:text-white/60">
                <span className="font-semibold">Root Cause:</span> {incident.rootCause}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={onRemediate}
            size="sm"
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Zap className="h-4 w-4" />
            Remediate
          </Button>

          <Button
            onClick={() => setDismissed(true)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </InternalGlassPanel>
  )
}
