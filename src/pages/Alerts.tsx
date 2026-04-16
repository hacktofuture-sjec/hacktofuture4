import { useCattleStore, CowStatus } from '../store/cattleStore';
import { Bell, BellOff, Check, CheckCheck, AlertTriangle, Eye, Camera, ScanLine, Clock } from 'lucide-react';

const statusColors: Record<CowStatus, string> = {
  Heat: 'border-red-200 bg-red-50',
  Monitor: 'border-yellow-200 bg-yellow-50',
  Healthy: 'border-green-200 bg-green-50',
};

const statusBadge: Record<CowStatus, string> = {
  Heat: 'bg-red-100 text-red-700',
  Monitor: 'bg-yellow-100 text-yellow-700',
  Healthy: 'bg-green-100 text-green-700',
};

const statusIcon: Record<CowStatus, React.ReactNode> = {
  Heat: <AlertTriangle size={16} className="text-red-500" />,
  Monitor: <Eye size={16} className="text-yellow-500" />,
  Healthy: <Check size={16} className="text-green-500" />,
};

const sourceIcon: Record<string, React.ReactNode> = {
  CCTV: <Camera size={12} className="text-blue-500" />,
  Image: <ScanLine size={12} className="text-purple-500" />,
  Manual: <Check size={12} className="text-gray-500" />,
};

const sourceBadge: Record<string, string> = {
  CCTV: 'bg-blue-100 text-blue-600',
  Image: 'bg-purple-100 text-purple-600',
  Manual: 'bg-gray-100 text-gray-600',
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Alerts() {
  const alerts = useCattleStore((s) => s.alerts);
  const markAlertRead = useCattleStore((s) => s.markAlertRead);
  const markAllAlertsRead = useCattleStore((s) => s.markAllAlertsRead);

  const unread = alerts.filter((a) => !a.read).length;
  const heatAlerts = alerts.filter((a) => a.status === 'Heat').length;
  const monitorAlerts = alerts.filter((a) => a.status === 'Monitor').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alerts</h1>
          <p className="text-slate-500 text-sm mt-1">System notifications and detection events</p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllAlertsRead}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <CheckCheck size={16} />
            Mark All Read
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{alerts.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total Alerts</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-100 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{heatAlerts}</p>
          <p className="text-xs text-red-500 mt-1">Heat Alerts</p>
        </div>
        <div className="bg-yellow-50 rounded-2xl border border-yellow-100 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{monitorAlerts}</p>
          <p className="text-xs text-yellow-500 mt-1">Monitor Alerts</p>
        </div>
      </div>

      {/* Alert List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-slate-600" />
            <h2 className="font-semibold text-slate-800">All Alerts</h2>
            {unread > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unread} new</span>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {alerts.length === 0 ? (
            <div className="text-center py-16">
              <BellOff size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No alerts yet</p>
              <p className="text-slate-300 text-sm mt-1">Alerts will appear here as the system detects events</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-5 transition-all ${!alert.read ? statusColors[alert.status] : 'bg-white'} border-l-4 ${
                  alert.status === 'Heat' ? 'border-l-red-400' : alert.status === 'Monitor' ? 'border-l-yellow-400' : 'border-l-green-400'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 p-2 rounded-xl ${
                    alert.status === 'Heat' ? 'bg-red-100' : alert.status === 'Monitor' ? 'bg-yellow-100' : 'bg-green-100'
                  }`}>
                    {statusIcon[alert.status]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800 leading-relaxed">{alert.message}</p>
                      {!alert.read && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[alert.status]}`}>
                        {alert.status}
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sourceBadge[alert.source]}`}>
                        {sourceIcon[alert.source]}
                        {alert.source}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={10} />
                        {formatTimestamp(alert.timestamp)} · {timeAgo(alert.timestamp)}
                      </span>
                    </div>
                  </div>

                  {!alert.read && (
                    <button
                      onClick={() => markAlertRead(alert.id)}
                      className="flex-shrink-0 p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
