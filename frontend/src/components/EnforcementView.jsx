import { useState, useEffect } from 'react'
import { CheckCircle, Clock, Zap, Shield, AlertTriangle, User, ScanFace } from 'lucide-react'

const POLICIES = [
  { rule: 'deny file.read("/restricted-resource")', action: 'SIGKILL',     sev: 'CRITICAL', trigger: true },
  { rule: 'deny process.exec(uid=0) outside /usr/bin',  action: 'SIGKILL',     sev: 'HIGH',     trigger: false },
  { rule: 'deny net.connect(dst not in 443) from workload/*', action: 'DROP_PACKET', sev: 'HIGH',     trigger: false },
  { rule: 'deny file.write("/etc/*") from non-root',    action: 'SIGKILL',     sev: 'HIGH',     trigger: false },
  { rule: 'allow outbound 443/tcp from spiffe://aegis.did/*', action: 'ALLOW',  sev: null,       trigger: false },
  { rule: 'deny process.exec("curl") from workload/*',  action: 'SIGKILL',     sev: 'MEDIUM',   trigger: false },
]

const BASE_TIMELINE = [
  { t: 'T+0ms',  icon: Clock,         text: 'sys_openat("/restricted-resource") intercepted by eBPF kprobe',          category: 'detect' },
  { t: 'T+12ms', icon: Zap,           text: 'Tetragon emits structured JSON event to Parseable log stream',             category: 'detect' },
  { t: 'T+23ms', icon: Zap,           text: 'FastAPI ML engine receives event, generates 384-dim sentence embedding',   category: 'analyze' },
  { t: 'T+31ms', icon: AlertTriangle, text: 'Cosine similarity: 0.94 -> 0.09 (threshold 0.50) - DRIFT CONFIRMED',      category: 'analyze' },
  { t: 'T+38ms', icon: Shield,        text: 'OPA policy engine evaluates Rego ruleset - deny rule MATCHED',             category: 'enforce' },
  { t: 'T+45ms', icon: Shield,        text: 'OPA invokes Tetragon enforcement hook via gRPC channel',                   category: 'enforce' },
]

const HITL_DENIED_STEP = {
  t: 'T+52ms', icon: User,   text: 'HITL Step-Up MFA REJECTED by live operator -> Enforcement authorized', category: 'hitl',
}
const HITL_APPROVED_STEP = {
  t: 'T+52ms', icon: ScanFace, text: 'HITL Step-Up MFA APPROVED by live operator -> Override logged, monitoring elevated', category: 'hitl',
}

const FINAL_STEPS = [
  { t: 'T+61ms', icon: AlertTriangle, text: 'SIGKILL dispatched -> PID 4721 terminated immediately at kernel level',    category: 'kill' },
  { t: 'T+72ms', icon: CheckCircle,   text: 'SPIRE Server revokes SVID: spiffe://aegis.did/rogue-agent',               category: 'cleanup' },
  { t: 'T+90ms', icon: CheckCircle,   text: 'Cilium NetworkPolicy updated - pod egress blocked at mesh layer',         category: 'cleanup' },
]

function sevColor(sev) {
  if (!sev) return 'text-emerald-500 bg-emerald-500/10'
  if (sev === 'CRITICAL') return 'text-rose-500 bg-rose-500/20'
  if (sev === 'HIGH') return 'text-amber-500 bg-amber-500/15'
  return 'text-slate-400 bg-slate-800'
}

function stepColor(category, i) {
  if (category === 'hitl')    return { dot: 'bg-violet-500/20 text-violet-400', line: 'bg-violet-500/40', time: 'text-violet-400' }
  if (category === 'kill')    return { dot: 'bg-rose-500/20 text-rose-400',     line: 'bg-rose-500/40',   time: 'text-rose-500' }
  if (category === 'cleanup') return { dot: 'bg-rose-500/20 text-rose-400',     line: 'bg-rose-500/40',   time: 'text-rose-500' }
  return                             { dot: 'bg-emerald-500/20 text-emerald-400', line: 'bg-emerald-500/30', time: 'text-emerald-400' }
}

export default function EnforcementView({ isUnderAttack, hitlDecision }) {
  const [activeStep, setActiveStep] = useState(-1)
  const hasLiveIncident = isUnderAttack || hitlDecision !== null

  if (!hasLiveIncident) {
    return (
      <div className="glass rounded-xl p-8 border border-slate-700/30 text-center space-y-3">
        <p className="text-[9px] tracking-widest text-slate-500">LIVE ENFORCEMENT ONLY</p>
        <p className="text-sm text-slate-300">No active incident is present, so no policy timeline is rendered.</p>
        <p className="text-[10px] text-slate-500">Connect a real enforcement backend to populate policy and response events.</p>
      </div>
    )
  }

  // Build dynamic timeline based on HITL decision
  const timeline = [
    ...BASE_TIMELINE,
    ...(hitlDecision === 'denied' ? [HITL_DENIED_STEP] : hitlDecision === 'approved' ? [HITL_APPROVED_STEP] : []),
    ...FINAL_STEPS,
  ]

  useEffect(() => {
    if (!isUnderAttack) { setActiveStep(-1); return }
    timeline.forEach((_, i) => {
      setTimeout(() => setActiveStep(i), i * 650)
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
          { label: 'HITL AUTH MODE',       value: hitlDecision ? hitlDecision.toUpperCase() : 'STANDBY', color: hitlDecision === 'denied' ? 'text-rose-500' : hitlDecision === 'approved' ? 'text-amber-400' : 'text-violet-400' },
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
                        {triggered ? 'TRIGGERED' : 'ARMED'}
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
              <p className="text-[10px] text-slate-600 text-center">Connect a live incident feed<br />to activate timeline</p>
            </div>
          )}

          {isUnderAttack && (
            <div className="space-y-0">
              {timeline.map((step, i) => {
                const done = activeStep >= i
                const active = activeStep === i
                const colors = stepColor(step.category, i)
                const isHitl = step.category === 'hitl'
                return (
                  <div key={i} className={`flex items-start gap-3 transition-all duration-500 ${done ? 'opacity-100' : 'opacity-20'}`}>
                    {/* Connector */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        done ? colors.dot : 'bg-slate-800 text-slate-600'
                      } ${active ? 'animate-pulse' : ''} ${isHitl && done ? 'ring-2 ring-violet-500/50' : ''}`}>
                        <step.icon className="w-3 h-3" />
                      </div>
                      {i < timeline.length - 1 && (
                        <div className={`w-px h-5 ${done ? colors.line : 'bg-slate-800'} transition-all duration-500`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-3 min-w-0 ${isHitl ? 'bg-violet-500/5 -mx-1 px-2 rounded-lg border border-violet-500/15' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black tracking-widest ${colors.time} ${active ? 'animate-pulse' : ''}`}>
                          {step.t}
                        </span>
                        {isHitl && <span className="text-[7px] font-black tracking-widest px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">HUMAN-IN-THE-LOOP</span>}
                      </div>
                      <p className={`text-[9px] leading-relaxed mt-0.5 ${isHitl ? 'text-violet-300' : 'text-slate-400'}`}>{step.text}</p>
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
