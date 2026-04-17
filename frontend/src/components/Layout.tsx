/**
 * App shell — fixed sidebar + sticky topbar + router outlet.
 *
 * Layout goals:
 *   - The sidebar is the primary navigation and brand surface. Gradient logo,
 *     grouped sections, active-state pill with a left accent bar.
 *   - The topbar shows where you are (breadcrumbs derived from the route) plus
 *     global actions: search, agent health indicator, user menu.
 *   - The main area is a max-width container so content doesn't stretch on
 *     ultrawide monitors.
 */
import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  Bot,
  ChevronRight,
  ClockAlert,
  Database,
  Grid3x3,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plug,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Kbd } from './ui';

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

// Flatten once for breadcrumb lookup.
const FLAT_NAV: Record<string, string> = NAV_GROUPS.flatMap((g) => g.items).reduce(
  (acc, item) => {
    acc[item.to] = item.label;
    return acc;
  },
  {} as Record<string, string>
);

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const initials =
    (user
      ? `${(user.first_name || ' ').charAt(0)}${(user.last_name || ' ').charAt(0)}`
      : 'U'
    ).toUpperCase() || 'U';

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  // Derive breadcrumbs from the current path.
  const crumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [{ label: 'Dashboard', to: '/' }];
    const result: { label: string; to: string }[] = [{ label: 'Home', to: '/' }];
    let accumulated = '';
    for (const p of parts) {
      accumulated += `/${p}`;
      const known = FLAT_NAV[accumulated];
      result.push({
        label: known ?? decodeURIComponent(p).replace(/-/g, ' '),
        to: accumulated,
      });
    }
    return result;
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex bg-[color:var(--surface-0)] text-[color:var(--text-md)]">
      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] flex flex-col sticky top-0 h-screen">
        {/* Brand */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-[color:var(--border-subtle)] relative overflow-hidden">
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="relative shrink-0 p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[var(--shadow-brand)]">
            <Bot className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="relative min-w-0">
            <h1 className="font-bold text-[14px] tracking-tight text-gradient-brand leading-none">
              VoxBridge
            </h1>
            <p className="text-[10px] text-[color:var(--text-dim)] font-medium truncate mt-1">
              {user?.organization_name || 'Product Intelligence'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {NAV_GROUPS.map((g) => (
            <div key={g.heading}>
              <p className="px-2.5 pb-1.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-dim)] font-semibold">
                {g.heading}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      end={it.to === '/'}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all ${
                          isActive
                            ? 'text-white bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-transparent'
                            : 'text-[color:var(--text-lo)] hover:text-[color:var(--text-hi)] hover:bg-white/[0.03]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                          )}
                          <span
                            className={`flex items-center justify-center w-6 h-6 shrink-0 transition-colors ${
                              isActive ? 'text-indigo-300' : 'text-[color:var(--text-lo)] group-hover:text-[color:var(--text-md)]'
                            }`}
                          >
                            {it.icon}
                          </span>
                          <span className="truncate">{it.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="border-t border-[color:var(--border-subtle)] p-3 relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.03] border border-[color:var(--border-soft)] hover:bg-white/[0.05] transition-colors"
          >
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-[11px] font-semibold shadow-sm">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[color:var(--surface-1)] dot-pulse" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[12px] font-medium text-[color:var(--text-hi)] truncate">
                {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Guest'}
              </p>
              <p className="text-[10px] text-[color:var(--text-dim)] truncate">{user?.email}</p>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl bg-[color:var(--surface-3)] border border-[color:var(--border-soft)] shadow-[var(--shadow-lg)] p-1 enter-up">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-[color:var(--text-md)] hover:bg-white/[0.04]"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-rose-300 hover:bg-rose-500/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar crumbs={crumbs} />
        <div className="flex-1 px-8 py-7 max-w-[1400px] mx-auto w-full">
          <div className="enter-up">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

function TopBar({ crumbs }: { crumbs: { label: string; to: string }[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Quick jump: if query matches a route label, go there.
    const byLabel = Object.entries(FLAT_NAV).find(([, label]) =>
      label.toLowerCase().includes(q.toLowerCase())
    );
    if (byLabel) navigate(byLabel[0]);
    else navigate(`/tickets?q=${encodeURIComponent(q)}`);
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-1)]/80 backdrop-blur-xl flex items-center gap-4 px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-[12px] min-w-0" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <div key={c.to} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[color:var(--text-dim)] shrink-0" />}
            {i === crumbs.length - 1 ? (
              <span className="text-[color:var(--text-hi)] font-medium truncate capitalize">
                {c.label}
              </span>
            ) : (
              <button
                onClick={() => navigate(c.to)}
                className="text-[color:var(--text-lo)] hover:text-[color:var(--text-hi)] truncate capitalize"
              >
                {c.label}
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Search */}
      <form onSubmit={onSubmit} className="hidden md:flex items-center gap-2 h-9 px-3 w-72 rounded-xl bg-white/[0.04] border border-[color:var(--border-soft)] focus-within:border-[color:var(--brand-500)]/60 focus-within:bg-white/[0.06] transition-all">
        <Search className="w-3.5 h-3.5 text-[color:var(--text-dim)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or jump to…"
          className="flex-1 bg-transparent outline-none text-[12px] text-[color:var(--text-hi)] placeholder:text-[color:var(--text-dim)]"
        />
        <Kbd>Enter</Kbd>
      </form>
    </header>
  );
}
