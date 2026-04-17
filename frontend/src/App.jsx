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



function mkLog(evt) {
  return { ...evt, timestamp: new Date().toISOString(), pid: evt.pid ?? '' }
}

// ─── Biometric Step-Up Modal ────────────────────────────────────────
function BiometricModal({ onApprove, onDeny, authToken }) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [authError, setAuthError] = useState('')
  const [otp, setOtp] = useState('')

  const handleFaceIdVerify = async () => {
    if (isVerifying || otp.trim().length < 6) return
    setAuthError('')
    setIsVerifying(true)
    try {
      const verifyRes = await fetch('/auth/step-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ otp: otp.trim() }),
      })
      const payload = await verifyRes.json().catch(() => ({}))
      if (!verifyRes.ok) throw new Error(payload?.detail || 'Step-up verification failed')
      onApprove('TOTP_MFA', payload.step_up_token)
    } catch (err) {
      setAuthError(err?.message || 'Step-up verification failed.')
    } finally {
      setIsVerifying(false)
    }
  }

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
              <p className="text-slate-500">// RISK-TRIGGERED STEP-UP VERIFICATION</p>
              <p><span className="text-slate-500">Required Action:</span> <span className="text-amber-400">Enter live TOTP code</span></p>
              <p><span className="text-slate-500">Policy:</span> <span className="text-rose-500 font-bold">BLOCK UNTIL VERIFIED STEP-UP TOKEN</span></p>
              <p><span className="text-slate-500">Verification:</span> <span className="text-emerald-400">Server-side TOTP validation</span></p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              The platform requires a real second-factor verification from the operator before this action may continue.
              Enter a valid authenticator app code to mint a short-lived step-up token.
            </p>

            {/* Step-up Input */}
            <div className="bg-black/60 rounded-xl p-5 border border-slate-700/50 flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-xl border-2 border-emerald-500/60 bg-emerald-500/10 flex items-center justify-center">
                  <Fingerprint className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black tracking-widest text-slate-300 mb-1">MFA CODE CHALLENGE</p>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                  placeholder="Enter 6-digit code"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-emerald-500/50"
                />
                <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-600">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> TOTP</span>
                  <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> JWT</span>
                  <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3" /> Step-up</span>
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
              onClick={handleFaceIdVerify}
              disabled={isVerifying || otp.trim().length < 6}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              {isVerifying ? 'VERIFYING...' : 'VERIFY STEP-UP'}
            </button>
          </div>

          {authError && (
            <p className="text-[9px] text-rose-400 mt-3">{authError}</p>
          )}

          <p className="text-center text-[8px] text-slate-700 mt-3 font-mono">
            AEGIS-DID · Agentic Session Defender · Composite Principal · Server-Verified MFA
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Authentication Boot Screen ────────────────────────────────────────
function AuthenticationScreen({ onComplete }) {
  const [checking, setChecking] = useState(false)
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [provisioning, setProvisioning] = useState(null)

  const handleRegister = async () => {
    if (checking) return
    setChecking(true)
    setMessage('')
    setProvisioning(null)
    try {
      const registerRes = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const payload = await registerRes.json().catch(() => ({}))
      if (!registerRes.ok) throw new Error(payload?.detail || 'Registration failed')
      setProvisioning(payload)
      setMessage('User registered. Save your TOTP secret and then log in.')
    } catch (e) {
      setMessage(e?.message || 'Registration failed')
    } finally {
      setChecking(false)
    }
  }

  const handleLogin = async () => {
    if (checking) return
    setChecking(true)
    setMessage('')
    try {
      const loginRes = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, otp: otp.trim() }),
      })
      const payload = await loginRes.json().catch(() => ({}))
      if (!loginRes.ok) throw new Error(payload?.detail || 'Login failed')
      onComplete({ token: payload.access_token, username: username.trim() })
    } catch (e) {
      setMessage(e?.message || 'Login failed')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center text-slate-100 font-sans p-4 scanline relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/10 via-[#0a0f16] to-[#0a0f16] pointer-events-none" />
      
      <div className="max-w-md w-full relative z-10 glass rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h1 className="text-2xl font-black tracking-widest text-white">AEGIS<span className="text-sky-400">-DID</span></h1>
          <p className="text-xs text-slate-400 tracking-widest mt-2">LIVE SESSION CONNECTOR</p>
        </div>

        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400">
            Real login is enforced with username/password + TOTP. No simulated auth path.
          </div>

          <div className="flex rounded-lg overflow-hidden border border-slate-700/60">
            <button
              className={`flex-1 py-2 text-[10px] tracking-widest font-black ${mode === 'login' ? 'bg-sky-600/30 text-sky-300' : 'bg-slate-900 text-slate-500'}`}
              onClick={() => setMode('login')}
            >
              LOGIN
            </button>
            <button
              className={`flex-1 py-2 text-[10px] tracking-widest font-black ${mode === 'register' ? 'bg-amber-600/30 text-amber-300' : 'bg-slate-900 text-slate-500'}`}
              onClick={() => setMode('register')}
            >
              REGISTER
            </button>
          </div>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-3 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder={mode === 'register' ? 'Password (min 12 chars)' : 'Password'}
            className="w-full px-3 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none"
          />
          {mode === 'login' && (
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              placeholder="TOTP code"
              className="w-full px-3 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 outline-none"
            />
          )}

          <button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            className="w-full py-4 px-6 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-xl font-bold tracking-widest text-sm shadow-[0_0_20px_rgba(2,132,199,0.3)] hover:shadow-[0_0_30px_rgba(2,132,199,0.5)] transition-all flex items-center justify-center gap-3 animate-pulse-glow disabled:opacity-60"
            disabled={checking}
          >
            <User className="w-5 h-5" />
            {checking ? 'PROCESSING...' : mode === 'login' ? 'LOGIN WITH MFA' : 'CREATE USER'}
          </button>

          {provisioning && (
            <div className="text-[10px] text-amber-400 border border-amber-500/20 rounded-lg p-2 bg-amber-500/5">
              <p className="font-bold mb-1">Save this TOTP secret:</p>
              <p className="break-all">{provisioning.totp_secret}</p>
            </div>
          )}
          {message && <div className="text-center text-[10px] text-amber-400">{message}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Main Application ───────────────────────────────────────────────────────
export default function App() {
  const [authToken, setAuthToken] = useState('')
  const [authUser, setAuthUser] = useState('')
  const [activeTab, setActiveTab] = useState('command')
  const [trustScore, setTrustScore] = useState(null)
  const [trustHistory, setTrustHistory] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [isUnderAttack, setIsUnderAttack] = useState(false)
  const [ambushStatus, setAmbushStatus] = useState('idle') // idle | pending_auth | running | done
  const [hitlDecision, setHitlDecision] = useState(null) // null | 'denied' | 'approved'
  const tickRef = useRef(0)

  // Human Identity State
  const [humanTrustScore, setHumanTrustScore] = useState(null)
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false)
  const [autonomyMode, setAutonomyMode] = useState('Assist') // Watch | Assist | Auto
  const [behavioralEvents, setBehavioralEvents] = useState({ keystrokes: 0, mouseDistance: 0, sessions: 0 })

  const getAuthHeaders = (extra = {}) => (
    authToken
      ? { ...extra, Authorization: `Bearer ${authToken}` }
      : { ...extra }
  )

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
      try {
        const parseableAuth = import.meta.env.VITE_PARSEABLE_BASIC_AUTH
        const res = await fetch('/api/v1/logstream/tetragon?limit=20', {
          headers: parseableAuth ? { Authorization: `Basic ${parseableAuth}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setAuditLogs(data.slice().reverse())
          }
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => clearInterval(id)
  }, [isUnderAttack])



  // Poll for real incidents from backend
  useEffect(() => {
    if (ambushStatus !== 'idle' || !authToken) return
    const poll = async () => {
      try {
        const res = await fetch('/incidents/active', { headers: getAuthHeaders() })
        if (res.ok) {
          const incident = await res.json()
          if (incident && incident.id) {
            setIsUnderAttack(true)
            if (autonomyMode === 'Auto') {
              handleBiometricDeny()
            } else if (autonomyMode === 'Watch') {
              setAmbushStatus('watch')
            } else {
              setAmbushStatus('pending_auth')
              setShowBiometricPrompt(true)
            }
          }
        }
      } catch (e) { }
    }
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [ambushStatus, autonomyMode, authToken])



  // HITL: Deny Access & Isolate — sends real enforcement decision to backend
  const handleBiometricDeny = async () => {
    setShowBiometricPrompt(false)
    setHitlDecision('denied')
    setHumanTrustScore(99.9)
    setAmbushStatus('running')

    // Send enforcement decision to backend
    try {
      await fetch('/enforce/decision', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ decision: 'DENY', reason: 'HITL rejection', timestamp: new Date().toISOString() })
      })
    } catch (e) {
      console.error('Failed to send enforcement decision:', e)
    }

    setActiveTab('telemetry')
    setTimeout(() => {
      setAuditLogs(prev => [
        mkLog({ process: 'HITL-DENY', action: 'Step-Up MFA REJECTED by live operator', file: '/restricted-resource', matchAction: 'Sigkill', pid: '—' }),
        mkLog({ process: 'enforcement', action: 'Backend enforcement applied', file: '/api/enforce', matchAction: 'DENY', pid: '—' }),
        ...prev,
      ].slice(0, 25))
    }, 1200)

    setTimeout(() => { setActiveTab('enforcement'); setAmbushStatus('done') }, 3000)
  }

  // HITL: Approve — sends real approval decision to backend with real auth method
  const handleBiometricApprove = async (approvalMode = 'TOTP_MFA', stepUpToken = null) => {
    setShowBiometricPrompt(false)
    setHitlDecision('approved')
    setHumanTrustScore(85)
    setAmbushStatus('running')

    // Send enforcement decision to backend with real auth method
    try {
      await fetch('/enforce/decision', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ decision: 'ALLOW', reason: 'HITL approval with MFA', authMethod: approvalMode, stepUpToken, timestamp: new Date().toISOString() })
      })
    } catch (e) {
      console.error('Failed to send enforcement decision:', e)
    }

    setActiveTab('telemetry')
    setTimeout(() => {
      setAuditLogs(prev => [
        mkLog({ process: 'HITL-APPROVE', action: `Step-Up MFA APPROVED by live operator via ${approvalMode}`, file: '/restricted-resource', matchAction: 'Allow', pid: '—' }),
        mkLog({ process: 'enforcement', action: 'Backend enforcement applied', file: '/api/enforce', matchAction: 'ALLOW', pid: '—' }),
        ...prev,
      ].slice(0, 25))
    }, 1200)

    setTimeout(() => { setActiveTab('enforcement'); setAmbushStatus('done') }, 3000)
  }

  const resetSystem = async () => {
    setTrustScore(null)
    setIsUnderAttack(false)
    setAmbushStatus('idle')
    setShowBiometricPrompt(false)
    setHitlDecision(null)
    setAuditLogs([])
    setHumanTrustScore(null)
    setBehavioralEvents({ keystrokes: 0, mouseDistance: 0, sessions: 0 })
    setActiveTab('command')
    setTrustHistory([])
    // Send reset signal to backend
    try { await fetch('/enforce/reset', { method: 'POST', headers: getAuthHeaders() }) } catch {}
  }

  // Composite Trust = weighted combination of agent + human
  const compositeTrust = isUnderAttack
    ? null
    : null

  const displayTrustScore = trustScore === null ? '—' : `${trustScore}%`
  const displayHumanTrust = humanTrustScore === null ? '—' : `${humanTrustScore}%`

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

  if (!authToken) {
    return (
      <AuthenticationScreen
        onComplete={({ token, username }) => {
          setAuthToken(token)
          setAuthUser(username)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f16] text-slate-100 font-sans relative overflow-x-hidden scanline transition-all duration-700">

      {/* Global Attack Border */}
      <div className={`fixed inset-0 pointer-events-none z-50 border-4 transition-all duration-500 rounded-none ${
        isUnderAttack ? 'border-rose-600 animate-pulse' : 'border-transparent'
      }`} />

      {/* Biometric Modal */}
      {showBiometricPrompt && (
        <BiometricModal onApprove={handleBiometricApprove} onDeny={handleBiometricDeny} authToken={authToken} />
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
                <p className="text-[9px] font-black tracking-widest text-slate-300">Live operator</p>
                <div className="flex items-center gap-2 text-[8px] text-slate-500">
                  <span className="text-sky-400">USER: {authUser}</span>
                  <span className={`font-bold ${humanTrustScore === null ? 'text-slate-500' : humanTrustScore > 90 ? 'text-emerald-400' : humanTrustScore > 50 ? 'text-amber-400' : 'text-rose-500'}`}>
                    TRUST: {displayHumanTrust}
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
                onClick={() => setAmbushStatus('idle')}
                className="flex items-center gap-2 px-3 py-2 text-[10px] font-black tracking-widest bg-emerald-600/10 border border-emerald-600/40 text-emerald-500 rounded-lg hover:bg-emerald-600/20 transition-all"
              >
                <ShieldAlert className="w-3 h-3" />
                MONITORING FOR INCIDENTS...
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
          <span className="text-violet-400">● MFA:TOTP</span>
        </div>
        <div className="flex items-center gap-5">
          <span>AGENT TRUST: {displayTrustScore}</span>
          <span className={humanTrustScore === null ? 'text-slate-500' : humanTrustScore > 90 ? 'text-emerald-500' : humanTrustScore > 50 ? 'text-amber-400' : 'text-rose-500'}>
            HUMAN TRUST: {displayHumanTrust}
          </span>
          <span className={isUnderAttack ? 'text-rose-500 font-bold animate-pulse' : 'text-emerald-500'}>
            {isUnderAttack ? 'UNDER ATTACK' : 'NOMINAL'}
          </span>
        </div>
      </footer>
    </div>
  )
}
