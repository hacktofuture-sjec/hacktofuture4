'use client';
import { useEffect, useRef } from 'react';

export default function MapPanel({ activeAlert }) {
  const mapContainer = useRef(null);

  useEffect(() => {
    // In a real app we'd initialize MapLibre here:
    // const map = new maplibregl.Map({ container: mapContainer.current, style: '...' })
    // return () => map.remove();
  }, []);

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: '#1a1a1a' }}>
      <div ref={mapContainer} className="w-full h-full opacity-50 relative">
        {/* Placeholder for MapLibre */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-neutral-600 font-mono uppercase tracking-[0.5em] text-sm">
            MapLibre GL Instance
          </div>
        </div>
        
        {/* CSS Mock of a radar/map sweep */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] -ml-[400px] -mt-[400px] border border-emerald-900/30 rounded-full"></div>
           <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -ml-[200px] -mt-[200px] border border-emerald-900/30 rounded-full"></div>
           <div className="absolute top-1/2 left-1/2 w-[1000px] h-[1px] bg-emerald-900/20 -ml-[500px]"></div>
           <div className="absolute top-1/2 left-1/2 w-[1px] h-[1000px] bg-emerald-900/20 -mt-[500px]"></div>
        </div>
      </div>

      {activeAlert && (
        <div className="absolute top-1/2 left-1/2 -ml-3 -mt-3 w-6 h-6 z-10">
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
          <div className="relative w-full h-full bg-red-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)]"></div>
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-neutral-900 px-2 py-1 rounded text-[10px] font-mono text-white whitespace-nowrap border border-neutral-700">
            {activeAlert.id} Incident Zone
          </div>
        </div>
      )}

      {/* Target Crosshair */}
      {!activeAlert && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500/50 pointer-events-none">
          ┼
        </div>
      )}
    </div>
  );
}
