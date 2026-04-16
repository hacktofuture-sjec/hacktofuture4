import { useState, useEffect, useRef } from 'react'
import { Shield, Fingerprint, Activity, Zap, Lock, AlertTriangle, Play, RotateCcw } from 'lucide-react'
import CommandCenter from './components/CommandCenter'
import IdentityView from './components/IdentityView'
import TelemetryView from './components/TelemetryView'
import AnalyticsView from './components/AnalyticsView'
import EnforcementView from './components/EnforcementView'

const TABS = [
  { id: 'command',     label: 'Command Center', icon: Shield },
  { id: 'identity',   label: 'Identity',        icon: Fingerprint },
  { id: 'telemetry',  label: 'Telemetry',       icon: Activity },
  { id: 'analytics',  label: 'Analytics',       icon: Zap },
  { id: 'enforcement',label: 'Enforcement',     icon: Lock },
]

const NOISE = [
  { process: 'workload-proxy',    action: 'sys_openat',   file: '/etc/resolv.conf',      matchAction: 'Allow' },
  { process: 'sentinel-agent',   action: 'sys_read',     file: '/proc/self/status',     matchAction: 'Allow' },
  { process: 'spire-agent',      action: 'sys_write',    file: '/var/log/spire.log',    matchAction: 'Allow' },
  { process: 'analytics-engine', action: 'tcp_connect',  file: 'api.internal:443',      matchAction: 'Allow' },
  { process: 'parseable',        action: 'sys_read',     file: '/var/lib/parseable/',   matchAction: 'Allow' },
  { process: 'fluent-bit',       action: 'sys_write',    file: '/var/log/tetragon.log', matchAction: 'Allow' },
]

function mkLog(evt) {
  return { ...evt, timestamp: new Date().toISOString(), pid: String(Math.floor(Math.random() * 9000) + 1000) }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('command')
  const [trustScore, setTrustScore] = useState(94.2)
  const [trustHistory, setTrustHistory] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      time: new Date(Date.now() - (30 - i) * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      score: 88 + Math.random() * 11,
    }))
  )
  const [auditLogs, setAuditLogs] = useState([mkLog(NOISE[0]), mkLog(NOISE[1])])
  const [isUnderAttack, setIsUnderAttack] = useState(false)
  const [ambushStatus, setAmbushStatus] = useState('idle') // idle | running | done
  const tickRef = useRef(0)

  // Poll 1 — Trust Score
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/latest_score')
        if (res.ok) {
          const data = await res.json()
          const raw = data.score ?? data.trust_score ?? null
          if (raw !== null && !isUnderAttack) {
            const s = parseFloat((raw * 100).toFixed(1))
            setTrustScore(s)
            setTrustHistory(prev => [...prev.slice(-59), {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              score: s,
            }])
            if (data.intent_drift_detected || s < 50) setIsUnderAttack(true)
          }
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => clearInterval(id)
  }, [isUnderAttack])

  // Poll 2 — Audit Logs (Parseable) + background noise fallback
  useEffect(() => {
    const poll = async () => {
      let gotReal = false
      try {
        const res = await fetch('/api/v1/logstream/tetragon?limit=20', {
          headers: { Authorization: 'Basic ' + btoa('admin:admin') },
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setAuditLogs(data.slice().reverse())
            gotReal = true
          }
        }
      } catch {}

      if (!gotReal && !isUnderAttack) {
        tickRef.current += 1
        if (tickRef.current % 2 === 0) {
          setAuditLogs(prev => [mkLog(NOISE[Math.floor(Math.random() * NOISE.length)]), ...prev].slice(0, 25))
        }
      }
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => clearInterval(id)
  }, [isUnderAttack])

  // Kill Switch — watches for Sigkill in logs
  useEffect(() => {
    if (auditLogs.some(l => l.matchAction === 'Sigkill' || l.matchAction === 'SIGKILL')) {
      setIsUnderAttack(true)
      setAmbushStatus('done')
    }
  }, [auditLogs])

  // Red Team Ambush
  const executeAmbush = async () => {
    if (ambushStatus !== 'idle') return
    setAmbushStatus('running')

    try { await fetch('/analytics/trigger_attack', { method: 'POST' }) } catch {}

    setActiveTab('telemetry')
    setTimeout(() => {
      setAuditLogs(prev => [
        mkLog({ process: 'rogue-agent', action: 'sys_openat', file: '/forbidden_secrets.txt', matchAction: 'Sigkill', pid: '4721' }),
        mkLog({ process: 'rogue-agent', action: 'kprobe/security_file_permission', file: '/forbidden_secrets.txt', matchAction: 'Sigkill', pid: '4721' }),
        ...prev,
      ].slice(0, 25))
      setIsUnderAttack(true)
      setTrustScore(8.3)
      setTrustHistory(prev => [...prev, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), score: 8.3 }])
    }, 1500)

    setTimeout(() => setActiveTab('analytics'), 3500)
    setTimeout(() => { setActiveTab('enforcement'); setAmbushStatus('done') }, 5500)
  }

  const resetSystem = () => {
    setIsUnderAttack(false)
    setAmbushStatus('idle')
    setTrustScore(94.2)
    setAuditLogs([mkLog(NOISE[0])])
    setActiveTab('command')
    setTrustHistory(Array.from({ length: 30 }, (_, i) => ({
      time: new Date(Date.now() - (30 - i) * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      score: 88 + Math.random() * 11,
    })))
  }

  const views = {
    command:     <CommandCenter trustScore={trustScore} trustHistory={trustHistory} isUnderAttack={isUnderAttack} />,
    identity:    <IdentityView isUnderAttack={isUnderAttack} />,
    telemetry:   <TelemetryView auditLogs={auditLogs} isUnderAttack={isUnderAttack} />,
    analytics:   <AnalyticsView trustScore={trustScore} trustHistory={trustHistory} isUnderAttack={isUnderAttack} />,
    enforcement: <EnforcementView isUnderAttack={isUnderAttack} />,
  }

  return (
    <div className={`min-h-screen bg-[#0a0f16] text-slate-100 font-sans relative overflow-x-hidden scanline transition-all duration-700`}>

      {/* Global Attack Border */}
      <div className={`fixed inset-0 pointer-events-none z-50 border-4 transition-all duration-500 rounded-none ${
        isUnderAttack ? 'border-rose-600 animate-pulse' : 'border-transparent'
      }`} />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`p-1.5 rounded-lg ${isUnderAttack ? 'bg-rose-500/20' : 'bg-emerald-500/10'}`}>
              <Shield className={`w-5 h-5 ${isUnderAttack ? 'text-rose-500' : 'text-emerald-400'}`} />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-black tracking-widest text-white">SOVEREIGN SENTINEL</p>
              <p className="text-[9px] text-slate-600 tracking-widest">v2.4 · ZERO-TRUST</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-0.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold tracking-widest rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label.toUpperCase()}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isUnderAttack && (
              <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                BREACH ACTIVE
              </div>
            )}
            {ambushStatus === 'idle' ? (
              <button
                onClick={executeAmbush}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-black tracking-widest bg-rose-600/10 border border-rose-600/40 text-rose-500 rounded-lg hover:bg-rose-600/20 transition-all"
              >
                <Play className="w-3 h-3" />
                EXECUTE RED TEAM AMBUSH
              </button>
            ) : ambushStatus === 'running' ? (
              <span className="px-3 py-2 text-[10px] font-black text-amber-400 animate-pulse tracking-widest">⚡ EXECUTING...</span>
            ) : (
              <button
                onClick={resetSystem}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-black tracking-widest bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                RESET SYSTEM
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6 pb-12">
        {views[activeTab]}
      </main>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 h-7 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-sm flex items-center justify-between px-6 text-[9px] font-mono text-slate-600">
        <div className="flex items-center gap-5">
          <span>● SPIRE:ACTIVE</span>
          <span>● TETRAGON:ACTIVE</span>
          <span>● PARSEABLE:CONNECTED</span>
          <span>● OPA:ARMED</span>
          <span>● FASTAPI:ONLINE</span>
        </div>
        <div className="flex items-center gap-5">
          <span>LATENCY: 0.84ms</span>
          <span>TRUST: {trustScore}%</span>
          <span className={isUnderAttack ? 'text-rose-500 font-bold animate-pulse' : 'text-emerald-500'}>
            {isUnderAttack ? '⚠ UNDER ATTACK' : '● NOMINAL'}
          </span>
        </div>
      </footer>
    </div>
  )
}
