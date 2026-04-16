import { useState, useEffect, useRef } from 'react'
import { Shield, Fingerprint, Activity, Zap, Lock, AlertTriangle, Play, RotateCcw, User, ScanFace, X, ShieldCheck, ShieldX, MousePointer2, Keyboard, Eye, Cpu, MapPin, CheckCircle, ShieldAlert } from 'lucide-react'
import CommandCenter from './components/CommandCenter'
import IdentityView from './components/IdentityView'
import TelemetryView from './components/TelemetryView'
import AnalyticsView from './components/AnalyticsView'
import EnforcementView from './components/EnforcementView'
import HackerTerminal from './components/HackerTerminal'

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

// ─── Biometric Step-Up Modal ────────────────────────────────────────
function BiometricModal({ onApprove, onDeny }) {
  const [scanPhase, setScanPhase] = useState(0) // 0=waiting, 1=scanning, 2=done

  useEffect(() => {
    const t1 = setTimeout(() => setScanPhase(1), 800)
    return () => clearTimeout(t1)
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg glass rounded-2xl border border-amber-500/30 shadow-2xl shadow-amber-500/10 animate-slide-up overflow-hidden">

        {/* Top Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />

        <div className="p-7">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30">
                <ScanFace className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-wide text-white">High-Risk Action Detected</h2>
                <p className="text-[10px] text-amber-400 font-bold tracking-widest mt-0.5">STEP-UP AUTHENTICATION REQUIRED</p>
              </div>
            </div>
            <button onClick={onDeny} className="p-1 rounded-lg hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4">
            <div className="bg-black/40 rounded-xl p-4 border border-slate-700/50 font-mono text-[11px] space-y-2">
              <p className="text-slate-500">// COMPOSITE PRINCIPAL VERIFICATION</p>
              <p><span className="text-slate-500">Agent:</span> <span className="text-sky-400">SENTINEL-01</span></p>
              <p><span className="text-slate-500">Action:</span> <span className="text-rose-400">file.read("/forbidden_secrets.txt")</span></p>
              <p><span className="text-slate-500">Risk Level:</span> <span className="text-rose-500 font-bold">CRITICAL</span></p>
              <p><span className="text-slate-500">Policy:</span> <span className="text-amber-400">Requires human biometric approval (WebAuthn L2)</span></p>
            </div>

            {/* Operator Device Posture */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/40">
              <p className="text-[9px] font-black tracking-widest text-slate-400 mb-2.5">OPERATOR DEVICE POSTURE</p>
              <div className="flex items-center gap-3">
                {[
                  { icon: Cpu, label: 'TPM 2.0: Verified' },
                  { icon: MapPin, label: 'Location: Nominal' },
                  { icon: Eye, label: 'Behavioral Biometrics: Active' },
                ].map(d => (
                  <div key={d.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                    <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-[9px] font-bold text-emerald-400 whitespace-nowrap">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Agent <span className="text-sky-400 font-bold">SENTINEL-01</span> is requesting access to a{' '}
              <span className="text-rose-400 font-bold">restricted resource</span>. This action requires{' '}
              <span className="text-amber-400 font-bold">human biometric authorization</span> via WebAuthn before proceeding.
              The Composite Principal model mandates both agent and human identity verification for high-risk operations.
            </p>

            {/* Biometric Scanner Visual */}
            <div className="bg-black/60 rounded-xl p-5 border border-slate-700/50 flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center transition-all duration-700 ${
                  scanPhase === 0 ? 'border-slate-700 bg-slate-900' :
                  scanPhase === 1 ? 'border-amber-500/60 bg-amber-500/5 animate-pulse' :
                  'border-emerald-500/60 bg-emerald-500/10'
                }`}>
                  <Fingerprint className={`w-8 h-8 transition-colors duration-700 ${
                    scanPhase === 0 ? 'text-slate-700' :
                    scanPhase === 1 ? 'text-amber-400' :
                    'text-emerald-400'
                  }`} />
                </div>
                {scanPhase >= 1 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black tracking-widest text-slate-300 mb-1">WEBAUTHN BIOMETRIC CHALLENGE</p>
                <p className="text-[9px] text-slate-500 font-mono">
                  {scanPhase === 0 ? 'Initializing secure context...' :
                   scanPhase === 1 ? 'Awaiting biometric input — Touch ID / Face ID / Security Key...' :
                   'Biometric verified ✓'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-600">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> FIDO2</span>
                  <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> TLS 1.3</span>
                  <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3" /> Platform Auth</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={onDeny}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest bg-rose-500/10 border border-rose-500/40 text-rose-400 hover:bg-rose-500/20 transition-all"
            >
              <ShieldX className="w-4 h-4" />
              DENY ACCESS & ISOLATE
            </button>
            <button
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              APPROVE (SIMULATE TOUCH ID)
            </button>
          </div>

          <p className="text-center text-[8px] text-slate-700 mt-3 font-mono">
            AEGIS-DID · Agentic Session Defender · Composite Principal · WebAuthn Level 2
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Authentication Boot Screen ────────────────────────────────────────
function AuthenticationScreen({ onComplete }) {
  const [phase, setPhase] = useState(0) // 0=idle, 1=oidc, 2=spiffe, 3=success

  // Auto-reset on login screen mount to clear any lingering attack state
  useEffect(() => {
    const resetState = async () => {
      try {
        await fetch('/aegis-sync/reset', { method: 'POST' })
      } catch (e) {
        console.warn('Reset endpoint unavailable')
      }
    }
    resetState()
  }, [])

  const handleLogin = () => {
    if (phase !== 0) return
    setPhase(1)
    setTimeout(() => setPhase(2), 1500)
    setTimeout(() => setPhase(3), 3000)
    setTimeout(() => onComplete(), 4500)
  }

  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center text-slate-100 font-sans p-4 scanline relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/10 via-[#0a0f16] to-[#0a0f16] pointer-events-none" />
      
      <div className="max-w-md w-full relative z-10 glass rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h1 className="text-2xl font-black tracking-widest text-white">AEGIS<span className="text-sky-400">-DID</span></h1>
          <p className="text-xs text-slate-400 tracking-widest mt-2">AGENTIC SESSION DEFENDER</p>
        </div>

        {phase === 0 ? (
          <button
            onClick={handleLogin}
            className="w-full py-4 px-6 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-xl font-bold tracking-widest text-sm shadow-[0_0_20px_rgba(2,132,199,0.3)] hover:shadow-[0_0_30px_rgba(2,132,199,0.5)] transition-all flex items-center justify-center gap-3 animate-pulse-glow"
          >
            <User className="w-5 h-5" />
            Authenticate (Sarah_Admin)
          </button>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            <div className={`p-3 rounded-lg border flex items-center gap-3 transition-colors duration-500 ${phase >= 1 ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-slate-800 bg-slate-900/50 text-slate-600'}`}>
              <CheckCircle className={`w-4 h-4 transition-opacity duration-300 ${phase >= 1 ? 'opacity-100' : 'opacity-0'}`} />
              [1] Generating OIDC Token (Human Auth)
            </div>
            <div className={`p-3 rounded-lg border flex items-center gap-3 transition-colors duration-500 ${phase >= 2 ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-slate-800 bg-slate-900/50 text-slate-600'}`}>
              <CheckCircle className={`w-4 h-4 transition-opacity duration-300 ${phase >= 2 ? 'opacity-100' : 'opacity-0'}`} />
              [2] Binding to Workload (SENTINEL-01)
            </div>
            <div className={`p-3 rounded-lg border flex items-center gap-3 transition-colors duration-500 ${phase >= 3 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-slate-900/50 text-slate-600'}`}>
              <CheckCircle className={`w-4 h-4 transition-opacity duration-300 ${phase >= 3 ? 'opacity-100' : 'opacity-0'}`} />
              [3] Issuing Composite SPIFFE ID
            </div>
            {phase >= 3 && (
              <div className="text-center text-[10px] text-emerald-500 tracking-widest animate-pulse mt-4">
                AUTHENTICATION SUCCESSFUL. REDIRECTING...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Application ───────────────────────────────────────────────────────
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
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
  const [ambushStatus, setAmbushStatus] = useState('idle') // idle | pending_auth | running | done
  const [hitlDecision, setHitlDecision] = useState(null) // null | 'denied' | 'approved'
  const tickRef = useRef(0)

  // Human Identity State
  const [humanTrustScore, setHumanTrustScore] = useState(99.8)
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false)
  const [autonomyMode, setAutonomyMode] = useState('Assist') // Watch | Assist | Auto
  const [behavioralEvents, setBehavioralEvents] = useState({ keystrokes: 342, mouseDistance: 18420, sessions: 1 })

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

  // Poll 3 — Continuous Behavioral Biometrics (Human Trust fluctuation)
  useEffect(() => {
    if (isUnderAttack) return
    const id = setInterval(() => {
      setHumanTrustScore(prev => {
        const drift = (Math.random() - 0.48) * 0.3 // slight positive bias
        return parseFloat(Math.min(99.9, Math.max(96.0, prev + drift)).toFixed(1))
      })
      setBehavioralEvents(prev => ({
        keystrokes: prev.keystrokes + Math.floor(Math.random() * 8) + 1,
        mouseDistance: prev.mouseDistance + Math.floor(Math.random() * 200) + 50,
        sessions: prev.sessions,
      }))
    }, 3000)
    return () => clearInterval(id)
  }, [isUnderAttack])

  // Kill Switch — watches for Sigkill in logs
  useEffect(() => {
    if (auditLogs.some(l => l.matchAction === 'Sigkill' || l.matchAction === 'SIGKILL')) {
      setIsUnderAttack(true)
      setAmbushStatus('done')
    }
  }, [auditLogs])

  // Red Team Ambush — now gates through biometric modal
  // Network Sync Listener for Cross-Laptop Presentation
  useEffect(() => {
    let interval = setInterval(async () => {
      try {
        const res = await fetch('/aegis-sync/state')
        const data = await res.json()
        if (data.triggered && ambushStatus === 'idle') {
          executeAmbush()
        }
      } catch (e) { }
    }, 500)
    return () => clearInterval(interval)
  }, [ambushStatus])

  const executeAmbush = () => {
    if (ambushStatus !== 'idle') return

    if (autonomyMode === 'Auto') {
      // Full AI Autonomy: Bypass HITL entirely and execute kill sequence
      setAmbushStatus('running')
      handleBiometricDeny() // Reusing the deny logic to trigger the SIGKILL
    } else if (autonomyMode === 'Watch') {
      // Passive Watch: Do not block automatically, wait for manual override
      setIsUnderAttack(true)
      setAmbushStatus('watch')
      try { fetch('/aegis-sync/defend', { method: 'POST', body: JSON.stringify({ status: 'pending' }) }) } catch {}
    } else {
      // Assist: Standard Human-in-the-Loop 
      setAmbushStatus('pending_auth')
      setShowBiometricPrompt(true)
      try { fetch('/aegis-sync/defend', { method: 'POST', body: JSON.stringify({ status: 'pending' }) }) } catch {}
    }
  }

  // HITL: Deny Access & Isolate
  const handleBiometricDeny = () => {
    setShowBiometricPrompt(false)
    setHitlDecision('denied')
    setHumanTrustScore(99.9) // elevated — operator acted correctly
    setAmbushStatus('running')

    try { fetch('/analytics/trigger_attack', { method: 'POST' }) } catch {}
    try { fetch('/aegis-sync/defend', { method: 'POST', body: JSON.stringify({ status: 'killed' }) }) } catch {}

    setActiveTab('telemetry')
    setTimeout(() => {
      setAuditLogs(prev => [
        mkLog({ process: 'HITL-DENY', action: 'Step-Up MFA REJECTED by Sarah_Admin', file: '/forbidden_secrets.txt', matchAction: 'Sigkill', pid: '4721' }),
        mkLog({ process: 'rogue-agent', action: 'sys_openat', file: '/forbidden_secrets.txt', matchAction: 'Sigkill', pid: '4721' }),
        ...prev,
      ].slice(0, 25))
      setIsUnderAttack(true)
      setTrustScore(8.3)
      setTrustHistory(prev => [...prev, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), score: 8.3 }])
    }, 1200)

    setTimeout(() => setActiveTab('analytics'), 3000)
    setTimeout(() => { setActiveTab('enforcement'); setAmbushStatus('done') }, 5000)
  }

  // HITL: Approve (simulate — still triggers attack for demo, but as an approved action)
  const handleBiometricApprove = () => {
    setShowBiometricPrompt(false)
    setHitlDecision('approved')
    setHumanTrustScore(42.1) // drops — operator approved a dangerous action
    setAmbushStatus('running')

    try { fetch('/analytics/trigger_attack', { method: 'POST' }) } catch {}

    setActiveTab('telemetry')
    setTimeout(() => {
      setAuditLogs(prev => [
        mkLog({ process: 'HITL-APPROVE', action: 'Step-Up MFA APPROVED by Sarah_Admin — MONITORING', file: '/forbidden_secrets.txt', matchAction: 'Allow', pid: '4721' }),
        mkLog({ process: 'rogue-agent', action: 'sys_openat', file: '/forbidden_secrets.txt', matchAction: 'Sigkill', pid: '4721' }),
        ...prev,
      ].slice(0, 25))
      setIsUnderAttack(true)
      setTrustScore(8.3)
      setTrustHistory(prev => [...prev, { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), score: 8.3 }])
    }, 1500)

    setTimeout(() => setActiveTab('analytics'), 3500)
    setTimeout(() => { setActiveTab('enforcement'); setAmbushStatus('done') }, 5500)
  }

  const resetSystem = async () => {
    setTrustScore(99.8)
    setIsUnderAttack(false)
    setAmbushStatus('idle')
    setShowBiometricPrompt(false)
    setHitlDecision(null)
    setAuditLogs([])
    try { await fetch('/aegis-sync/reset', { method: 'POST' }) } catch {}
    setHumanTrustScore(99.8)
    setAuditLogs([mkLog(NOISE[0])])
    setActiveTab('command')
    setTrustHistory(Array.from({ length: 30 }, (_, i) => ({
      time: new Date(Date.now() - (30 - i) * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      score: 88 + Math.random() * 11,
    })))
  }

  // Composite Trust = weighted combination of agent + human
  const compositeTrust = isUnderAttack
    ? parseFloat((trustScore * 0.6 + humanTrustScore * 0.4).toFixed(1))
    : parseFloat((trustScore * 0.5 + humanTrustScore * 0.5).toFixed(1))

  const views = {
    command:     <CommandCenter trustScore={trustScore} trustHistory={trustHistory} isUnderAttack={isUnderAttack} humanTrustScore={humanTrustScore} compositeTrust={compositeTrust} behavioralEvents={behavioralEvents} autonomyMode={autonomyMode} />,
    identity:    <IdentityView isUnderAttack={isUnderAttack} humanTrustScore={humanTrustScore} compositeTrust={compositeTrust} behavioralEvents={behavioralEvents} />,
    telemetry:   <TelemetryView auditLogs={auditLogs} isUnderAttack={isUnderAttack} />,
    analytics:   <AnalyticsView trustScore={trustScore} trustHistory={trustHistory} isUnderAttack={isUnderAttack} />,
    enforcement: <EnforcementView isUnderAttack={isUnderAttack} hitlDecision={hitlDecision} />,
  }

  // Route Hacker Terminal
  if (window.location.pathname === '/hacker') {
    return <HackerTerminal />
  }

  if (!isAuthenticated) {
    return <AuthenticationScreen onComplete={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-[#0a0f16] text-slate-100 font-sans relative overflow-x-hidden scanline transition-all duration-700">

      {/* Global Attack Border */}
      <div className={`fixed inset-0 pointer-events-none z-50 border-4 transition-all duration-500 rounded-none ${
        isUnderAttack ? 'border-rose-600 animate-pulse' : 'border-transparent'
      }`} />

      {/* Biometric Modal */}
      {showBiometricPrompt && (
        <BiometricModal onApprove={handleBiometricApprove} onDeny={handleBiometricDeny} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`p-1.5 rounded-lg ${isUnderAttack ? 'bg-rose-500/20' : 'bg-emerald-500/10'}`}>
              <Shield className={`w-5 h-5 ${isUnderAttack ? 'text-rose-500' : 'text-emerald-400'}`} />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-black tracking-widest text-white">AEGIS-DID</p>
              <p className="text-[9px] text-slate-600 tracking-widest">AGENTIC SESSION DEFENDER · COMPOSITE PRINCIPAL</p>
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

          {/* Operator Profile + Autonomy + Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">

            {/* Human Operator Badge */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="leading-tight">
                <p className="text-[9px] font-black tracking-widest text-slate-300">Sarah_Admin</p>
                <div className="flex items-center gap-2 text-[8px] text-slate-500">
                  <span className={`font-bold ${humanTrustScore > 90 ? 'text-emerald-400' : humanTrustScore > 50 ? 'text-amber-400' : 'text-rose-500'}`}>
                    TRUST: {humanTrustScore}%
                  </span>
                  <span className="flex items-center gap-0.5 text-violet-400">
                    <MousePointer2 className="w-2.5 h-2.5" />
                    <Keyboard className="w-2.5 h-2.5" />
                    BIO:ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Autonomy Mode Segmented Control */}
            <div className="flex items-center rounded-lg border border-slate-700/50 bg-slate-800/40 overflow-hidden">
              {['Watch', 'Assist', 'Auto'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setAutonomyMode(mode)}
                  className={`px-2.5 py-1.5 text-[9px] font-black tracking-widest transition-all ${
                    autonomyMode === mode
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>

            {isUnderAttack && (
              <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                BREACH
              </div>
            )}
            {ambushStatus === 'watch' ? (
              <button
                onClick={handleBiometricDeny}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-black tracking-widest bg-rose-600 border border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.5)] rounded-lg hover:bg-rose-500 transition-all animate-pulse"
              >
                <ShieldAlert className="w-3 h-3" />
                INTERVENE & BLOCK
              </button>
            ) : ambushStatus === 'idle' ? (
              <button
                onClick={executeAmbush}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-black tracking-widest bg-rose-600/10 border border-rose-600/40 text-rose-500 rounded-lg hover:bg-rose-600/20 transition-all"
              >
                <ShieldAlert className="w-3 h-3" />
                SIMULATE STOLEN SESSION
              </button>
            ) : ambushStatus === 'pending_auth' ? (
              <span className="px-3 py-2 text-[10px] font-black text-amber-400 animate-pulse tracking-widest">
                <ScanFace className="w-3 h-3 inline mr-1" />
                AWAITING MFA...
              </span>
            ) : ambushStatus === 'running' ? (
              <span className="px-3 py-2 text-[10px] font-black text-amber-400 animate-pulse tracking-widest">EXECUTING...</span>
            ) : (
              <button
                onClick={resetSystem}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-black tracking-widest bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                RESET
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
          <span className="text-violet-400">● WEBAUTHN:READY</span>
        </div>
        <div className="flex items-center gap-5">
          <span>AGENT TRUST: {trustScore}%</span>
          <span className={humanTrustScore > 90 ? 'text-emerald-500' : humanTrustScore > 50 ? 'text-amber-400' : 'text-rose-500'}>
            HUMAN TRUST: {humanTrustScore}%
          </span>
          <span className={isUnderAttack ? 'text-rose-500 font-bold animate-pulse' : 'text-emerald-500'}>
            {isUnderAttack ? 'UNDER ATTACK' : 'NOMINAL'}
          </span>
        </div>
      </footer>
    </div>
  )
}
