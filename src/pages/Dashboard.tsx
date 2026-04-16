import { useCattleStore, CowStatus } from '../store/cattleStore';
import { Activity, AlertTriangle, Eye, Heart, TrendingUp, Clock } from 'lucide-react';

const statusColors: Record<CowStatus, string> = {
  Heat: 'bg-red-100 text-red-700 border-red-200',
  Monitor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Healthy: 'bg-green-100 text-green-700 border-green-200',
};

const statusDot: Record<CowStatus, string> = {
  Heat: 'bg-red-500',
  Monitor: 'bg-yellow-500',
  Healthy: 'bg-green-500',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const cows = useCattleStore((s) => s.cows);
  const alerts = useCattleStore((s) => s.alerts);

  const totalCows = cows.length;
  const inHeat = cows.filter((c) => c.status === 'Heat').length;
  const monitoring = cows.filter((c) => c.status === 'Monitor').length;
  const healthy = cows.filter((c) => c.status === 'Healthy').length;
  const unreadAlerts = alerts.filter((a) => !a.read).length;
  const recentAlerts = alerts.slice(0, 5);

  const cards = [
    {
      label: 'Total Animals',
      value: totalCows,
      icon: Activity,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
    },
    {
      label: 'In Heat',
      value: inHeat,
      icon: Heart,
      color: 'from-red-500 to-red-600',
      bg: 'bg-red-50',
      text: 'text-red-600',
    },
    {
      label: 'Monitoring',
      value: monitoring,
      icon: Eye,
      color: 'from-yellow-500 to-yellow-600',
      bg: 'bg-yellow-50',
      text: 'text-yellow-600',
    },
    {
      label: 'Healthy',
      value: healthy,
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      bg: 'bg-green-50',
      text: 'text-green-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {formatDate(new Date().toISOString())} — Real-time cattle health overview
          </p>
        </div>
        {unreadAlerts > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-red-600 text-sm font-medium">{unreadAlerts} unread alert{unreadAlerts > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`${card.bg} p-2.5 rounded-xl`}>
                  <Icon size={20} className={card.text} />
                </div>
                <span className="text-3xl font-bold text-slate-800">{card.value}</span>
              </div>
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <div className={`mt-2 h-1 rounded-full bg-gradient-to-r ${card.color} opacity-60`} />
            </div>
          );
        })}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cow Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">All Animals</h2>
            <p className="text-sm text-slate-500 mt-0.5">Live status of registered cattle</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Breed</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Tag ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Last Check</th>
                </tr>
              </thead>
              <tbody>
                {cows.map((cow, i) => (
                  <tr key={cow.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-25'}`}>
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-600">#{cow.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusDot[cow.status]}`} />
                        <span className="text-sm font-medium text-slate-800">{cow.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{cow.breed}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-700">{cow.tagId}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[cow.status]}`}>
                        {cow.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{formatTime(cow.lastChecked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">Recent Alerts</h2>
            <p className="text-sm text-slate-500 mt-0.5">Latest system notifications</p>
          </div>
          <div className="p-4 space-y-3">
            {recentAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No alerts yet</div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border transition-all ${
                    alert.status === 'Heat'
                      ? 'bg-red-50 border-red-100'
                      : alert.status === 'Monitor'
                      ? 'bg-yellow-50 border-yellow-100'
                      : 'bg-green-50 border-green-100'
                  } ${!alert.read ? 'ring-2 ring-offset-1 ring-opacity-50 ' + (alert.status === 'Heat' ? 'ring-red-400' : alert.status === 'Monitor' ? 'ring-yellow-400' : 'ring-green-400') : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDot[alert.status]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-xs text-slate-400">{formatTime(alert.timestamp)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          alert.source === 'CCTV' ? 'bg-blue-100 text-blue-600' : alert.source === 'Image' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                        }`}>{alert.source}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <span className="text-xl">📹</span>
            </div>
            <h3 className="font-semibold">CCTV Monitoring</h3>
          </div>
          <p className="text-blue-100 text-sm">Automatic 24/7 detection via live simulation, video upload, or YouTube feed with real-time alerts.</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <span className="text-xl">🔬</span>
            </div>
            <h3 className="font-semibold">Image Analysis</h3>
          </div>
          <p className="text-purple-100 text-sm">Manual image upload with AI-powered heat detection. Upload → Preview → Analyze → Result.</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <span className="text-xl">📋</span>
            </div>
            <h3 className="font-semibold">Manual Check-In</h3>
          </div>
          <p className="text-green-100 text-sm">Step-by-step assessment: Select Cow → Symptoms → CCTV Video → Hybrid Score Result.</p>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Herd Health Distribution</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-600 font-medium">Healthy</span>
              <span className="text-slate-500">{healthy}/{totalCows}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-1000"
                style={{ width: totalCows > 0 ? `${(healthy / totalCows) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-yellow-600 font-medium">Monitoring</span>
              <span className="text-slate-500">{monitoring}/{totalCows}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-1000"
                style={{ width: totalCows > 0 ? `${(monitoring / totalCows) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-600 font-medium">In Heat</span>
              <span className="text-slate-500">{inHeat}/{totalCows}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-1000"
                style={{ width: totalCows > 0 ? `${(inHeat / totalCows) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
