interface AlertItem {
  id: string;
  threatLevel: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  elapsed: string;
  headline: string;
}

interface AlertFeedProps {
  alerts: AlertItem[];
  onSelectAlert: (alert: AlertItem) => void;
  activeAlertId?: string;
}

export default function AlertFeed({ alerts, onSelectAlert, activeAlertId }: AlertFeedProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-neutral-800 bg-neutral-950 uppercase tracking-widest text-xs font-bold text-neutral-400">
        Live Alert Feed
      </div>
      <div className="flex flex-col gap-2 p-2">
        {alerts.length === 0 && (
          <div className="p-4 text-xs text-neutral-500 border border-dashed border-neutral-800 rounded bg-neutral-950/50">
            Waiting for live telemetry from field nodes...
          </div>
        )}
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            onClick={() => onSelectAlert(alert)}
            className={`p-3 rounded cursor-pointer border transition-all ${
              activeAlertId === alert.id 
                ? 'bg-neutral-800 border-neutral-600' 
                : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
            } ${alert.threatLevel === 'RED' ? 'animate-[pulse_2s_ease-in-out_infinite] border-red-900/50' : ''}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-xs text-neutral-400">{alert.id}</span>
              <span className="text-xs text-neutral-500 font-mono">{alert.elapsed} ago</span>
            </div>
            <div className="flex items-start gap-2">
              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                alert.threatLevel === 'RED'
                  ? 'bg-red-500'
                  : alert.threatLevel === 'ORANGE'
                  ? 'bg-orange-500'
                  : 'bg-yellow-500'
              }`} />
              <p className="text-sm font-medium text-neutral-200">{alert.headline}</p>
            </div>
            <div className="mt-4 flex justify-end">
              <button 
                className="text-[10px] uppercase font-bold tracking-wide text-neutral-400 hover:text-white bg-neutral-800 px-2 py-1 rounded"
                onClick={(e) => { e.stopPropagation(); /* Ack logic here */ }}
              >
                Acknowledge
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
