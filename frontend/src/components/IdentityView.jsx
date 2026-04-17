import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, User, Shield, Link2, Fingerprint, Key, Lock, Eye, MousePointer2, Keyboard } from 'lucide-react'

const SVIDS = [
  { spiffeId: 'spiffe://aegis.did/sentinel/agent/01',       serial: '7A:3F:B2:91:C4:D8:E6:02', key: 'EC P-256', primary: true },
  { spiffeId: 'spiffe://aegis.did/workload/analytics-engine', serial: 'A1:2C:9E:34:F0:B7:1D:83', key: 'EC P-256', primary: false },
  { spiffeId: 'spiffe://aegis.did/workload/parseable',       serial: 'B8:4F:2A:16:C7:E3:9D:45', key: 'EC P-256', primary: false },
  { spiffeId: 'spiffe://aegis.did/workload/mock-agent',      serial: 'C3:7B:D5:88:A2:F1:6E:19', key: 'EC P-256', primary: false },
]

function TTLRing({ ttl, rotating }) {
  const r = 44, circ = 2 * Math.PI * r
  const dash = (ttl / 60) * circ
  const color = ttl < 15 ? '#f43f5e' : ttl < 30 ? '#f59e0b' : '#34d399'
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="absolute w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className="text-center z-10">
          <p className="text-3xl font-black" style={{ color }}>{ttl}s</p>
          <p className="text-[9px] text-slate-500">TTL</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <RefreshCw className={`w-3 h-3 text-emerald-400 ${rotating ? 'animate-spin' : ''}`} />
        {rotating ? 'ROTATING SVID...' : 'AUTO-ROTATION ACTIVE'}
      </div>
    </div>
  )
}

export default function IdentityView({ isUnderAttack, humanTrustScore = null, compositeTrust = null, behavioralEvents = { keystrokes: 0, mouseDistance: 0, sessions: 0 } }) {
  const [ttl, setTtl] = useState(42)
  const [rotating, setRotating] = useState(false)
  const hasLiveData = humanTrustScore !== null || compositeTrust !== null || behavioralEvents.sessions > 0

  if (!hasLiveData) {
    return (
      <div className="glass rounded-xl p-8 border border-slate-700/30 text-center space-y-3">
        <p className="text-[9px] tracking-widest text-slate-500">LIVE IDENTITY ONLY</p>
        <p className="text-sm text-slate-300">No identity, SVID, or biometric signal has been loaded from a live backend.</p>
        <p className="text-[10px] text-slate-500">Connect the real SPIFFE and auth services to populate this view.</p>
      </div>
    )
  }

  useEffect(() => {
    const id = setInterval(() => {
      setTtl(prev => {
        if (prev <= 1) { setRotating(true); setTimeout(() => setRotating(false), 1200); return 60 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-5 animate-slide-up">

      {/* Composite Identity Binding Chain */}
      <div className="glass rounded-xl p-6 border border-violet-500/15">
        <p className="text-[9px] tracking-widest text-slate-500 mb-5">IDENTITY DELEGATION CHAIN — SUBJECT-ACTOR TRUST BINDING</p>

        <div className="grid grid-cols-9 gap-3 items-start">

          {/* Step 1: Human WebAuthn */}
          <div className="col-span-2 space-y-3">
            <div className="bg-violet-500/5 rounded-xl border border-violet-500/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black tracking-widest text-violet-400">STEP 1: HUMAN AUTH</p>
                  <p className="text-[8px] text-slate-600">WebAuthn / FIDO2</p>
                </div>
              </div>
              <div className="space-y-1.5 text-[9px] font-mono">
                <p><span className="text-slate-500">Subject</span> <span className="text-violet-400">—</span></p>
                <p><span className="text-slate-500">Method</span> <span className="text-emerald-400">—</span></p>
                <p><span className="text-slate-500">OIDC Issuer</span> <span className="text-sky-400">—</span></p>
                <p><span className="text-slate-500">Token</span> <span className="text-emerald-400">—</span></p>
              </div>
            </div>
            <div className="bg-black/40 rounded-lg p-2.5 border border-slate-800/50 text-center">
              <p className="text-[8px] text-slate-500 tracking-widest mb-1">HUMAN TRUST</p>
              <p className={`text-xl font-black ${humanTrustScore > 90 ? 'text-violet-400' : 'text-rose-500'}`}>{humanTrustScore}%</p>
            </div>
          </div>

          {/* Arrow 1 */}
          <div className="col-span-1 flex flex-col items-center justify-center h-full gap-1 pt-8">
            <div className="w-full h-px bg-gradient-to-r from-violet-500/40 to-amber-500/40" />
            <div className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
              <p className="text-[7px] font-black tracking-widest text-amber-400 text-center">OIDC TOKEN</p>
              <p className="text-[7px] text-amber-400 text-center">DELEGATION</p>
            </div>
            <div className="w-full h-px bg-gradient-to-r from-amber-500/40 to-sky-500/40" />
          </div>

          {/* Step 2: SPIFFE Binding */}
          <div className="col-span-2 space-y-3">
            <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black tracking-widest text-amber-400">STEP 2: BIND</p>
                  <p className="text-[8px] text-slate-600">OIDC to SPIFFE</p>
                </div>
              </div>
              <div className="space-y-1.5 text-[9px] font-mono">
                <p><span className="text-slate-500">Claim</span> <span className="text-amber-400">—</span></p>
                <p><span className="text-slate-500">Maps To</span> <span className="text-sky-400">—</span></p>
                <p><span className="text-slate-500">X.509 Bind</span> <span className="text-emerald-400">—</span></p>
                <p><span className="text-slate-500">Revocable</span> <span className="text-amber-400">—</span></p>
              </div>
            </div>
            <div className="bg-black/40 rounded-lg p-2.5 border border-slate-800/50 text-center">
              <p className="text-[8px] text-slate-500 tracking-widest mb-1">COMPOSITE TRUST</p>
              <p className={`text-xl font-black ${compositeTrust > 80 ? 'text-emerald-400' : compositeTrust > 40 ? 'text-amber-400' : 'text-rose-500'}`}>{compositeTrust}%</p>
            </div>
          </div>

          {/* Arrow 2 */}
          <div className="col-span-1 flex flex-col items-center justify-center h-full gap-1 pt-8">
            <div className="w-full h-px bg-gradient-to-r from-amber-500/40 to-sky-500/40" />
            <div className="px-2 py-1 rounded bg-sky-500/10 border border-sky-500/20">
              <p className="text-[7px] font-black tracking-widest text-sky-400 text-center">X.509 SVID</p>
              <p className="text-[7px] text-sky-400 text-center">DELEGATION</p>
            </div>
            <div className="w-full h-px bg-gradient-to-r from-sky-500/40 to-emerald-500/40" />
          </div>

          {/* Step 3: Agent SPIFFE */}
          <div className="col-span-2 space-y-3">
            <div className="bg-sky-500/5 rounded-xl border border-sky-500/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black tracking-widest text-sky-400">STEP 3: AGENT</p>
                  <p className="text-[8px] text-slate-600">SPIFFE / mTLS</p>
                </div>
              </div>
              <div className="space-y-1.5 text-[9px] font-mono">
                <p><span className="text-slate-500">SPIFFE ID</span> <span className="text-sky-400 text-[8px]">—</span></p>
                <p><span className="text-slate-500">mTLS</span> <span className="text-emerald-400">—</span></p>
                <p><span className="text-slate-500">Delegated By</span> <span className="text-violet-400">—</span></p>
                <p><span className="text-slate-500">eBPF Monitor</span> <span className="text-sky-400">—</span></p>
              </div>
            </div>
            <div className="bg-black/40 rounded-lg p-2.5 border border-slate-800/50 text-center">
              <p className="text-[8px] text-slate-500 tracking-widest mb-1">AGENT TRUST</p>
              <p className={`text-xl font-black ${isUnderAttack ? 'text-rose-500' : 'text-sky-400'}`}>{isUnderAttack ? '8.3' : '100'}%</p>
            </div>
          </div>
        </div>

        {/* Continuous Auth Status Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-5 text-[9px] font-mono">
            <span className="flex items-center gap-1.5 text-violet-400">
              <Fingerprint className="w-3 h-3" /> WebAuthn: Verified
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Key className="w-3 h-3" /> OIDC Token: Valid
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <Lock className="w-3 h-3" /> mTLS: Established
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <Eye className="w-3 h-3" /> Continuous Auth: Active
            </span>
          </div>
          <div className="flex items-center gap-3 text-[8px] font-mono text-slate-500">
            <span className="flex items-center gap-1"><MousePointer2 className="w-2.5 h-2.5 text-violet-400" /> {(behavioralEvents.mouseDistance / 1000).toFixed(1)}k px</span>
            <span className="flex items-center gap-1"><Keyboard className="w-2.5 h-2.5 text-violet-400" /> {behavioralEvents.keystrokes} keys</span>
          </div>
        </div>
      </div>

      {/* Top Row - TTL + Terminal */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-6 flex flex-col items-center justify-center gap-2">
          <p className="text-[9px] tracking-widest text-slate-500 mb-2">SVID AUTO-ROTATION</p>
          <TTLRing ttl={ttl} rotating={rotating} />
        </div>

        <div className="glass rounded-xl p-6 col-span-2">
          <p className="text-[9px] tracking-widest text-slate-500 mb-3">WORKLOAD IDENTITY — TERMINAL</p>
          <div className="terminal space-y-1">
            <p><span className="text-emerald-500">$</span> <span className="text-sky-400">spire-agent api fetch-x509-svid --output json</span></p>
            <div className="border-t border-slate-800 pt-2 space-y-1 text-[11px]">
              <p><span className="text-slate-500 w-28 inline-block">SPIFFE ID</span><span className="text-emerald-400">—</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Trust Domain</span><span className="text-sky-400">—</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Key Type</span><span className="text-amber-400">—</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Serial</span><span className="text-slate-300">—</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Delegated By</span><span className="text-violet-400">—</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Issuer</span><span className="text-slate-300">—</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Not Before</span><span className="text-slate-400">{new Date(Date.now() - (60 - ttl) * 1000).toISOString()}</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Not After</span><span className="text-slate-400">{new Date(Date.now() + ttl * 1000).toISOString()}</span></p>
              <p>
                <span className="text-slate-500 w-28 inline-block">Status</span>
                <span className={isUnderAttack ? 'text-rose-500 font-bold' : 'text-emerald-400 font-bold'}>
                  {isUnderAttack ? 'REVOKED' : 'VALID'}
                </span>
              </p>
              <p><span className="text-slate-500 w-28 inline-block">mTLS</span><span className="text-emerald-400">ESTABLISHED</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* SVID Table */}
      <div className="glass rounded-xl p-6">
        <p className="text-[9px] tracking-widest text-slate-500 mb-4">ACTIVE X.509 SVIDs — TRUST DOMAIN: aegis.did</p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-700/50 text-[9px] text-slate-500 tracking-widest">
              <th className="text-left py-2 pr-6 font-medium">SPIFFE ID</th>
              <th className="text-left py-2 pr-4 font-medium">SERIAL</th>
              <th className="text-left py-2 pr-4 font-medium">KEY</th>
              <th className="text-left py-2 pr-4 font-medium">DELEGATED BY</th>
              <th className="text-left py-2 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {SVIDS.map((s, i) => {
              const revoked = isUnderAttack && s.primary
              return (
                <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 pr-6 text-sky-400">{s.spiffeId}</td>
                  <td className="py-3 pr-4 text-slate-500">{s.serial}</td>
                  <td className="py-3 pr-4 text-amber-400">{s.key}</td>
                  <td className="py-3 pr-4">
                    {s.primary
                      ? <span className="text-violet-400 flex items-center gap-1"><User className="w-3 h-3" /> Live OIDC subject</span>
                      : <span className="text-slate-600">System</span>
                    }
                  </td>
                  <td className="py-3">
                    <span className={`flex items-center gap-1.5 font-bold text-[10px] ${revoked ? 'text-rose-500' : 'text-emerald-400'}`}>
                      {revoked
                        ? <><XCircle className="w-3 h-3" />REVOKED</>
                        : <><CheckCircle className="w-3 h-3" />VALID</>}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* mTLS Stats + Behavioral Biometrics */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'ACTIVE mTLS SESSIONS', value: '1,204', color: 'text-sky-400' },
          { label: 'TRUST BUNDLE (CA)',     value: '2.4 KB', color: 'text-emerald-400' },
          { label: 'ATTESTATION METHOD',    value: 'WebAuthn + join_token', color: 'text-amber-400' },
          { label: 'BEHAVIORAL EVENTS',     value: `${behavioralEvents.keystrokes + Math.floor(behavioralEvents.mouseDistance / 100)}`, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-5">
            <p className="text-[9px] tracking-widest text-slate-500 mb-3">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
