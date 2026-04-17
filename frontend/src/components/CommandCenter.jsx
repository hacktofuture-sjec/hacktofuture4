import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ChevronRight, Fingerprint, Activity, Zap, Lock, User, Shield, Link2, MousePointer2, Keyboard, Eye } from 'lucide-react'

const STAGES = [
  { id:'L1', label:'IDENTITY',     sub:'SPIRE / mTLS',       color:'sky',    icon: Fingerprint, detail:'X.509 SVID auto-rotation every 60s' },
  { id:'L2', label:'TELEMETRY',   sub:'Cilium Tetragon',    color:'violet',  icon: Activity,    detail:'48 active eBPF kprobe hooks' },
  { id:'L3', label:'ANALYTICS',   sub:'PyTorch / FastAPI',  color:'emerald', icon: Zap,         detail:'Cosine similarity intent drift' },
  { id:'L4', label:'ENFORCEMENT', sub:'OPA + SIGKILL',      color:'amber',   icon: Lock,        detail:'Autonomous policy enforcement' },
]

const C = {
  sky:    { bg:'bg-sky-500/10',    border:'border-sky-500/30',    text:'text-sky-400',    dot:'bg-sky-400' },
  violet: { bg:'bg-violet-500/10', border:'border-violet-500/30', text:'text-violet-400', dot:'bg-violet-400' },
  emerald:{ bg:'bg-emerald-500/10',border:'border-emerald-500/30',text:'text-emerald-400',dot:'bg-emerald-400' },
  amber:  { bg:'bg-amber-500/10',  border:'border-amber-500/30',  text:'text-amber-400',  dot:'bg-amber-400' },
}

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-emerald-400 font-bold">{payload[0].value?.toFixed(1)}%</p>
      <p className="text-slate-500">{payload[0].payload?.time}</p>
    </div>
  )
}

export default function CommandCenter({ trustScore, trustHistory, isUnderAttack, humanTrustScore, compositeTrust, behavioralEvents, autonomyMode }) {
  const hasLiveData = trustScore !== null || humanTrustScore !== null || compositeTrust !== null || trustHistory.length > 0

  if (!hasLiveData) {
    return (
      <div className="glass rounded-xl p-8 border border-slate-700/30 text-center space-y-3">
        <p className="text-[9px] tracking-widest text-slate-500">LIVE DATA ONLY MODE</p>
        <p className="text-sm text-slate-300">No authenticated identity, telemetry, or trust data is connected yet.</p>
        <p className="text-[10px] text-slate-500">Connect the real backend services to populate this dashboard.</p>
      </div>
    )
  }

  const displayTrustScore = trustScore === null ? '—' : `${trustScore}%`
  const displayHumanTrust = humanTrustScore === null ? '—' : `${humanTrustScore}%`
  const displayCompositeTrust = compositeTrust === null ? '—' : `${compositeTrust}%`

  const kpis = [
    { label:'AGENT TRUST',         value: displayTrustScore,       color: isUnderAttack ? 'text-rose-500' : 'text-emerald-400', sub: isUnderAttack ? 'CRITICAL DRIFT' : 'NOMINAL' },
    { label:'HUMAN TRUST',         value: displayHumanTrust,        color: humanTrustScore === null ? 'text-slate-500' : humanTrustScore > 90 ? 'text-violet-400' : humanTrustScore > 50 ? 'text-amber-400' : 'text-rose-500', sub: 'Behavioral Biometrics' },
    { label:'COMPOSITE TRUST',     value: displayCompositeTrust,   color: compositeTrust === null ? 'text-slate-500' : compositeTrust > 80 ? 'text-emerald-400' : compositeTrust > 40 ? 'text-amber-400' : 'text-rose-500', sub: 'f(agent, human) weighted' },
    { label:'POLICY VIOLATIONS',   value: isUnderAttack ? '1' : '0', color: isUnderAttack ? 'text-rose-500' : 'text-slate-500', sub: isUnderAttack ? 'SIGKILL FIRED' : 'All clear' },
  ]

  return (
    <div className="space-y-5 animate-slide-up">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="glass rounded-xl p-5">
            <p className="text-[9px] tracking-widest text-slate-500 mb-3">{k.label}</p>
            <p className={`text-4xl font-black ${k.color} transition-colors duration-700`}>{k.value}</p>
            <p className="text-[9px] text-slate-600 mt-2">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Composite Principal Binding Card */}
      <div className="glass rounded-xl p-6 border border-violet-500/20">
        <p className="text-[9px] tracking-widest text-slate-500 mb-5">COMPOSITE PRINCIPAL — SUBJECT-ACTOR TRUST BINDING</p>
        <div className="grid grid-cols-7 gap-3 items-center">

          {/* Human (Subject) */}
          <div className="col-span-2 bg-violet-500/5 rounded-xl border border-violet-500/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                <User className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-widest text-violet-400">SUBJECT (HUMAN)</p>
                <p className="text-[9px] text-slate-500">Live operator identity not loaded</p>
              </div>
            </div>
            <div className="space-y-1.5 text-[9px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Auth Method</span>
                <span className="text-violet-400">WebAuthn / FIDO2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">OIDC Token</span>
                <span className="text-emerald-400">VALID</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trust Score</span>
                <span className={`font-bold ${humanTrustScore === null ? 'text-slate-500' : humanTrustScore > 90 ? 'text-emerald-400' : 'text-rose-500'}`}>{displayHumanTrust}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Biometrics</span>
                <span className="text-violet-400 flex items-center gap-1">
                  <MousePointer2 className="w-2.5 h-2.5" />
                  <Keyboard className="w-2.5 h-2.5" />
                  ACTIVE
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Keystrokes</span>
                <span className="text-slate-300">{behavioralEvents.keystrokes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mouse Travel</span>
                <span className="text-slate-300">{(behavioralEvents.mouseDistance / 1000).toFixed(1)}k px</span>
              </div>
            </div>
          </div>

          {/* Binding Chain */}
          <div className="col-span-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-px bg-gradient-to-r from-violet-500/50 to-transparent" />
              <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[8px] font-black tracking-widest text-amber-400">OIDC-to-SPIFFE DELEGATION</span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-sky-500/50 to-transparent" />
            </div>

            {/* Trust Formula */}
            <div className="bg-black/50 rounded-xl border border-slate-700/30 px-5 py-3 text-center w-full">
              <p className="text-[8px] text-slate-500 tracking-widest mb-1.5">COMPOSITE TRUST FORMULA</p>
              <p className="text-xs font-mono">
                <span className="text-amber-400">T</span>
                <span className="text-slate-500">(composite)</span>
                <span className="text-white"> = </span>
                <span className="text-violet-400">0.5</span>
                <span className="text-slate-500"> * </span>
                <span className="text-violet-400">T</span>
                <span className="text-slate-600">(human)</span>
                <span className="text-white"> + </span>
                <span className="text-sky-400">0.5</span>
                <span className="text-slate-500"> * </span>
                <span className="text-sky-400">T</span>
                <span className="text-slate-600">(agent)</span>
              </p>
              <p className={`text-lg font-black mt-1 ${compositeTrust === null ? 'text-slate-500' : compositeTrust > 80 ? 'text-emerald-400' : compositeTrust > 40 ? 'text-amber-400' : 'text-rose-500'}`}>
                = {displayCompositeTrust}
              </p>
            </div>

            {/* Autonomy Level */}
            <div className="flex items-center gap-2 text-[8px]">
              <Eye className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500">Autonomy Level:</span>
              <span className={`font-black tracking-widest ${
                autonomyMode === 'Auto' ? 'text-emerald-400' : autonomyMode === 'Watch' ? 'text-amber-400' : 'text-sky-400'
              }`}>{autonomyMode.toUpperCase()}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">
                {autonomyMode === 'Watch' ? 'Agent observes, human decides' :
                 autonomyMode === 'Assist' ? 'Agent recommends, human approves' :
                 'Agent acts, human monitors'}
              </span>
            </div>
          </div>

          {/* Agent (Actor) */}
          <div className="col-span-2 bg-sky-500/5 rounded-xl border border-sky-500/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-widest text-sky-400">ACTOR (AGENT)</p>
                <p className="text-[9px] text-slate-500">Live workload not loaded</p>
              </div>
            </div>
            <div className="space-y-1.5 text-[9px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">SPIFFE ID</span>
                <span className="text-sky-400 text-[8px]">spiffe://aegis.did/.../01</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">mTLS</span>
                <span className="text-emerald-400">ESTABLISHED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trust Score</span>
                <span className={`font-bold ${trustScore === null ? 'text-slate-500' : trustScore > 80 ? 'text-emerald-400' : 'text-rose-500'}`}>{displayTrustScore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monitoring</span>
                <span className="text-sky-400">eBPF kprobes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">eBPF Events/s</span>
                <span className="text-slate-300">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SVID TTL</span>
                <span className="text-amber-400">Live rotation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="glass rounded-xl p-6">
        <p className="text-[9px] tracking-widest text-slate-500 mb-5">ZERO-TRUST SECURITY PIPELINE</p>
        <div className="flex items-start gap-2">
          {STAGES.map((s, i) => {
            const c = C[s.color]
            const hot = isUnderAttack && i >= 2
            return (
              <div key={s.id} className="flex items-start gap-2 flex-1">
                <div className={`flex-1 rounded-xl border p-4 transition-all duration-700 ${hot ? 'bg-rose-500/10 border-rose-500/40' : `${c.bg} ${c.border}`}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${hot ? 'bg-rose-400 animate-ping' : c.dot}`} />
                    <span className={`text-[9px] font-black tracking-widest ${hot ? 'text-rose-400' : c.text}`}>{s.id}: {s.label}</span>
                  </div>
                  <s.icon className={`w-4 h-4 mb-2 ${hot ? 'text-rose-500' : c.text}`} />
                  <p className={`text-xs font-bold ${hot ? 'text-rose-300' : 'text-white'}`}>{s.sub}</p>
                  <p className={`text-[9px] mt-1 ${hot ? 'text-rose-500/70' : 'text-slate-600'}`}>{s.detail}</p>
                </div>
                {i < 3 && (
                  <div className="pt-10">
                    <ChevronRight className={`w-5 h-5 ${isUnderAttack && i >= 1 ? 'text-rose-500 animate-pulse' : 'text-slate-700'}`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Trust Score Chart */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] tracking-widest text-slate-500">LIVE TRUST SCORE — ROLLING WINDOW</p>
          <div className={`flex items-center gap-2 text-[10px] font-bold ${isUnderAttack ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isUnderAttack ? 'bg-rose-500' : 'bg-emerald-400'}`} />
            {isUnderAttack ? 'CRITICAL — INTENT DRIFT' : 'NOMINAL'}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trustHistory} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
            <Tooltip content={<Tip />} />
            <ReferenceLine y={50} stroke="#f43f5e" strokeDasharray="6 3" label={{ value: 'THRESHOLD 50%', position: 'insideTopLeft', fill: '#f43f5e', fontSize: 9 }} />
            <Line type="monotone" dataKey="score" stroke={isUnderAttack ? '#f43f5e' : '#34d399'} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
