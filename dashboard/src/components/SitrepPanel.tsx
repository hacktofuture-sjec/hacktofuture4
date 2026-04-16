interface SitrepAlert {
  id: string;
  threatLevel: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  sitrep?: string;
  gasPpm?: number;
  survivability?: number;
  gasThreatLabel?: string;
  equipmentChecklist?: string[];
}

interface SitrepPanelProps {
  alert: SitrepAlert;
  onClose: () => void;
}

export default function SitrepPanel({ alert, onClose }: SitrepPanelProps) {
  const survivability = alert.survivability ?? 78;
  const gasThreat = alert.gasThreatLabel ?? `MODERATE (${alert.gasPpm ?? 420} PPM)`;
  const checklist = alert.equipmentChecklist ?? ['Gas Masks', 'Concrete Saws', 'Thermal Cameras'];

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded tracking-widest text-xs font-bold ${
            alert.threatLevel === 'RED'
              ? 'bg-red-500/20 text-red-500'
              : alert.threatLevel === 'ORANGE'
              ? 'bg-orange-500/20 text-orange-500'
              : 'bg-yellow-500/20 text-yellow-500'
          }`}>
            THREAT: {alert.threatLevel}
          </span>
          <span className="font-mono text-neutral-400 text-sm">ALERT ID: {alert.id}</span>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-white">✕</button>
      </div>
      
      <div className="flex-1 p-4 grid grid-cols-4 gap-6 bg-neutral-950 overflow-y-auto">
        <div className="col-span-2 flex flex-col">
          <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Tactical SITREP</h3>
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded font-mono text-sm text-neutral-300 leading-relaxed flex-1">
            {alert.sitrep ?? `Structural instability observed at ${alert.id}. Field command should keep extraction teams staged with rapid entry protocol.`}
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-4">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Survivability</h3>
            <div className="relative w-24 h-24 rounded-full border-4 border-neutral-800 flex items-center justify-center">
               {/* Pseudo circular progress */}
               <div className="absolute inset-0 rounded-full border-4 border-emerald-500" style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}></div>
              <span className="text-xl font-bold font-mono text-emerald-400">{survivability}%</span>
            </div>
          </div>
          <div>
             <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Gas Threat</h3>
             <div className="px-3 py-2 bg-orange-500/20 border border-orange-500/50 text-orange-500 rounded font-mono text-sm">
               {gasThreat}
             </div>
          </div>
        </div>

        <div className="col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Logistics</h3>
            <div className="flex flex-col gap-2 text-sm text-neutral-300">
              {checklist.map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input type="checkbox" className="rounded bg-neutral-800 border-neutral-700" />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
             <button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-xs font-bold uppercase tracking-wider">Nav Primary</button>
             <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded text-xs font-bold uppercase tracking-wider border border-neutral-700">Alt Route</button>
          </div>
        </div>
      </div>
    </div>
  );
}
