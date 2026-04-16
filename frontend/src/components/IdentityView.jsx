import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'

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
        {rotating ? 'ROTATING SVID…' : 'AUTO-ROTATION ACTIVE'}
      </div>
    </div>
  )
}

export default function IdentityView({ isUnderAttack }) {
  const [ttl, setTtl] = useState(42)
  const [rotating, setRotating] = useState(false)

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

      {/* Top Row */}
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
              <p><span className="text-slate-500 w-28 inline-block">SPIFFE ID</span><span className="text-emerald-400">spiffe://aegis.did/sentinel/agent/01</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Trust Domain</span><span className="text-sky-400">aegis.did</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Key Type</span><span className="text-amber-400">EC P-256</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Serial</span><span className="text-slate-300">7A:3F:B2:91:C4:D8:E6:02</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Issuer</span><span className="text-slate-300">SPIRE Server v1.9.0</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Not Before</span><span className="text-slate-400">{new Date(Date.now() - (60 - ttl) * 1000).toISOString()}</span></p>
              <p><span className="text-slate-500 w-28 inline-block">Not After</span><span className="text-slate-400">{new Date(Date.now() + ttl * 1000).toISOString()}</span></p>
              <p>
                <span className="text-slate-500 w-28 inline-block">Status</span>
                <span className={isUnderAttack ? 'text-rose-500 font-bold' : 'text-emerald-400 font-bold'}>
                  {isUnderAttack ? '⚠  REVOKED' : '✓  VALID'}
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

      {/* mTLS Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'ACTIVE mTLS SESSIONS', value: '1,204', color: 'text-sky-400' },
          { label: 'TRUST BUNDLE (CA)',     value: '2.4 KB', color: 'text-emerald-400' },
          { label: 'ATTESTATION METHOD',    value: 'join_token', color: 'text-amber-400' },
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
