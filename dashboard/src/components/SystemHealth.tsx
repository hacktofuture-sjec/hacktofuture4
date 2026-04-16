interface SystemHealthProps {
  activeNodes: number;
  alertCount: number;
  pipelineStatus: 'LIVE' | 'STALE';
}

export default function SystemHealth({ activeNodes, alertCount, pipelineStatus }: SystemHealthProps) {
  return (
    <div className="flex items-center justify-between w-full px-6 text-sm">
      <div className="flex items-center gap-4">
        <div className="font-bold text-lg text-emerald-500 font-mono tracking-widest flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
          NEUROMESH HQ
        </div>
        <div className="h-6 w-px bg-neutral-700 mx-2"></div>
        <div className="flex items-center gap-6">
          <div>
            <span className="text-neutral-500">Active Nodes:</span>
            <span className="ml-2 font-mono text-emerald-400">{activeNodes}</span>
          </div>
          <div>
            <span className="text-neutral-500">Alert State:</span>
            <span className={`ml-2 font-mono font-bold ${alertCount > 0 ? 'text-red-500' : 'text-emerald-400'}`}>{alertCount}</span>
          </div>
          <div>
            <span className="text-neutral-500">Pipeline Status:</span>
            <span className={`ml-2 font-mono ${pipelineStatus === 'LIVE' ? 'text-blue-400' : 'text-amber-400'}`}>{pipelineStatus}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-neutral-400">
          <span>LoRa Check:</span>
          <span className="text-emerald-500 font-mono">100%</span>
        </div>
        <div className="flex gap-2">
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 text-xs rounded uppercase font-bold tracking-wider transition-colors" type="button">
            Generate Full Briefing
          </button>
          <button className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1 text-xs rounded uppercase font-bold tracking-wider transition-colors border border-neutral-700" type="button">
             Live Feed
          </button>
        </div>
      </div>
    </div>
  );
}
