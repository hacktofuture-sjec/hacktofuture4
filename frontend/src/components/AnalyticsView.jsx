import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const AreaTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-emerald-400 font-bold">{payload[0].value?.toFixed(1)}%</p>
    </div>
  )
}

function GaugeRing({ score, isUnderAttack }) {
  const r = 72, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = isUnderAttack ? '#f43f5e' : score > 70 ? '#34d399' : score > 40 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="absolute w-48 h-48 -rotate-90" viewBox="0 0 168 168">
          <circle cx="84" cy="84" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle cx="84" cy="84" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s' }}
          />
        </svg>
        <div className="text-center">
          <p className="text-5xl font-black" style={{ color }}>{(score / 100).toFixed(3)}</p>
          <p className="text-[10px] text-slate-500 mt-1">cos(θ)</p>
        </div>
      </div>
      <p className={`text-[10px] font-black tracking-widest ${isUnderAttack ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
        {isUnderAttack ? '⚠ INTENT DRIFT DETECTED' : '● NOMINAL BEHAVIOR'}
      </p>
    </div>
  )
}

export default function AnalyticsView({ trustScore, trustHistory, isUnderAttack }) {
  return (
    <div className="space-y-5 animate-slide-up">

      {/* Top Row: Model + Gauge + Formula */}
      <div className="grid grid-cols-3 gap-4">

        {/* Model Info */}
        <div className="glass rounded-xl p-6">
          <p className="text-[9px] tracking-widest text-slate-500 mb-4">ACTIVE ML MODEL</p>
          <p className="text-lg font-black text-white mb-0.5">all-MiniLM-L6-v2</p>
          <p className="text-[10px] text-slate-500 mb-5">sentence-transformers · HuggingFace</p>
          <div className="space-y-2 font-mono text-[10px]">
            {[
              ['Dimensions',  '384'],
              ['Max Tokens',  '256'],
              ['Inference',   '0.84ms'],
              ['Framework',   'PyTorch 2.x'],
              ['Quantization','FP32'],
              ['Batch Size',  '1 (online)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-500">{k}</span>
                <span className="text-emerald-400">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cosine Gauge */}
        <div className="glass rounded-xl p-6 flex flex-col items-center justify-center">
          <p className="text-[9px] tracking-widest text-slate-500 mb-4">COSINE SIMILARITY — LIVE</p>
          <GaugeRing score={trustScore} isUnderAttack={isUnderAttack} />
        </div>

        {/* Math Formula */}
        <div className="glass rounded-xl p-6">
          <p className="text-[9px] tracking-widest text-slate-500 mb-4">INTENT DRIFT FORMULA</p>
          <div className="bg-black/70 rounded-xl p-5 text-center space-y-5 font-mono">
            <div>
              <p className="text-slate-500 text-[10px] mb-3">Cosine Similarity</p>
              <div className="flex items-center justify-center gap-2 text-xl">
                <span className="text-white">cos(θ)&nbsp;=</span>
                <div className="inline-flex flex-col items-center">
                  <span className="text-emerald-400 border-b border-slate-500 pb-1 px-3">A · B</span>
                  <span className="text-sky-400 pt-1 px-3">‖A‖ · ‖B‖</span>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-left space-y-1.5 border-t border-slate-800 pt-4">
              <p><span className="text-emerald-400">A</span> = assigned intent vector (384-dim)</p>
              <p><span className="text-sky-400">B</span> = observed behavior vector (384-dim)</p>
              <p><span className="text-amber-400">θ &lt; 0.50</span> → intent drift → ENFORCEMENT</p>
              <p><span className="text-rose-400">Current: {(trustScore / 100).toFixed(3)}</span>
                {isUnderAttack ? <span className="text-rose-500 font-bold"> → DRIFT!</span> : <span className="text-emerald-500"> → SAFE</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Intent Drift Chart */}
      <div className="glass rounded-xl p-6">
        <p className="text-[9px] tracking-widest text-slate-500 mb-4">INTENT DRIFT ANALYSIS — ROLLING WINDOW</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trustHistory} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isUnderAttack ? '#f43f5e' : '#34d399'} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isUnderAttack ? '#f43f5e' : '#34d399'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
            <Tooltip content={<AreaTip />} />
            <ReferenceLine y={50} stroke="#f43f5e" strokeDasharray="6 3" label={{ value: 'DRIFT THRESHOLD', position: 'insideTopLeft', fill: '#f43f5e', fontSize: 9 }} />
            <Area type="monotone" dataKey="score" stroke={isUnderAttack ? '#f43f5e' : '#34d399'} fill="url(#aGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Vector Comparison */}
      <div className="glass rounded-xl p-6">
        <p className="text-[9px] tracking-widest text-slate-500 mb-5">EMBEDDING VECTOR SIMILARITY COMPARISON</p>
        <div className="space-y-5">
          {[
            { label: 'ASSIGNED INTENT VECTOR',  desc: '"Read permitted configuration files"', val: 0.94, color: 'bg-emerald-500' },
            { label: 'OBSERVED BEHAVIOR VECTOR', desc: isUnderAttack ? '"Access forbidden_secrets.txt"' : '"Read /etc/resolv.conf"', val: isUnderAttack ? 0.08 : 0.91, color: isUnderAttack ? 'bg-rose-500' : 'bg-sky-500' },
          ].map(v => (
            <div key={v.label}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="text-[9px] font-black tracking-widest text-slate-300">{v.label}</span>
                  <span className="ml-3 text-[9px] text-slate-600 font-mono">{v.desc}</span>
                </div>
                <span className={`text-sm font-black ${isUnderAttack && v.label.includes('OBSERVED') ? 'text-rose-500' : 'text-emerald-400'}`}>
                  {v.val.toFixed(3)}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${v.color}`} style={{ width: `${v.val * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
