import { useEffect, useState, useRef } from "react";
import { Activity, Shield, Zap, Database, Server, Globe } from "lucide-react";
import "./style.css";
const ICON_MAP = {
  "flask-sqli": Zap,
  "node-pathtraversal": Globe,
  "jwt-auth": Shield,
  "postgres-weak": Database,
  "redis-noauth": Activity,
  "nginx-misconfig": Server,
};

const HEALTH_COLOR = {
  up: "text-green-400 border-green-400",
  degraded: "text-yellow-400 border-yellow-400",
  down: "text-red-500 border-red-500",
  not_found: "text-gray-500 border-gray-600",
};

const HEALTH_BG = {
  up: "bg-green-400",
  degraded: "bg-yellow-400",
  down: "bg-red-500",
  not_found: "bg-gray-600",
};

function ServiceCard({ svc }) {
  const Icon = ICON_MAP[svc.name] || Server;
  const hc = HEALTH_COLOR[svc.health] || HEALTH_COLOR.not_found;
  const bg = HEALTH_BG[svc.health] || "bg-gray-600";

  return (
    <div className={`border rounded-lg p-4 bg-gray-900 ${hc} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} />
          <span className="font-mono text-sm font-bold">{svc.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${bg} ${svc.health === "up" ? "animate-pulse" : ""}`} />
          <span className="text-xs uppercase tracking-widest">{svc.health}</span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Port</span>
          <span className="font-mono">{svc.port}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Vulnerability</span>
          <span className="text-red-400 font-medium">{svc.vuln}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">CVE Class</span>
          <span className="font-mono text-yellow-400">{svc.cve}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Docker</span>
          <span className={svc.docker_status === "running" ? "text-green-400" : "text-gray-500"}>
            {svc.docker_status}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [services, setServices] = useState([]);
  const [logs, setLogs] = useState([]);
  const logsRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/services");
        const data = await res.json();
        setServices(data);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/logs");
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setLogs((prev) => [msg, ...prev].slice(0, 120));
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = 0;
  }, [logs]);

  const upCount = services.filter((s) => s.health === "up").length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-red-500">RED</span>
            <span className="text-gray-500 mx-2">vs</span>
            <span className="text-blue-400">BLUE</span>
            <span className="text-gray-400 text-base ml-3">· Target Cluster Monitor</span>
          </h1>
          <p className="text-gray-600 text-xs mt-1">Autonomous AI Defense System · HackToFuture 4.0</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-400">{upCount}<span className="text-gray-600">/{services.length}</span></div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">Services Up</div>
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {services.map((svc) => <ServiceCard key={svc.name} svc={svc} />)}
      </div>

      {/* Log Stream */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <div className="bg-gray-900 px-4 py-2 flex items-center gap-2 border-b border-gray-800">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400 uppercase tracking-widest">Live Log Stream</span>
        </div>
        <div ref={logsRef} className="h-64 overflow-y-auto bg-black p-4 space-y-1">
          {logs.length === 0 && (
            <p className="text-gray-700 text-xs">Waiting for log events...</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className="text-xs flex gap-3">
              <span className="text-gray-600 shrink-0">{log.ts?.slice(11, 19)}</span>
              <span className={`shrink-0 w-36 truncate ${
                log.service?.includes("flask") ? "text-red-400" :
                log.service?.includes("node") ? "text-orange-400" :
                log.service?.includes("jwt") ? "text-yellow-400" :
                log.service?.includes("nginx") ? "text-blue-400" :
                "text-gray-400"
              }`}>{log.service}</span>
              <span className="text-gray-300 truncate">{log.log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}