import { useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const SYSCALLS = [
  { name: 'sys_read',   count: 4821, color: '#34d399' },
  { name: 'sys_write',  count: 3102, color: '#38bdf8' },
  { name: 'sys_openat', count: 2456, color: '#818cf8' },
  { name: 'sys_close',  count: 1890, color: '#a78bfa' },
  { name: 'sys_execve', count:  234, color: '#fb923c' },
  { name: 'sys_mmap',   count: 1102, color: '#f9a8d4' },
]

const BarTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{payload[0].payload.name}</p>
      <p className="text-emerald-400">{payload[0].value.toLocaleString()} calls</p>
    </div>
  )
}

export default function TelemetryView({ auditLogs, isUnderAttack }) {
  const termRef = useRef(null)

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = 0
  }, [auditLogs])

  const sigkillCount = auditLogs.filter(l => l.matchAction === 'Sigkill' || l.matchAction === 'SIGKILL').length

  return (
    <div className="space-y-5 animate-slide-up">

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'ACTIVE TRACEPOINTS', value: '48',                     color: 'text-violet-400' },
          { label: 'EVENTS/SECOND',      value: '14,211',                  color: 'text-sky-400' },
          { label: 'kPROBE HOOKS',       value: '23',                      color: 'text-emerald-400' },
          { label: 'SIGKILL EVENTS',     value: String(sigkillCount),       color: sigkillCount > 0 ? 'text-rose-500' : 'text-slate-500' },
        ].map(k => (
          <div key={k.label} className="glass rounded-xl p-5">
            <p className="text-[9px] tracking-widest text-slate-500 mb-3">{k.label}</p>
            <p className={`text-4xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Syscall Distribution */}
        <div className="col-span-2 glass rounded-xl p-6">
          <p className="text-[9px] tracking-widest text-slate-500 mb-5">SYSCALL DISTRIBUTION</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={SYSCALLS} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 9 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} width={76} />
              <Tooltip content={<BarTip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {SYSCALLS.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Live eBPF Terminal */}
        <div className="col-span-3 glass rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[9px] tracking-widest text-slate-500">LIVE eBPF EVENT STREAM — TETRAGON</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isUnderAttack ? 'bg-rose-500' : 'bg-emerald-400'}`} />
              <span className={`text-[9px] font-bold ${isUnderAttack ? 'text-rose-500' : 'text-emerald-400'}`}>
                {isUnderAttack ? 'BREACH' : 'STREAMING'}
              </span>
            </div>
          </div>

          <div ref={termRef} className="terminal flex-1 overflow-y-auto space-y-1.5 h-80">
            {auditLogs.length === 0 ? (
              <p className="text-slate-700 animate-pulse">Waiting for eBPF events…</p>
            ) : auditLogs.map((log, i) => {
              const isSigkill = log.matchAction === 'Sigkill' || log.matchAction === 'SIGKILL'
              return (
                <div key={i} className={`flex items-start gap-2 text-[10px] ${isSigkill ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                  <span className="text-slate-700 flex-shrink-0 w-20">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--'}
                  </span>
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black ${
                    isSigkill ? 'bg-rose-500/25 text-rose-400' : 'bg-emerald-500/10 text-emerald-600'
                  }`}>
                    {(log.matchAction || 'ALLOW').toUpperCase()}
                  </span>
                  <span className="text-slate-400">[{log.process || 'kernel'}]</span>
                  <span className={isSigkill ? 'text-rose-400' : 'text-amber-600/70'}>{log.action || 'sys_event'}</span>
                  <span className={`truncate ${isSigkill ? 'text-rose-300' : 'text-slate-600'}`}>{log.file || ''}</span>
                  {log.pid && <span className="flex-shrink-0 text-slate-700">pid={log.pid}</span>}
                </div>
              )
            })}
          </div>

          {/* eBPF Pipeline path */}
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <p className="text-[9px] tracking-widest text-slate-600 mb-2">PIPELINE</p>
            <div className="flex items-center gap-2 text-[9px] font-mono text-slate-600 flex-wrap">
              {['Kernel kprobe', '→', 'eBPF ring buffer', '→', 'Tetragon daemon', '→', 'Parseable', '→', 'FastAPI ML'].map((s, i) => (
                <span key={i} className={s === '→' ? 'text-slate-700' : 'text-slate-500'}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
