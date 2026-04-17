'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Zap,
  Network,
  Wrench,
  HistoryIcon,
  TrendingUp,
  Layers,
  LogOut,
  Settings,
  Server,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Core Platform',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
      { icon: Activity, label: 'Observability', href: '/observability' },
      { icon: Server, label: 'Services', href: '/services' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { icon: AlertTriangle, label: 'Anomalies', href: '/anomalies' },
      { icon: Zap, label: 'Root Cause', href: '/rca' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { icon: Network, label: 'Dependencies', href: '/map' },
      { icon: Wrench, label: 'Remediation', href: '/remediation' },
      { icon: HistoryIcon, label: 'Incidents', href: '/incidents' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { icon: TrendingUp, label: 'Learning', href: '/learning' },
      { icon: Layers, label: 'Clusters', href: '/clusters' },
    ],
  },
  {
    label: 'Communication',
    items: [{ icon: MessageSquare, label: 'App', href: '/chat' }],
  },
  {
    label: 'Account',
    items: [{ icon: Settings, label: 'Settings', href: '/settings' }],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  const linkActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href + '/'))

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white text-gray-900 dark:border-white/10 dark:bg-black/90 dark:text-white dark:backdrop-blur-xl">
      <div className="flex h-full flex-col px-4 py-6">
        <div className="space-y-1">
          <div className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">AetherMesh</div>
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500 dark:text-white/60">Self-healing cloud</p>
        </div>

        <nav className="mt-8 flex-1 space-y-8 overflow-y-auto pr-1 pb-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/60">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = linkActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'border border-blue-500/30 bg-blue-50 text-gray-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn('shrink-0', isActive ? 'text-blue-600 dark:text-white' : 'text-gray-500 dark:text-white/70')}
                        size={18}
                      />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-gray-200 pt-4 dark:border-white/10">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-center gap-2 rounded-xl border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 hover:bg-gray-100 dark:border-white/10 dark:bg-[#0B1220]/80 dark:text-white dark:hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  )
}
