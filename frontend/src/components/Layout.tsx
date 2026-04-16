/**
 * App shell: fixed sidebar nav + topbar + router outlet.
 * Keeps the visual language of the existing VoxBridge screen.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bot,
  LayoutDashboard,
  Ticket,
  Inbox,
  AlertOctagon,
  Plug,
  Activity,
  MessageSquare,
  Sparkles,
  Grid3x3,
  Database,
  KeyRound,
  ShieldAlert,
  ClockAlert,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { to: '/insights', label: 'Insights', icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'Work',
    items: [
      { to: '/tickets', label: 'Tickets', icon: <Ticket className="w-4 h-4" /> },
      { to: '/events', label: 'Events', icon: <Inbox className="w-4 h-4" /> },
      { to: '/dlq', label: 'Dead Letter Queue', icon: <AlertOctagon className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'AI Pipeline',
    items: [
      { to: '/processing', label: 'Processing Runs', icon: <Activity className="w-4 h-4" /> },
      { to: '/chat', label: 'Chat Sessions', icon: <MessageSquare className="w-4 h-4" /> },
      { to: '/agent', label: 'Voice Agent', icon: <Zap className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'Data',
    items: [
      { to: '/dashboards', label: 'Dashboards', icon: <Grid3x3 className="w-4 h-4" /> },
      { to: '/saved-queries', label: 'Saved Queries', icon: <Database className="w-4 h-4" /> },
      { to: '/integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" /> },
      { to: '/sync', label: 'Sync Checkpoints', icon: <ClockAlert className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'Admin',
    items: [
      { to: '/settings', label: 'Organization', icon: <Settings className="w-4 h-4" /> },
      { to: '/api-keys', label: 'API Keys', icon: <KeyRound className="w-4 h-4" /> },
      { to: '/audit-logs', label: 'Audit Logs', icon: <ShieldAlert className="w-4 h-4" /> },
    ],
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = user
    ? `${(user.first_name || ' ').charAt(0)}${(user.last_name || ' ').charAt(0)}`.toUpperCase() || 'U'
    : 'U';

  return (
    <div className="min-h-screen flex bg-[#0a0d12] text-gray-200">
      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-white/5 bg-[#0b0f15]/80 backdrop-blur-xl flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/5">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[14px] text-white tracking-tight truncate">VoxBridge</h1>
            <p className="text-[10px] text-gray-500 font-medium truncate">
              {user?.organization_name || 'Product Intelligence'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {NAV_GROUPS.map((g) => (
            <div key={g.heading}>
              <p className="px-2.5 pb-1.5 text-[10px] uppercase tracking-[0.14em] text-gray-600 font-semibold">
                {g.heading}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      end={it.to === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all ${
                          isActive
                            ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/25'
                            : 'text-gray-400 border border-transparent hover:bg-white/[0.04] hover:text-gray-200'
                        }`
                      }
                    >
                      {it.icon}
                      <span>{it.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-gray-200 truncate">
                {user ? `${user.first_name} ${user.last_name}` : 'Guest'}
              </p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 px-8 py-6 max-w-[1400px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
