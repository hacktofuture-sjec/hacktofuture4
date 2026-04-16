'use client';
import { useEffect, useState } from 'react';
import MapPanel from '../components/MapPanel';
import AlertFeed from '../components/AlertFeed';
import SitrepPanel from '../components/SitrepPanel';
import SystemHealth from '../components/SystemHealth';

type ThreatLevel = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';

interface LiveAlert {
  id: string;
  threatLevel: ThreatLevel;
  elapsed: string;
  headline: string;
  sitrep: string;
  gasPpm: number;
  survivability: number;
  gasThreatLabel: string;
  equipmentChecklist: string[];
}

interface TelemetrySnapshot {
  alerts: LiveAlert[];
  activeNodes: number;
  ingestStatus: 'LIVE' | 'STALE';
  lastIngestAt: number | null;
}

export default function Dashboard() {
  const [activeAlert, setActiveAlert] = useState<LiveAlert | null>(null);
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>({
    alerts: [],
    activeNodes: 0,
    ingestStatus: 'STALE',
    lastIngestAt: null,
  });

  useEffect(() => {
    let cancelled = false;

    const pullTelemetry = async () => {
      try {
        const response = await fetch('/api/telemetry', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as TelemetrySnapshot;
        if (cancelled) {
          return;
        }

        setSnapshot(data);

        setActiveAlert((current) => {
          if (!data.alerts.length) {
            return null;
          }

          if (!current) {
            return data.alerts[0];
          }

          const refreshed = data.alerts.find((entry) => entry.id === current.id);
          return refreshed ?? data.alerts[0];
        });
      } catch {
        // Keep previous snapshot if network blips occur.
      }
    };

    pullTelemetry();
    const intervalId = window.setInterval(pullTelemetry, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const alerts = snapshot.alerts;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white overflow-hidden">
      {/* Top Bar: System Health (10% height) */}
      <div className="h-[10%] w-full bg-neutral-950 border-b border-neutral-800 z-10 flex">
        <SystemHealth
          activeNodes={snapshot.activeNodes}
          alertCount={alerts.length}
          pipelineStatus={snapshot.ingestStatus}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 relative">
        {/* Map Panel */}
        <div className="flex-1 relative">
          <MapPanel activeAlert={activeAlert} />
        </div>

        {/* Right Panel: Alert Feed (20% width) */}
        <div className="w-[350px] bg-neutral-900 border-l border-neutral-800 flex flex-col z-10 overflow-y-auto">
          <AlertFeed 
            alerts={alerts}
            onSelectAlert={setActiveAlert} 
            activeAlertId={activeAlert?.id} 
          />
        </div>

        {/* Bottom SITREP Panel (Slides up when an alert is active) */}
        {activeAlert && (
          <div className="absolute bottom-0 left-0 right-[350px] h-[35%] bg-neutral-950 border-t border-neutral-800 z-20 transition-all duration-300 shadow-2xl">
            <SitrepPanel alert={activeAlert} onClose={() => setActiveAlert(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
