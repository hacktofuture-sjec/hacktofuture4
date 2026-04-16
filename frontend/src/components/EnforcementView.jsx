import { useState, useEffect } from 'react'
import { CheckCircle, Clock, Zap, Shield, AlertTriangle } from 'lucide-react'

const POLICIES = [
  { rule: 'deny file.read("/forbidden_secrets.txt")', action: 'SIGKILL',     sev: 'CRITICAL', trigger: true },
  { rule: 'deny process.exec(uid=0) outside /usr/bin',  action: 'SIGKILL',     sev: 'HIGH',     trigger: false },
  { rule: 'deny net.connect(dst ∉ 443) from workload/*', action: 'DROP_PACKET', sev: 'HIGH',     trigger: false },
  { rule: 'deny file.write("/etc/*") from non-root',    action: 'SIGKILL',     sev: 'HIGH',     trigger: false },
  { rule: 'allow outbound 443/tcp from spiffe://aegis.did/*', action: 'ALLOW',  sev: null,       trigger: false },
  { rule: 'deny process.exec("curl") from workload/*',  action: 'SIGKILL',     sev: 'MEDIUM',   trigger: false },
]

const TIMELINE = [
  { t: 'T+0ms',  icon: Clock,     text: 'sys_openat("/forbidden_secrets.txt") intercepted by eBPF kprobe' },
  { t: 'T+12ms', icon: Zap,       text: 'Tetragon emits structured JSON event → Parseable log stream ingestion' },
  { t: 'T+23ms', icon: Zap,       text: 'FastAPI ML engine receives event, generates 384-dim sentence embedding' },
  { t: 'T+31ms', icon: AlertTriangle, text: 'Cosine similarity: 0.94 → 0.09 (threshold 0.50) — DRIFT CONFIRMED' },
  { t: 'T+38ms', icon: Shield,    text: 'OPA policy engine evaluates Rego ruleset — deny rule MATCHED' },
  { t: 'T+45ms', icon: Shield,    text: 'OPA invokes Tetragon enforcement hook via gRPC channel' },
  { t: 'T+61ms', icon: AlertTriangle, text: 'SIGKILL dispatched → PID 4721 terminated immediately at kernel' },
  { t: 'T+72ms', icon: CheckCircle, text: 'SPIRE Server revokes SVID: spiffe://aegis.did/rogue-agent' },
  { t: 'T+90ms', icon: CheckCircle, text: 'Cilium NetworkPolicy updated — pod egress blocked at mesh layer' },
]

function sevColor(sev) {
  if (!sev) return 'text-emerald-500 bg-emerald-500/10'
  if (sev === 'CRITICAL') return 'text-rose-500 bg-rose-500/20'
  if (sev === 'HIGH') return 'text-amber-500 bg-amber-500/15'
  return 'text-slate-400 bg-slate-800'
}

export default function EnforcementView({ isUnderAttack }) {
  const [activeStep, setActiveStep] = useState(-1)

  useEffect(() => {
    if (!isUnderAttack) { setActiveStep(-1); return }
    TIMELINE.forEach((_, i) => {
      setTimeout(() => setActiveStep(i), i * 700)
    })
  }, [isUnderAttack])

  return (
    <div className="space-y-5 animate-slide-up">

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'ACTIVE POLICIES',     value: '24',          color: 'text-amber-400' },
          { label: 'POLICY ENGINE',        value: 'OPA v0.61',   color: 'text-violet-400' },
          { label: 'ENFORCEMENTS TODAY',   value: isUnderAttack ? '1' : '0', color: isUnderAttack ? 'text-rose-500' : 'text-slate-500' },
          { label: 'REGO RULES LOADED',    value: '24',          color: 'text-sky-400' },
        ].map(k => (
          <div key={k.label} className="glass rounded-xl p-5">
            <p className="text-[9px] tracking-widest text-slate-500 mb-3">{k.label}</p>
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-5">

        {/* Policy Table */}
        <div className="col-span-3 glass rounded-xl p-6">
          <p className="text-[9px] tracking-widest text-slate-500 mb-4">ACTIVE OPA POLICIES — REGO RULESET</p>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-700/50 text-[9px] text-slate-500 tracking-widest">
                <th className="text-left py-2 pr-6 font-medium">RULE</th>
                <th className="text-left py-2 pr-4 font-medium">ACTION</th>
                <th className="text-left py-2 pr-4 font-medium">SEV</th>
                <th className="text-left py-2 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {POLICIES.map((p, i) => {
                const triggered = isUnderAttack && p.trigger
                return (
                  <tr key={i} className={`border-b border-slate-800/40 transition-all duration-500 ${
                    triggered ? 'bg-rose-500/10' : 'hover:bg-slate-800/20'
                  }`}>
                    <td className="py-3 pr-6">
                      <span className={`${triggered ? 'text-rose-400 font-bold' : p.action === 'ALLOW' ? 'text-emerald-500' : 'text-amber-400'}`}>
                        {p.rule}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                        p.action === 'SIGKILL' ? 'bg-rose-500/20 text-rose-400' :
                        p.action === 'ALLOW' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>{p.action}</span>
                    </td>
                    <td className="py-3 pr-4">
                      {p.sev && <span className={`px-2 py-0.5 rounded text-[8px] font-black ${sevColor(p.sev)}`}>{p.sev}</span>}
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] font-bold ${triggered ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
                        {triggered ? '⚡ TRIGGERED' : 'ARMED'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Autonomous Response Timeline */}
        <div className="col-span-2 glass rounded-xl p-6">
          <p className="text-[9px] tracking-widest text-slate-500 mb-5">AUTONOMOUS RESPONSE TIMELINE</p>

          {!isUnderAttack && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Shield className="w-10 h-10 text-slate-700" />
              <p className="text-[10px] text-slate-600 text-center">Execute Red Team Ambush<br />to activate timeline</p>
            </div>
          )}

          {isUnderAttack && (
            <div className="space-y-0">
              {TIMELINE.map((step, i) => {
                const done = activeStep >= i
                const active = activeStep === i
                return (
                  <div key={i} className={`flex items-start gap-3 transition-all duration-500 ${done ? 'opacity-100' : 'opacity-20'}`}>
                    {/* Connector */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        done ? (i >= 6 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400') : 'bg-slate-800 text-slate-600'
                      } ${active ? 'animate-pulse' : ''}`}>
                        <step.icon className="w-3 h-3" />
                      </div>
                      {i < TIMELINE.length - 1 && (
                        <div className={`w-px h-5 ${done ? (i >= 6 ? 'bg-rose-500/40' : 'bg-emerald-500/30') : 'bg-slate-800'} transition-all duration-500`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-3 min-w-0">
                      <span className={`text-[9px] font-black tracking-widest ${
                        i >= 6 ? 'text-rose-500' : 'text-emerald-400'
                      } ${active ? 'animate-pulse' : ''}`}>
                        {step.t}
                      </span>
                      <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">{step.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
