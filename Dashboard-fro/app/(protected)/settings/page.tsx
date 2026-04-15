'use client'

import { useAuth } from '@/hooks/useAuth'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bell, Lock, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="max-w-2xl space-y-6 p-6 text-gray-900 dark:text-white">
      {/* Profile Section */}
      <InternalGlassPanel>
        <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h2>
        
        <div className="space-y-4">
          {/* Avatar */}
          <div>
            <label className="text-sm font-semibold mb-3 block">Avatar</label>
            <div className="flex items-center gap-4">
              <img
                src={user?.username ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}` : '/avatar.jpg'}
                alt={user?.username}
                className="w-16 h-16 rounded-full"
              />
              <Button variant="outline">Change Avatar</Button>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={user?.username || ''}
              disabled
              className="glass-sm"
            />
            <p className="text-xs text-gray-600 dark:text-white/60">Your username cannot be changed</p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="glass-sm"
            />
            <p className="text-xs text-gray-600 dark:text-white/60">Your email address</p>
          </div>
        </div>
      </InternalGlassPanel>

      {/* Security Section */}
      <InternalGlassPanel>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Lock className="h-6 w-6" />
          Security
        </h2>

        <div className="space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter current password"
                className="glass-sm pr-10"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              className="glass-sm"
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              className="glass-sm"
            />
          </div>

          <Button className="w-full bg-primary hover:bg-primary/90">
            Update Password
          </Button>
        </div>
      </InternalGlassPanel>

      {/* Notifications Section */}
      <InternalGlassPanel>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Bell className="h-6 w-6" />
          Notifications
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Incident Alerts</p>
              <p className="text-sm text-gray-600 dark:text-white/60">Get notified when incidents are detected</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
          </div>

          <div className="flex items-center justify-between border-t border-border/30 pt-4">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">System Recovery</p>
              <p className="text-sm text-gray-600 dark:text-white/60">Get notified when systems are recovered</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
          </div>

          <div className="flex items-center justify-between border-t border-border/30 pt-4">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">New Messages</p>
              <p className="text-sm text-gray-600 dark:text-white/60">Get notified about new messages</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
          </div>

          <div className="flex items-center justify-between border-t border-border/30 pt-4">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Email Notifications</p>
              <p className="text-sm text-gray-600 dark:text-white/60">Receive updates via email</p>
            </div>
            <input type="checkbox" className="w-5 h-5 rounded" />
          </div>
        </div>
      </InternalGlassPanel>

      {/* Danger Zone */}
      <InternalGlassPanel className="border-destructive/30 bg-black/30">
        <h2 className="text-2xl font-bold mb-4 text-destructive">Danger Zone</h2>
        <p className="text-sm text-gray-600 dark:text-white/60 mb-4">These actions cannot be undone</p>
        <Button variant="destructive" className="w-full">
          Delete Account
        </Button>
      </InternalGlassPanel>
    </div>
  )
}
