import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Activity, Fingerprint, Lock, Zap, Terminal, Server,
  AlertTriangle, ChevronRight, Eye, Radio, Database, Cpu, Globe,
  Network, FileWarning, ShieldAlert, ShieldCheck, Clock, Hash,
  TrendingDown, TrendingUp, Layers, Binary, BarChart3, Workflow
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell, PieChart, Pie
} from 'recharts';

// ─── UTILITY COMPONENTS ────────────────────────────────────────────────

const StatusDot = ({ color = 'cyan', pulse = true }) => (
  <span className={`inline-block w-2 h-2 rounded-full bg-${color}-400 ${pulse ? 'animate-live-pulse' : ''}`} />
);

const Card = ({ children, className = '', delay = 0, glow = '' }) => (
  <div
    className={`bg-[#111620]/85 backdrop-blur-xl border border-sky-500/[0.12] rounded-2xl p-5 animate-slide-up ${glow} ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {children}
  </div>
);

const MiniSparkline = ({ color = '#22d3ee' }) => {
  const points = Array.from({ length: 12 }, (_, i) => 10 + Math.random() * 20);
  const max = Math.max(...points);
  const path = points.map((p, i) => `${i * (60/11)},${30 - (p/max)*25}`).join(' L ');
  return <svg width="60" height="30" className="opacity-40 mt-2"><polyline points={path} fill="none" stroke={color} strokeWidth="1.5" /></svg>;
};

const KPI = ({ label, value, unit, icon: Icon, color = 'cyan', delay = 0, sparkColor }) => (
  <Card delay={delay}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-2">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black text-${color}-400 animate-count`}>{value}</span>
          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
        <MiniSparkline color={sparkColor || '#22d3ee'} />
      </div>
      <div className={`p-2.5 rounded-xl bg-${color}-500/10 text-${color}-400`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </Card>
);

const SectionHeader = ({ icon: Icon, title, subtitle, color = 'cyan' }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-400`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  </div>
);

const Toast = ({ message, type = 'info', visible }) => {
  if (!visible) return null;
  const colors = { info: 'bg-sky-500/15 border-sky-500/30 text-sky-400', danger: 'bg-red-500/15 border-red-500/30 text-red-400', success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', warn: 'bg-amber-500/15 border-amber-500/30 text-amber-400' };
  return (
    <div className={`fixed top-20 right-8 z-[70] px-5 py-3 rounded-xl border backdrop-blur-xl text-sm font-medium animate-slide-up ${colors[type]}`}>
      {message}
    </div>
  );
};

const useLiveClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return time;
};

// ─── SIMULATED DATA GENERATORS ──────────────────────────────────────────

const generateTrustHistory = (isAttack) => {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => {
    const t = now - (29 - i) * 2000;
    let score;
    if (isAttack && i > 22) {
      score = Math.max(5, 100 - (i - 22) * 12 + Math.random() * 5);
    } else {
      score = 92 + Math.random() * 8;
    }
    return {
      time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      score: parseFloat(score.toFixed(1)),
      threshold: 50
    };
  });
};

const generateSyscalls = () => [
  { name: 'sys_read', count: 4821, pct: 35 },
  { name: 'sys_write', count: 3102, pct: 22 },
  { name: 'sys_open', count: 2450, pct: 18 },
  { name: 'sys_close', count: 1890, pct: 14 },
  { name: 'sys_mmap', count: 980, pct: 7 },
  { name: 'sys_connect', count: 560, pct: 4 },
];

const generateRadarData = (isAttack) => [
  { metric: 'File Access', A: isAttack ? 95 : 30 },
  { metric: 'Network I/O', A: isAttack ? 70 : 45 },
  { metric: 'Process Fork', A: isAttack ? 40 : 20 },
  { metric: 'Memory Alloc', A: isAttack ? 60 : 35 },
  { metric: 'Privilege Esc', A: isAttack ? 85 : 5 },
  { metric: 'Crypto Ops', A: isAttack ? 30 : 55 },
];

const generatePolicyRules = (isAttack) => [
  { id: 'POL-001', rule: 'deny file.read("/etc/shadow")', status: 'ENFORCED', hits: 12 },
  { id: 'POL-002', rule: 'deny file.read("/forbidden_secrets.txt")', status: isAttack ? 'TRIGGERED' : 'ARMED', hits: isAttack ? 1 : 0 },
  { id: 'POL-003', rule: 'allow net.connect(443)', status: 'PASS', hits: 847 },
  { id: 'POL-004', rule: 'deny process.exec("curl")', status: 'ENFORCED', hits: 3 },
  { id: 'POL-005', rule: 'allow spiffe.verify(agent/*)', status: 'PASS', hits: 1204 },
  { id: 'POL-006', rule: 'deny net.connect(0.0.0.0/0:22)', status: 'ENFORCED', hits: 56 },
];

const generateCertTimeline = () => [
  { time: '23:42:01', event: 'X.509 SVID issued', ttl: '60s', status: 'ok' },
  { time: '23:41:01', event: 'Certificate rotated', ttl: '60s', status: 'ok' },
  { time: '23:40:01', event: 'mTLS handshake verified', ttl: '58s', status: 'ok' },
  { time: '23:39:02', event: 'Workload API attestation', ttl: '60s', status: 'ok' },
  { time: '23:38:01', event: 'Trust bundle refresh', ttl: '60s', status: 'ok' },
  { time: '23:37:00', event: 'Node attestation complete', ttl: '60s', status: 'ok' },
];

const generateNetworkFlows = () => Array.from({ length: 20 }, (_, i) => ({
  time: new Date(Date.now() - i * 3000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  ingress: Math.floor(Math.random() * 400 + 200),
  egress: Math.floor(Math.random() * 300 + 100),
})).reverse();

// ─── SCREEN COMPONENTS ──────────────────────────────────────────────────

function OverviewScreen({ trustScore, isAttack, logs, ambushPhase }) {
  const trustHistory = generateTrustHistory(isAttack);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Trust Score" value={trustScore} unit="%" icon={Shield} color={isAttack ? 'red' : 'emerald'} delay={0} sparkColor={isAttack ? '#ef4444' : '#34d399'} />
        <KPI label="Active Identities" value="2,847" icon={Fingerprint} color="sky" delay={80} sparkColor="#38bdf8" />
        <KPI label="eBPF Traces/s" value="12.4k" icon={Activity} color="purple" delay={160} sparkColor="#a855f7" />
        <KPI label="Policy Decisions" value="1,204" icon={Lock} color="amber" delay={240} sparkColor="#f59e0b" />
      </div>

      {/* Zero-Trust Architecture Pipeline */}
      <Card delay={280} glow="glow-cyan">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Workflow className="w-4 h-4 text-sky-400" /> Zero-Trust Security Pipeline</h3>
        <p className="text-xs text-slate-500 mb-5">Data flows left-to-right through 4 autonomous layers. Each layer independently evaluates and can terminate a request.</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { label: 'L1: IDENTITY', tech: 'SPIRE / mTLS', desc: 'Issues X.509 SVIDs to prove workload identity', color: 'sky', icon: Fingerprint, active: true },
            { label: 'L2: TELEMETRY', tech: 'Cilium Tetragon', desc: 'Hooks kernel syscalls via eBPF ring buffers', color: 'purple', icon: Activity, active: true },
            { label: 'L3: ANALYTICS', tech: 'PyTorch / FastAPI', desc: 'Computes cosine similarity on sentence embeddings', color: 'emerald', icon: Zap, active: isAttack },
            { label: 'L4: ENFORCEMENT', tech: 'OPA + SIGKILL', desc: 'Evaluates Rego policies & executes autonomous response', color: 'amber', icon: Lock, active: isAttack },
          ].map((layer, i) => (
            <React.Fragment key={i}>
              <div className={`flex-1 min-w-[160px] p-4 rounded-xl border transition-all duration-500 ${isAttack && layer.active && i >= 2 ? `bg-red-500/5 border-red-500/30` : `bg-${layer.color}-500/5 border-${layer.color}-500/15`}`}>
                <div className="flex items-center gap-2 mb-2">
                  <layer.icon className={`w-4 h-4 text-${layer.color}-400`} />
                  <span className={`text-[10px] font-bold tracking-widest text-${layer.color}-400`}>{layer.label}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">{layer.tech}</p>
                <p className="text-[10px] text-slate-600 mt-1">{layer.desc}</p>
              </div>
              {i < 3 && <ChevronRight className={`w-5 h-5 flex-shrink-0 ${isAttack ? 'text-red-500 animate-pulse' : 'text-slate-700'}`} />}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trust Score Chart */}
        <Card className="lg:col-span-2" delay={300}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Real-Time Trust Score
            </h3>
            <div className="flex items-center gap-2">
              <StatusDot color={isAttack ? 'red' : 'emerald'} />
              <span className="text-xs text-slate-500">LIVE</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trustHistory}>
              <defs>
                <linearGradient id="trustGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isAttack ? '#ef4444' : '#34d399'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isAttack ? '#ef4444' : '#34d399'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="threshold" stroke="#f59e0b" strokeWidth={1} strokeDasharray="6 3" dot={false} />
              <Area type="monotone" dataKey="score" stroke={isAttack ? '#ef4444' : '#34d399'} strokeWidth={2} fill="url(#trustGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Behavioral Radar */}
        <Card delay={380}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" /> Behavioral Profile
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={generateRadarData(isAttack)} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar name="Agent" dataKey="A" stroke={isAttack ? '#ef4444' : '#22d3ee'} fill={isAttack ? '#ef4444' : '#22d3ee'} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Live Event Feed */}
      <Card delay={450}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400" /> Global Event Stream
          </h3>
          <span className="text-[10px] tracking-widest text-slate-500">{logs.length} EVENTS CAPTURED</span>
        </div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-600 italic py-4 text-center">Awaiting telemetry stream...</p>
          ) : logs.map(l => (
            <div key={l.id} className={`flex items-center gap-3 p-3 rounded-lg text-xs font-mono transition-all ${l.isSigkill ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'}`}>
              <span className="text-slate-600 w-20 flex-shrink-0">{l.time}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${l.isSigkill ? 'bg-red-500/20 text-red-400' : 'bg-sky-500/10 text-sky-400'}`}>
                {l.isSigkill ? 'THREAT' : 'INFO'}
              </span>
              <span className="truncate">{l.action}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function IdentityScreen({ isAttack }) {
  const certs = generateCertTimeline();
  const pieData = [
    { name: 'Verified', value: 2847, color: '#34d399' },
    { name: 'Pending', value: 42, color: '#f59e0b' },
    { name: 'Revoked', value: isAttack ? 1 : 0, color: '#ef4444' },
  ];
  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader icon={Fingerprint} title="Identity Layer — SPIRE" subtitle="X.509 SVID Management & mTLS Attestation" color="sky" />
      <Card delay={50}>
        <p className="text-xs text-slate-400 leading-relaxed"><span className="text-sky-400 font-bold">How it works:</span> SPIRE (the SPIFFE Runtime Environment) issues short-lived X.509 certificates (SVIDs) to every workload. Unlike static API keys, these certificates auto-rotate every 60 seconds, making stolen credentials useless. Each agent proves its identity through hardware-backed node attestation before receiving any certificate.</p>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Active SVIDs" value="2,847" icon={Fingerprint} color="sky" delay={0} />
        <KPI label="Certificate TTL" value="42" unit="s" icon={Clock} color="amber" delay={80} />
        <KPI label="Trust Domains" value="3" icon={Globe} color="purple" delay={160} />
        <KPI label="mTLS Sessions" value="1,204" icon={Lock} color="emerald" delay={240} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Certificate Lifecycle */}
        <Card className="lg:col-span-2" delay={300}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-400" /> Certificate Lifecycle Events
          </h3>
          <div className="space-y-3">
            {certs.map((c, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-mono text-slate-500 w-20">{c.time}</span>
                <span className="text-sm text-slate-300 flex-1">{c.event}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">TTL {c.ttl}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Identity Distribution */}
        <Card delay={380}>
          <h3 className="text-sm font-bold text-white mb-4">Identity Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Current SVID */}
      <Card delay={450} glow="glow-cyan">
        <h3 className="text-sm font-bold text-white mb-3">Active Workload Identity</h3>
        <div className="bg-black/40 rounded-xl p-4 font-mono text-xs space-y-1.5">
          <p><span className="text-sky-500">SPIFFE ID:</span> <span className="text-emerald-400">spiffe://aegis.did/sentinel/agent/01</span></p>
          <p><span className="text-sky-500">Trust Domain:</span> aegis.did</p>
          <p><span className="text-sky-500">Issuer:</span> SPIRE Server (Node Attestation: join_token)</p>
          <p><span className="text-sky-500">Serial:</span> 7A:3F:B2:91:C4:D8:E6:02</p>
          <p><span className="text-sky-500">Not After:</span> {new Date(Date.now() + 42000).toISOString()}</p>
          <p><span className="text-sky-500">Key Type:</span> EC P-256</p>
        </div>
      </Card>
    </div>
  );
}

function TelemetryScreen({ isAttack, logs }) {
  const syscalls = generateSyscalls();
  const networkFlows = generateNetworkFlows();

  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader icon={Activity} title="Telemetry Layer — eBPF / Tetragon" subtitle="Kernel-Level Syscall Interception & Network Tracing" color="purple" />
      <Card delay={50}>
        <p className="text-xs text-slate-400 leading-relaxed"><span className="text-purple-400 font-bold">How it works:</span> Cilium Tetragon attaches eBPF programs directly to Linux kernel functions (kprobes, tracepoints). Unlike userspace monitoring, eBPF runs inside the kernel itself — meaning no process can hide from it, tamper with it, or outrun it. Every file open, network connection, and process execution is captured at the syscall level with nanosecond precision.</p>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Tracepoints" value="48" icon={Cpu} color="purple" delay={0} />
        <KPI label="Syscalls/sec" value="12,411" icon={Activity} color="sky" delay={80} />
        <KPI label="Network Flows" value="3.2k" icon={Network} color="emerald" delay={160} />
        <KPI label="Alerts" value={isAttack ? '1' : '0'} icon={AlertTriangle} color={isAttack ? 'red' : 'emerald'} delay={240} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Syscall Breakdown */}
        <Card delay={300}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" /> Syscall Distribution
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={syscalls} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
              <Bar dataKey="count" fill="#a855f7" radius={[0, 6, 6, 0]} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Network Flow */}
        <Card delay={380}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-400" /> Network I/O (bytes/s)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={networkFlows}>
              <defs>
                <linearGradient id="ingressGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="egressGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
              <Area type="monotone" dataKey="ingress" stroke="#22d3ee" fill="url(#ingressGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="egress" stroke="#a855f7" fill="url(#egressGrad)" strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Live Kernel Log Terminal */}
      <Card delay={450} glow={isAttack ? 'glow-red' : 'glow-purple'}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" /> Kernel Event Stream
          </h3>
          <div className="flex items-center gap-2">
            <StatusDot color={isAttack ? 'red' : 'emerald'} />
            <span className="text-[10px] text-slate-500 tracking-widest">TETRAGON</span>
          </div>
        </div>
        <div className="bg-black/60 rounded-xl p-4 font-mono text-xs space-y-1.5 max-h-[200px] overflow-y-auto">
          {logs.length === 0 ? (
            <>
              <p className="text-cyan-700">[kernel] eBPF progs loaded: kprobe/sys_enter_openat, tracepoint/sched_process_exec</p>
              <p className="text-cyan-700">[kernel] Ring buffer attached, awaiting events...</p>
              <p className="text-slate-600 animate-pulse">_</p>
            </>
          ) : logs.map(l => (
            <p key={l.id} className={l.isSigkill ? 'text-red-400 font-bold' : 'text-cyan-600'}>
              [{l.time}] {l.isSigkill ? '⚠ CRITICAL: ' : ''}{l.action}
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AnalyticsScreen({ trustScore, isAttack }) {
  const trustHistory = generateTrustHistory(isAttack);
  const embeddingData = Array.from({ length: 20 }, (_, i) => ({
    dim: `D${i}`,
    assigned: parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)),
    observed: parseFloat((isAttack ? Math.random() * 0.9 : Math.random() * 0.8 + 0.1).toFixed(2)),
  }));

  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader icon={Zap} title="Analytics Layer — PyTorch ML Engine" subtitle="Semantic Embedding & Cosine Similarity Trust Inference" color="emerald" />
      <Card delay={50} glow="glow-green">
        <p className="text-xs text-slate-400 leading-relaxed"><span className="text-emerald-400 font-bold">How it works:</span> The FastAPI engine takes two inputs — the agent's <span className="text-white">assigned intent</span> (e.g., "summarize documents") and its <span className="text-white">observed action</span> (e.g., "read /forbidden_secrets.txt"). Both are encoded into 384-dimensional vectors using the <span className="text-sky-400 font-mono">all-MiniLM-L6-v2</span> sentence transformer. The cosine similarity between these vectors produces the Trust Score. A score below 0.5 means the agent's behavior has drifted from its mandate — triggering enforcement.</p>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Trust Score" value={trustScore} unit="%" icon={Shield} color={isAttack ? 'red' : 'emerald'} delay={0} />
        <KPI label="Cosine Sim" value={(trustScore / 100).toFixed(3)} icon={Hash} color="sky" delay={80} />
        <KPI label="Inference Latency" value="0.84" unit="ms" icon={Zap} color="purple" delay={160} />
        <KPI label="Drift Detected" value={isAttack ? 'YES' : 'NO'} icon={isAttack ? TrendingDown : TrendingUp} color={isAttack ? 'red' : 'emerald'} delay={240} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trust History */}
        <Card delay={300} glow={isAttack ? 'glow-red' : 'glow-green'}>
          <h3 className="text-sm font-bold text-white mb-4">Trust Score Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trustHistory}>
              <defs>
                <linearGradient id="trustGradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isAttack ? '#ef4444' : '#34d399'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isAttack ? '#ef4444' : '#34d399'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
              <Line type="monotone" dataKey="threshold" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="Threshold" />
              <Area type="monotone" dataKey="score" stroke={isAttack ? '#ef4444' : '#34d399'} fill="url(#trustGradA)" strokeWidth={2.5} dot={false} name="Trust" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Embedding Comparison */}
        <Card delay={380}>
          <h3 className="text-sm font-bold text-white mb-4">Embedding Vector Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={embeddingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="dim" tick={{ fill: '#475569', fontSize: 8 }} />
              <YAxis domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} />
              <Bar dataKey="assigned" fill="#22d3ee" radius={[2, 2, 0, 0]} name="Assigned Intent" />
              <Bar dataKey="observed" fill={isAttack ? '#ef4444' : '#a855f7'} radius={[2, 2, 0, 0]} name="Observed Action" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Model Info */}
      <Card delay={450} glow="glow-cyan">
        <h3 className="text-sm font-bold text-white mb-3">Model Pipeline</h3>
        <div className="bg-black/40 rounded-xl p-4 font-mono text-xs space-y-1.5">
          <p><span className="text-emerald-400">Model:</span> sentence-transformers/all-MiniLM-L6-v2</p>
          <p><span className="text-emerald-400">Embedding Dims:</span> 384 (float32)</p>
          <p><span className="text-emerald-400">Task:</span> Semantic Similarity (Cosine Distance)</p>
          <p><span className="text-emerald-400">Assigned Intent:</span> "summarize internal project documents"</p>
          <p><span className="text-emerald-400">Observed Action:</span> <span className={isAttack ? 'text-red-400 font-bold' : 'text-slate-400'}>{isAttack ? '"read /app/forbidden_secrets.txt"' : '"read /app/project_docs.txt"'}</span></p>
          <p><span className="text-emerald-400">Cosine Similarity:</span> <span className={isAttack ? 'text-red-400 font-bold' : 'text-white'}>{(trustScore / 100).toFixed(4)}</span></p>
          <p><span className="text-emerald-400">Verdict:</span> <span className={isAttack ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400'}>{isAttack ? '⚠ INTENT DRIFT — ENFORCEMENT REQUIRED' : '✓ BEHAVIOR WITHIN EXPECTED BOUNDS'}</span></p>
        </div>
      </Card>

      {/* Cosine Similarity Formula */}
      <Card delay={500}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Hash className="w-4 h-4 text-sky-400" /> Trust Score Computation</h3>
        <div className="bg-black/40 rounded-xl p-5 text-center">
          <p className="text-lg font-mono text-sky-300 mb-3">cos(θ) = (A · B) / (‖A‖ × ‖B‖)</p>
          <p className="text-xs text-slate-500">Where A = embed("assigned intent"), B = embed("observed action"), each ∈ ℝ³⁸⁴</p>
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center"><p className="text-[10px] text-slate-500">THRESHOLD</p><p className="text-lg font-bold text-amber-400">0.500</p></div>
            <div className="text-center"><p className="text-[10px] text-slate-500">CURRENT</p><p className={`text-lg font-bold ${isAttack ? 'text-red-400' : 'text-emerald-400'}`}>{(trustScore / 100).toFixed(3)}</p></div>
            <div className="text-center"><p className="text-[10px] text-slate-500">RESULT</p><p className={`text-lg font-bold ${isAttack ? 'text-red-400' : 'text-emerald-400'}`}>{isAttack ? 'DRIFT' : 'PASS'}</p></div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EnforcementScreen({ isAttack, trustScore }) {
  const rules = generatePolicyRules(isAttack);
  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader icon={Lock} title="Enforcement Layer — OPA / Tetragon" subtitle="Dynamic Policy Evaluation & Autonomous Response" color="amber" />
      <Card delay={50}>
        <p className="text-xs text-slate-400 leading-relaxed"><span className="text-amber-400 font-bold">How it works:</span> Open Policy Agent (OPA) evaluates Rego policies against every request. When the ML engine flags intent drift, OPA's policy <span className="text-white font-mono">POL-002</span> matches and instructs Tetragon to issue a kernel-level <span className="text-red-400 font-bold">SIGKILL</span> to the offending process. Simultaneously, a Kubernetes NetworkPolicy isolates the pod from the cluster mesh. The entire response is autonomous — no human intervention required.</p>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Active Policies" value="24" icon={Layers} color="amber" delay={0} />
        <KPI label="Auth Decisions" value="1,204" icon={ShieldCheck} color="emerald" delay={80} />
        <KPI label="Blocks (24h)" value={isAttack ? '57' : '56'} icon={ShieldAlert} color="red" delay={160} />
        <KPI label="Agent Status" value={isAttack ? 'KILLED' : 'ACTIVE'} icon={isAttack ? FileWarning : Shield} color={isAttack ? 'red' : 'emerald'} delay={240} />
      </div>

      {/* Policy Table */}
      <Card delay={300} glow={isAttack ? 'glow-red' : 'glow-amber'}>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-amber-400" /> Rego Policy Ruleset
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] text-slate-500 tracking-widest border-b border-white/5">
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">REGO RULE</th>
                <th className="pb-3 font-medium">STATUS</th>
                <th className="pb-3 font-medium text-right">HITS</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className={`border-b border-white/5 transition-colors ${r.status === 'TRIGGERED' ? 'bg-red-500/10' : 'hover:bg-white/[0.03]'}`}>
                  <td className="py-3 text-xs font-mono text-slate-500">{r.id}</td>
                  <td className="py-3 text-xs font-mono text-sky-400">{r.rule}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'TRIGGERED' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                      r.status === 'ENFORCED' ? 'bg-amber-500/10 text-amber-400' :
                      r.status === 'ARMED' ? 'bg-sky-500/10 text-sky-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>{r.status}</span>
                  </td>
                  <td className="py-3 text-xs text-right font-mono text-slate-400">{r.hits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Enforcement Decision Panel */}
      {isAttack && (
        <Card delay={450} glow="glow-red" className="animate-attack-flash">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-400 mb-1">AUTONOMOUS ENFORCEMENT EXECUTED</h3>
              <p className="text-sm text-slate-400 mb-3">OPA policy POL-002 matched. Tetragon enforced SIGKILL on agent process.</p>
              <div className="bg-black/40 rounded-lg p-3 font-mono text-xs space-y-1">
                <p className="text-red-400">Action: SIGKILL sent to PID 4721</p>
                <p className="text-amber-400">NetworkPolicy: Pod isolated from cluster mesh</p>
                <p className="text-sky-400">SPIFFE SVID: Marked for immediate revocation</p>
                <p className="text-emerald-400">Recovery: Awaiting operator clearance...</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Autonomous Response Timeline */}
      <Card delay={500}>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" /> Autonomous Response Timeline</h3>
        <div className="relative pl-6 border-l-2 border-slate-700 space-y-5">
          {[
            { time: 'T+0ms', label: 'Agent accesses /forbidden_secrets.txt', detail: 'sys_enter_openat intercepted by Tetragon kprobe on fd_install', color: 'purple', done: true },
            { time: 'T+2ms', label: 'eBPF event streamed to Parseable', detail: 'Fluent Bit forwards matched event via HTTP to log ingestion', color: 'sky', done: true },
            { time: 'T+84ms', label: 'PyTorch computes cosine similarity', detail: 'Embedding vectors diverge — score drops below 0.5 threshold', color: 'emerald', done: isAttack },
            { time: 'T+86ms', label: 'OPA Rego policy POL-002 triggers', detail: 'deny file.read("/forbidden_secrets.txt") matched', color: 'amber', done: isAttack },
            { time: 'T+87ms', label: 'SIGKILL dispatched to agent PID', detail: 'Tetragon matchAction: Sigkill — process terminated at kernel', color: 'red', done: isAttack },
            { time: 'T+90ms', label: 'NetworkPolicy isolates pod', detail: 'Kubernetes revokes egress, SPIRE SVID marked for revocation', color: 'red', done: isAttack },
          ].map((step, i) => (
            <div key={i} className="relative">
              <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 ${step.done ? `bg-${step.color}-500 border-${step.color}-400` : 'bg-slate-800 border-slate-600'}`} />
              <div className="flex items-baseline gap-3">
                <span className={`text-[10px] font-mono font-bold ${step.done ? `text-${step.color}-400` : 'text-slate-600'}`}>{step.time}</span>
                <span className={`text-sm font-medium ${step.done ? 'text-white' : 'text-slate-600'}`}>{step.label}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 ml-16">{step.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN APPLICATION ───────────────────────────────────────────────────

export default function SovereignSentinel() {
  const [trustScore, setTrustScore] = useState(100.0);
  const [isAttack, setIsAttack] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeScreen, setActiveScreen] = useState('overview');
  const [ambushPhase, setAmbushPhase] = useState('IDLE');
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });
  const clock = useLiveClock();

  const showToast = (message, type = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // Live Backend Polling
  useEffect(() => {
    const scoreInterval = setInterval(async () => {
      try {
        const res = await fetch('/analytics/latest_score');
        if (res.ok) {
          const data = await res.json();
          const score = data.trust_score !== undefined ? data.trust_score : data.score;
          if (score !== undefined && !isAttack) setTrustScore((score * 100).toFixed(1));
          if (data.intent_drift_detected || (score !== undefined && score < 0.5)) setIsAttack(true);
        }
      } catch (e) {}
    }, 1000);

    const logInterval = setInterval(async () => {
      try {
        const authHeader = 'Basic ' + btoa('admin:admin');
        const res = await fetch('/parseable/api/v1/logstream/tetragon?limit=5', { headers: { Authorization: authHeader } });
        if (res.ok) {
          const newLogs = await res.json();
          if (newLogs && newLogs.length > 0) {
            const formatted = newLogs.reverse().map((log, i) => {
              const action = log.action || log.event?.action || 'sys_enter_openat';
              const isSigkill = (log.matchAction || log.event?.matchAction) === 'Sigkill' || String(log.event).includes('forbidden');
              return {
                id: Date.now() + i,
                time: log.p_timestamp ? new Date(log.p_timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
                action: isSigkill ? 'Read /forbidden_secrets.txt' : action,
                isSigkill
              };
            });
            setLogs(prev => [...formatted, ...prev].slice(0, 20));
            if (formatted.some(l => l.isSigkill)) setIsAttack(true);
          }
        }
      } catch (e) {}
    }, 1000);
    return () => { clearInterval(scoreInterval); clearInterval(logInterval); };
  }, [isAttack]);

  // ── AMBUSH SEQUENCE ──
  const executeAmbush = () => {
    setAmbushPhase('BREACH');
    setActiveScreen('telemetry');
    showToast('⚠ BREACH: Unauthorized file access detected on Agent-01', 'danger');
    setLogs(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), action: 'sys_enter_openat: /app/forbidden_secrets.txt', isSigkill: true },
      { id: Date.now()+1, time: new Date().toLocaleTimeString(), action: 'kprobe: file_permission check FAILED', isSigkill: true },
      ...prev
    ].slice(0, 20));

    setTimeout(() => {
      setAmbushPhase('DETECT');
      setActiveScreen('analytics');
      setIsAttack(true);
      setTrustScore(21.4);
      showToast('🧠 ML Engine: Cosine similarity collapse — intent drift confirmed', 'warn');
      setTimeout(() => setTrustScore(8.7), 400);
      setTimeout(() => setTrustScore(4.1), 800);
    }, 2500);

    setTimeout(() => {
      setAmbushPhase('ENFORCE');
      setActiveScreen('enforcement');
      setTrustScore(2.3);
      showToast('🛡 OPA: SIGKILL dispatched — Agent-01 process terminated', 'danger');
      setLogs(prev => [
        { id: Date.now() + 99, time: new Date().toLocaleTimeString(), action: 'OPA ENFORCE: SIGKILL -> PID 4721 (forbidden_secrets.txt)', isSigkill: false, isSys: true },
        { id: Date.now() + 100, time: new Date().toLocaleTimeString(), action: 'NetworkPolicy: Pod egress revoked, mesh isolated', isSigkill: false, isSys: true },
        ...prev
      ].slice(0, 20));
    }, 5000);

    setTimeout(() => {
      setAmbushPhase('NEUTRALIZED');
      showToast('✅ Threat neutralized. SVID revoked. Awaiting operator clearance.', 'success');
    }, 7000);
  };

  const resetEnvironment = () => {
    setIsAttack(false);
    setTrustScore(100.0);
    setAmbushPhase('IDLE');
    setLogs([]);
    setActiveScreen('overview');
  };

  const navItems = [
    { id: 'overview', label: 'Command Center', icon: Globe },
    { id: 'identity', label: 'Identity (SPIRE)', icon: Fingerprint },
    { id: 'telemetry', label: 'Telemetry (eBPF)', icon: Activity },
    { id: 'analytics', label: 'Analytics (ML)', icon: Zap },
    { id: 'enforcement', label: 'Enforcement (OPA)', icon: Lock },
  ];

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-700 ${isAttack ? 'bg-[#0b0e14]' : 'bg-[#0b0e14]'}`}>
      
      {/* Toast Notifications */}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      
      {/* Red Alert Border */}
      {isAttack && <div className="fixed inset-0 pointer-events-none border-2 border-red-500/40 z-[60] animate-pulse" />}

      {/* ─── LEFT SIDEBAR ─── */}
      <div className="w-64 flex-shrink-0 bg-[#080b12] border-r border-sky-500/[0.08] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-sky-500/[0.08]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isAttack ? 'bg-red-500/10 text-red-400' : 'bg-sky-500/10 text-sky-400'}`}>
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wider">SOVEREIGN</h1>
              <p className="text-[10px] text-slate-500 tracking-widest">SENTINEL v2.4</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeScreen === item.id
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {activeScreen === item.id && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </nav>

        {/* Agent Status */}
        <div className="p-4 border-t border-sky-500/[0.08]">
          <div className={`p-4 rounded-xl border ${isAttack ? 'border-red-500/30 bg-red-500/5' : 'border-sky-500/10 bg-sky-500/5'}`}>
            <div className="flex items-center gap-2 mb-2">
              <StatusDot color={isAttack ? 'red' : 'emerald'} />
              <span className="text-xs font-bold text-white">SENTINEL-01</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">spiffe://aegis.did/agent/01</p>
            <p className={`text-[10px] mt-1 font-bold ${isAttack ? 'text-red-400' : 'text-emerald-400'}`}>
              {isAttack ? '⚠ COMPROMISED' : '● OPERATIONAL'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 flex-shrink-0 border-b border-sky-500/[0.08] bg-[#080b12]/80 backdrop-blur-md flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white">{navItems.find(n => n.id === activeScreen)?.label}</h2>
            {ambushPhase !== 'IDLE' && (
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider animate-pulse ${
                ambushPhase === 'BREACH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                ambushPhase === 'DETECT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                ambushPhase === 'ENFORCE' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {ambushPhase === 'BREACH' ? '🔴 BREACH DETECTED' :
                 ambushPhase === 'DETECT' ? '🟡 ANALYZING THREAT' :
                 ambushPhase === 'ENFORCE' ? '🟣 ENFORCING SIGKILL' :
                 '🟢 THREAT NEUTRALIZED'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-500">{clock.toLocaleTimeString()}</span>
            {ambushPhase !== 'IDLE' ? (
              <button onClick={resetEnvironment} className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer">
                Reset All Systems
              </button>
            ) : (
              <button onClick={executeAmbush} className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.15)] cursor-pointer">
                Execute Red Team Ambush
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeScreen === 'overview' && <OverviewScreen trustScore={trustScore} isAttack={isAttack} logs={logs} ambushPhase={ambushPhase} />}
          {activeScreen === 'identity' && <IdentityScreen isAttack={isAttack} />}
          {activeScreen === 'telemetry' && <TelemetryScreen isAttack={isAttack} logs={logs} />}
          {activeScreen === 'analytics' && <AnalyticsScreen trustScore={trustScore} isAttack={isAttack} />}
          {activeScreen === 'enforcement' && <EnforcementScreen isAttack={isAttack} trustScore={trustScore} />}
        </div>

        {/* Bottom Status Bar */}
        <div className="h-8 flex-shrink-0 border-t border-sky-500/[0.08] bg-[#080b12]/90 flex items-center justify-between px-6 text-[10px] font-mono text-slate-600">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><StatusDot color='emerald' pulse={false} /> SPIRE Server</span>
            <span className="flex items-center gap-1.5"><StatusDot color='purple' pulse={false} /> Tetragon eBPF</span>
            <span className="flex items-center gap-1.5"><StatusDot color='sky' pulse={false} /> FastAPI Engine</span>
            <span className="flex items-center gap-1.5"><StatusDot color={isAttack ? 'red' : 'emerald'} /> OPA Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Uptime: {Math.floor((Date.now() % 86400000) / 3600000)}h {Math.floor((Date.now() % 3600000) / 60000)}m</span>
            <span>Latency: 0.84ms</span>
            <span className={isAttack ? 'text-red-400 font-bold' : 'text-emerald-400'}>Status: {isAttack ? 'ALERT' : 'NOMINAL'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
