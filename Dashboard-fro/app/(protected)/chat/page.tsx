'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageSquare,
  BarChart3,
  ExternalLink,
  Sparkles,
  Shield,
  Zap,
  Activity,
  ArrowRight,
  Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlowCard } from '@/components/ui/spotlight-card'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'

export default function ChatPage() {
  const router = useRouter()
  const [analyzeHovered, setAnalyzeHovered] = useState(false)
  const [openHovered, setOpenHovered] = useState(false)
  const novaChatUrl = process.env.NEXT_PUBLIC_NOVA_CHAT_URL || 'http://localhost:5173'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
            Apps
          </h1>
          <p className="text-gray-600 dark:text-white/60">
            Access and analyze the Nova Chat application
          </p>
        </div>

        {/* Nova Chat App Card */}
        <GlowCard
          glowColor="blue"
          customSize={true}
          className="max-w-3xl"
        >
          {/* Card Header */}
          <div className="flex items-start gap-5 mb-8">
            {/* App Icon */}
            <div className="relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Bot className="h-8 w-8 text-white" />
              </div>
              {/* Live status indicator */}
              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
                <div className="absolute h-3 w-3 rounded-full bg-green-400 animate-ping opacity-75" />
                <div className="relative h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-[#0B1220]" />
              </div>
            </div>

            {/* App Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Nova Chat
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400 ring-1 ring-green-500/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Online
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">
                Agentic Self-Healing Cloud application — real-time chat system
                with intelligent monitoring and autonomous analysis
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <InternalGlassPanel density="compact">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20">
                  <Activity className="h-3 w-3 text-blue-500" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-white/50">
                  Uptime
                </span>
              </div>
              <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                99.97%
              </p>
            </InternalGlassPanel>

            <InternalGlassPanel density="compact">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-500/20">
                  <Zap className="h-3 w-3 text-green-500" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-white/50">
                  Response
                </span>
              </div>
              <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                142ms
              </p>
            </InternalGlassPanel>

            <InternalGlassPanel density="compact">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20">
                  <Shield className="h-3 w-3 text-purple-500" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-white/50">
                  Health
                </span>
              </div>
              <p className="text-xl font-black text-green-500 tracking-tight">
                Healthy
              </p>
            </InternalGlassPanel>
          </div>

          {/* Feature Tags */}
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              { icon: Sparkles, label: 'AI-Powered' },
              { icon: Shield, label: 'Self-Healing' },
              { icon: MessageSquare, label: 'Real-Time Chat' },
              { icon: BarChart3, label: 'Analytics' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-white/60 ring-1 ring-gray-200 dark:ring-white/10 transition-colors hover:bg-gray-200 dark:hover:bg-white/10"
              >
                <Icon className="h-3 w-3" />
                {label}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-200 dark:bg-white/10 mb-6" />

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              id="nova-chat-analyze-btn"
              onClick={() => router.push('/dashboard')}
              onMouseEnter={() => setAnalyzeHovered(true)}
              onMouseLeave={() => setAnalyzeHovered(false)}
              className="group relative flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 text-left transition-all duration-300 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-500/40 dark:hover:shadow-blue-500/20"
            >
              {/* Hover glow effect */}
              <div
                className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 transition-opacity duration-300 dark:from-blue-500/10 dark:to-indigo-500/10 group-hover:opacity-100"
              />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 transition-colors group-hover:bg-blue-500/20 dark:text-blue-400">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Analyze
                    </p>
                    <p className="text-xs text-gray-500 dark:text-white/50">
                      View metrics &amp; diagnostics
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className={`h-4 w-4 text-gray-400 transition-all duration-300 dark:text-white/30 ${
                    analyzeHovered
                      ? 'translate-x-0 text-blue-500 opacity-100 dark:text-blue-400'
                      : '-translate-x-1 opacity-0'
                  }`}
                />
              </div>
            </button>

            <button
              id="nova-chat-open-btn"
              onClick={() => window.open(novaChatUrl, '_blank')}
              onMouseEnter={() => setOpenHovered(true)}
              onMouseLeave={() => setOpenHovered(false)}
              className="group relative flex-1 overflow-hidden rounded-xl border-2 border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-left shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110"
            >
              {/* Shimmer effect */}
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full transition-transform duration-700 group-hover:translate-x-full" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Open</p>
                    <p className="text-xs text-white/70">
                      Launch Nova Chat
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className={`h-4 w-4 text-white transition-all duration-300 ${
                    openHovered
                      ? 'translate-x-0 opacity-100'
                      : '-translate-x-1 opacity-0'
                  }`}
                />
              </div>
            </button>
          </div>
        </GlowCard>
      </div>
    </div>
  )
}
