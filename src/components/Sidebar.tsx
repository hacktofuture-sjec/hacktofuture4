import {
  LayoutDashboard,
  Beef,
  Camera,
  ScanSearch,
  Bell,
  ClipboardCheck,
  Menu,
  X,
  Activity,
} from 'lucide-react';
import { useCattleStore } from '../store/cattleStore';

export type Page = 'dashboard' | 'animals' | 'monitoring' | 'image-analysis' | 'alerts' | 'manual-checkin';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'animals' as Page, label: 'Animals', icon: Beef },
  { id: 'monitoring' as Page, label: 'CCTV Monitoring', icon: Camera },
  { id: 'image-analysis' as Page, label: 'Image Analysis', icon: ScanSearch },
  { id: 'manual-checkin' as Page, label: 'Manual Check-In', icon: ClipboardCheck },
  { id: 'alerts' as Page, label: 'Alerts', icon: Bell },
];

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  const alerts = useCattleStore((s) => s.alerts);
  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-all duration-300 min-h-screen shadow-2xl`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">CattleWatch</h1>
              <p className="text-xs text-slate-400">AI Monitor</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mx-auto">
            <Activity size={18} className="text-white" />
          </div>
        )}
        <button
          onClick={onToggle}
          className={`text-slate-400 hover:text-white transition-colors ${collapsed ? 'hidden' : ''}`}
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      {/* Toggle button when collapsed */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Nav Items */}
      <nav className="flex-1 p-2 space-y-1 mt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const showBadge = item.id === 'alerts' && unreadCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-green-600 text-white shadow-lg shadow-green-900/50'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon size={20} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {showBadge && (
                <span
                  className={`${
                    collapsed ? 'absolute top-1 right-1' : 'ml-auto'
                  } bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold">
              VT
            </div>
            <div>
              <p className="text-xs font-medium text-white">Vet Team</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
