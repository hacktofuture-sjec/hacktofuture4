'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CloudRain, Wind, Droplets, AlertTriangle, CheckCircle2, Activity, Flame, Thermometer, Radio, MapPin, Cpu } from 'lucide-react';

const NeoMap = dynamic(() => import('@/components/NeoMap'), { ssr: false, loading: () => <div className="neo-inset h-full w-full flex items-center justify-center text-slate-500 animate-pulse">Initializing Geospatial Tracker...</div> });

export default function NeuroMeshCommand() {
  const ACC_TRIGGER_G = 0.25;
  const GAS_TRIGGER_PPM = 2000;

  const [simulationStage, setSimulationStage] = useState(0);
  const [sensorValues, setSensorValues] = useState({ acc: 1.02, gas: 50, pir: false, temp: 25.4, hum: 65 });
  const [weather, setWeather] = useState<any>(null);
  const [floodRisk, setFloodRisk] = useState<string>("Evaluating...");
  const [sitrepReady, setSitrepReady] = useState(false);
  const [activeSitrep, setActiveSitrep] = useState(`CODE RED. Structural collapse confirmed at Node NM-01, Hampankatta, Mangaluru.\nSurvivability score: 94/100. Estimated 3-4 survivors trapped.\nLPG leak detected — HAZMAT protocol required.\nNearest NDRF: 3.97km via Route Alpha.\nDeploy Team Bravo immediately. Golden hour: 58 minutes remaining.`);
  const [incident, setIncident] = useState({
    threatLevel: 'GREEN',
    headline: 'No active incident',
    earthquakeTriggered: false,
    gasSpike: false,
  });

  // Weather Fetch
  useEffect(() => {
    async function fetchWeather() {
      try {
        const wApi = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || "6311d9af91289e9cbf78c0226c26d116";
        const fApi = process.env.NEXT_PUBLIC_OPENWEATHER_FLOOD_API_KEY || "5a3065934a0eee350c66e4de29bf0143";
        const [wRes, fRes] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?lat=12.9141&lon=74.8560&appid=${wApi}&units=metric`),
          fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=12.9141&lon=74.8560&appid=${fApi}&units=metric`)
        ]);
        const wData = await wRes.json();
        const fData = await fRes.json();
        setWeather({ ...wData, forecast: fData });
        
        let rainTotal = 0;
        if (fData.list) {
          fData.list.slice(0, 2).forEach((item: any) => {
            if (item.rain && item.rain['3h']) rainTotal += item.rain['3h'];
          });
        }
        setFloodRisk(rainTotal > 5 ? "HIGH RISK" : rainTotal > 1 ? "MEDIUM RISK" : "LOW RISK");
      } catch(e) { }
    }
    fetchWeather();
  }, []);

  // Real Sensor Live Updates via API
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (!res.ok) return;
        const data = await res.json();
        if (data.latestReading && active) {
          const acc = data.latestReading.accelerationG || 1.0;
          const gas = data.latestReading.gasRaw || 50;
          const earthquakeTriggered = Boolean(data.latestReading.earthquakeActive) || Math.abs(acc - 1.0) > ACC_TRIGGER_G;
          const gasSpike = gas > GAS_TRIGGER_PPM;
          const topAlert = data.alerts?.[0];
          setSensorValues({
            acc,
            gas,
            pir: data.latestReading.motion || false,
            temp: data.latestReading.tempC || 25.4,
            hum: data.latestReading.humidity || 65
          });

          const hasAlert = Boolean(topAlert);
          const hardwareAlert = data.latestReading.sensorAlert || 'SAFE';
          setIncident({
            threatLevel: topAlert?.threatLevel || (earthquakeTriggered && gasSpike ? 'RED' : earthquakeTriggered || gasSpike ? 'YELLOW' : 'GREEN'),
            headline:
              topAlert?.headline ||
              (hardwareAlert === 'EARTHQUAKE'
                ? 'Earthquake event active (10s persistence window)'
                : earthquakeTriggered
                ? 'Earthquake motion detected from accelerometer'
                : gasSpike
                ? 'Gas spike detected from MQ sensor'
                : 'No active incident'),
            earthquakeTriggered,
            gasSpike,
          });

          if (hasAlert && topAlert?.sitrep) {
            setActiveSitrep(topAlert.sitrep);
          }

          // Trigger animation once
          if (simulationStage === 0 && (hasAlert || earthquakeTriggered || gasSpike)) {
            startDisasterSequence();
          }

          if (simulationStage > 0 && !hasAlert && !earthquakeTriggered && !gasSpike) {
            setSitrepReady(false);
            setSimulationStage(0);
          }
        }
      } catch (err) {}
    }, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [simulationStage]);

  // Trigger Animation Sequence
  const triggerDisaster = () => {
    if (simulationStage > 0) {
      setSimulationStage(0); 
      setSitrepReady(false);
      return;
    }
    startDisasterSequence();
  };

  const startDisasterSequence = () => {
    setSimulationStage(1);

    setTimeout(() => setSimulationStage(2), 800);   // Draw to NM-02
    setTimeout(() => setSimulationStage(3), 1600);  // Light NM-02, Draw to NM-03
    setTimeout(() => setSimulationStage(4), 2400);  // Light NM-03, Draw to NM-04
    setTimeout(() => setSimulationStage(5), 3200);  // Light NM-04, Draw to NDRF
    setTimeout(() => {
      setSimulationStage(6); // Explode NDRF
      setSitrepReady(true);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-neo)] p-4 flex flex-col gap-4 neo-text-primary text-slate-800">
      
      {/* Top Bar */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="neo-pill bg-teal p-3 shadow-neo text-white">
            <Cpu className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">NeuroMesh Spatial Command</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${simulationStage > 0 ? 'bg-coral text-white animate-pulse-ring' : 'neo-inset text-teal'}`}>
                {incident.threatLevel === 'RED' ? "EARTHQUAKE ALERT" : simulationStage > 0 ? "ALERT TRIGGERED" : "SYSTEM STABLE"}
              </span>
              <span className="neo-inset px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">MANGALURU SENSOR MESH</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="neo-card p-3 px-5 flex items-center justify-center gap-3">
             <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Nodes</div>
             <div className="text-xl font-bold text-teal">5</div>
           </div>
           <div className="neo-card p-3 px-5 flex items-center justify-center gap-3">
             <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Route State</div>
             <div className="text-xl font-bold text-slate-800">{simulationStage > 0 ? 'ROUTING' : 'READY'}</div>
           </div>
           <div className="neo-card p-3 px-5 flex items-center justify-center gap-3">
             <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Mesh Integrity</div>
             <div className="text-xl font-bold text-green">100%</div>
           </div>
        </div>
      </header>

      {incident.threatLevel !== 'GREEN' && (
        <section className="neo-card p-5 emergency-banner">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-black text-white/90">Final Incident Signal</div>
              <div className="text-2xl md:text-3xl font-black text-white leading-tight mt-1">
                {incident.earthquakeTriggered ? 'EARTHQUAKE TRIGGERED FROM SENSOR MESH' : 'EMERGENCY SIGNAL TRIGGERED'}
              </div>
              <p className="text-sm md:text-base text-white/95 mt-2 font-semibold">{incident.headline}</p>
            </div>
            <div className="neo-inset-pill px-3 py-1 text-xs font-black text-coral bg-white">{incident.threatLevel}</div>
          </div>
        </section>
      )}

      {/* Main Grid */}
      <main className="grid flex-1 gap-4 xl:grid-cols-[300px_1fr_340px]">
        
        {/* Left Sensor Panel */}
        <aside className="neo-card p-5 flex flex-col gap-4">
           <div className="flex items-center justify-between mb-2">
             <h2 className="text-sm font-bold uppercase text-slate-500 tracking-widest">Live Sensors</h2>
             <div className="neo-inset-pill px-3 py-1 text-xs font-bold text-slate-700">ESP32 NM-01</div>
           </div>

           {/* ACCELERATION */}
           <div className="neo-inset p-4 relative overflow-hidden">
             <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center gap-1"><Activity className="w-3 h-3 text-coral"/> Acceleration</div>
             <div className={`text-4xl font-black ${simulationStage > 0 ? 'text-coral' : 'text-teal'}`}>
               {sensorValues.acc.toFixed(3)} <span className="text-xl text-slate-500 font-bold">G</span>
             </div>
             {simulationStage > 0 && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-coral animate-pulse-ring opacity-50"></div>}
           </div>

           {/* GAS GAUGE */}
           <div className="neo-inset p-4 flex flex-col items-center">
             <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 w-full flex items-center gap-1"><Flame className="w-3 h-3 text-amber"/> HAZMAT GAS (PPM)</div>
             <div className="relative w-32 h-32 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-neo)" strokeWidth="10" className="shadow-none" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke={simulationStage > 0 ? "var(--coral)" : "var(--teal)"} strokeWidth="10" strokeDasharray="283" strokeDashoffset={283 - (Math.min(sensorValues.gas, 1000)/1000)*283} className="transition-all duration-500 ease-out drop-shadow-md" />
                </svg>
                <div className="absolute flex flex-col items-center text-center">
                   <div className="text-2xl font-black text-slate-800">{Math.round(sensorValues.gas)}</div>
                </div>
             </div>
           </div>

           {/* SMALL SENSORS */}
           <div className="grid grid-cols-2 gap-3">
              <div className="neo-inset p-3 flex flex-col items-center justify-center text-center">
                <Thermometer className="w-4 h-4 text-amber mb-1"/>
                <div className="text-lg font-bold text-slate-800">{sensorValues.temp.toFixed(1)}°</div>
              </div>
              <div className="neo-inset p-3 flex flex-col items-center justify-center text-center">
                <Droplets className="w-4 h-4 text-cyan-500 mb-1"/>
                <div className="text-lg font-bold text-slate-800">{sensorValues.hum.toFixed(1)}%</div>
              </div>
           </div>

           {/* PIR */}
           <div className="neo-inset p-4 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest"><Radio className="inline w-3 h-3 mb-0.5 text-purple"/> PIR Radar</div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${sensorValues.pir ? 'text-coral' : 'text-slate-500'}`}>{sensorValues.pir ? 'ACTIVE' : 'SLEEP'}</span>
                <div className={`w-8 h-8 rounded-full border-2 ${sensorValues.pir ? 'border-coral flex items-center justify-center' : 'border-slate-300'}`}>
                   {sensorValues.pir && <div className="w-full h-full rounded-full bg-coral/20 animate-radar overflow-hidden relative"><div className="absolute top-0 right-0 w-1/2 h-1/2 bg-coral origin-bottom-left"></div></div>}
                </div>
              </div>
           </div>

           <div className="mt-auto pt-4 flex-1 flex items-end">
             <button onClick={triggerDisaster} className="w-full py-4 neo-card bg-coral text-white font-black uppercase tracking-widest text-sm neo-card-interactive active:translate-y-1">
               {simulationStage > 0 ? "RESET SIMULATION" : "SIMULATE DISASTER"}
             </button>
           </div>
        </aside>

        {/* Center Map Panel */}
        <section className="neo-card p-2 h-full min-h-[500px]">
           <NeoMap simulationStage={simulationStage} />
        </section>

        {/* Right Intel Panel */}
        <aside className="neo-card p-5 flex flex-col gap-4 overflow-y-auto">
           <h2 className="text-sm font-bold uppercase text-slate-500 tracking-widest mb-1">Intelligence Pipeline</h2>
           
           <div className="neo-inset p-4">
             <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">System Reaction</div>
             
             {simulationStage === 0 && <div className="text-sm text-slate-400 font-medium italic">Awaiting trigger payload...</div>}
             {simulationStage > 0 && (
               <div className="space-y-3">
                 <div className="flex items-center justify-between text-sm">
                   <span className="font-bold text-slate-600">Verification Agent</span>
                   {simulationStage >= 1 ? <CheckCircle2 className="w-4 h-4 text-green" /> : <div className="w-4 h-4 border-2 border-slate-300 rounded-full animate-spin border-t-slate-500"></div>}
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="font-bold text-slate-600">Triage Intelligence</span>
                   {simulationStage >= 3 ? <CheckCircle2 className="w-4 h-4 text-green" /> : simulationStage >= 1 ? <div className="w-4 h-4 border-2 border-slate-300 rounded-full animate-spin border-t-slate-500"></div> : <div className="w-4 h-4 border-2 border-slate-200 rounded-full"></div>}
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="font-bold text-slate-600">Route Logistics</span>
                   {simulationStage >= 5 ? <CheckCircle2 className="w-4 h-4 text-green" /> : simulationStage >= 3 ? <div className="w-4 h-4 border-2 border-slate-300 rounded-full animate-spin border-t-slate-500"></div> : <div className="w-4 h-4 border-2 border-slate-200 rounded-full"></div>}
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="font-bold text-slate-600">NDRF Dispatch</span>
                   {sitrepReady ? <CheckCircle2 className="w-4 h-4 text-green" /> : simulationStage >= 5 ? <div className="w-4 h-4 border-2 border-slate-300 rounded-full animate-spin border-t-slate-500"></div> : <div className="w-4 h-4 border-2 border-slate-200 rounded-full"></div>}
                 </div>
               </div>
             )}
           </div>

           <div className="neo-inset p-4 min-h-[140px]">
             <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Pipeline SITREP</div>
             <div className="text-sm md:text-base font-semibold text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
               {sitrepReady ? <span className="emergency-sitrep">{activeSitrep}</span> : <span className="text-slate-400 italic">No crisis active.</span>}
             </div>
           </div>

           {/* OpenWeather Prediction */}
           <div className="neo-inset p-4 mt-auto">
              <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3 flex items-center gap-1"><CloudRain className="w-3 h-3 text-teal"/> OpenWeather Predict</div>
              {!weather ? <div className="text-xs text-slate-400">Fetching API...</div> : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center"><span className="font-bold text-slate-600">Temp</span> <span className="font-black text-slate-800">{weather.main.temp}°C</span></div>
                  <div className="flex justify-between items-center"><span className="font-bold text-slate-600">Wind</span> <span className="font-black text-slate-800">{weather.wind.speed} m/s</span></div>
                  <div className="flex justify-between items-center"><span className="font-bold text-slate-600">Rain Risk</span> <span className={`font-black uppercase text-xs px-2 py-0.5 rounded-sm ${floodRisk.includes('HIGH') ? 'bg-coral text-white' : 'bg-green/20 text-green'}`}>{floodRisk}</span></div>
                </div>
              )}
           </div>
        </aside>
      </main>

      {/* Bottom Strip */}
      <footer className="grid grid-cols-2 md:grid-cols-5 gap-4">
         <div className="neo-card p-4 flex flex-col justify-center">
           <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Closest Dist</div>
           <div className="text-xl font-bold text-slate-800 mt-1">3.97 <span className="text-sm">km</span></div>
         </div>
         <div className="neo-card p-4 flex flex-col justify-center">
           <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Survivability</div>
           <div className="text-xl font-bold text-slate-800 mt-1">{simulationStage > 0 ? "94" : "—"} <span className="text-sm">%</span></div>
         </div>
         <div className="neo-card p-4 flex flex-col justify-center">
           <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Mesh Hops</div>
           <div className="text-xl font-bold text-slate-800 mt-1">{simulationStage > 0 ? "3" : "0"} <span className="text-sm">relays</span></div>
         </div>
         <div className="neo-card p-4 flex flex-col justify-center">
           <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Response ETA</div>
           <div className="text-xl font-bold text-slate-800 mt-1">{simulationStage > 0 ? "8" : "—"} <span className="text-sm">mins</span></div>
         </div>
         <div className="neo-card p-4 flex flex-col justify-center">
           <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Rescue Window</div>
           <div className="text-xl font-bold text-slate-800 mt-1">{simulationStage > 0 ? "CLEAR" : "STABLE"}</div>
         </div>
      </footer>
    </div>
  );
}
