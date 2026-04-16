import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ChevronRight, Fingerprint, Activity, Zap, Lock } from 'lucide-react'

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

export default function CommandCenter({ trustScore, trustHistory, isUnderAttack }) {
  const kpis = [
    { label:'TRUST SCORE',       value:`${trustScore}%`, color: isUnderAttack ? 'text-rose-500' : 'text-emerald-400', sub: isUnderAttack ? '↓ CRITICAL DRIFT' : '↑ NOMINAL' },
    { label:'ACTIVE SVIDs',      value:'2,847',          color:'text-sky-400',    sub:'60s TTL' },
    { label:'eBPF EVENTS/S',     value:'14.2k',          color:'text-violet-400', sub:'48 kprobes' },
    { label:'POLICY VIOLATIONS', value: isUnderAttack ? '1' : '0', color: isUnderAttack ? 'text-rose-500' : 'text-slate-500', sub: isUnderAttack ? '⚠ SIGKILL FIRED' : 'All clear' },
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
        <ResponsiveContainer width="100%" height={240}>
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
