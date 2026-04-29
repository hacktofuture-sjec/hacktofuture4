'use client';
import { useEffect, useState } from 'react';
import { CloudRain, Wind, AlertTriangle, Droplets } from 'lucide-react';

export default function WeatherPrediction({ lat = 12.914, lng = 74.856 }) {
  const [weather, setWeather] = useState<any>(null);
  const [floodRisk, setFloodRisk] = useState<string>("Evaluating...");

  useEffect(() => {
    async function fetchData() {
      try {
        const weatherApi = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || "6311d9af91289e9cbf78c0226c26d116";
        const wRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${weatherApi}&units=metric`);
        const wData = await wRes.json();
        setWeather(wData);

        // Flood simulation/prediction logic
        if (wData?.rain && wData.rain['1h'] > 10) setFloodRisk("HIGH RISK");
        else if (wData?.weather?.[0]?.main === 'Rain') setFloodRisk("MODERATE RISK");
        else setFloodRisk("LOW RISK");
      } catch(e) {
        console.error(e);
      }
    }
    fetchData();
  }, [lat, lng]);

  return (
    <div className="neo-card p-5 mt-4">
      <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center"><CloudRain className="w-4 h-4 mr-2 text-cyan-600"/> Pre-Disaster Prediction Models</div>
      {!weather ? (
         <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-3 py-1"><div className="h-2 bg-slate-300 rounded neo-inner"></div></div></div>
      ) : (
         <div className="grid grid-cols-2 gap-3 mt-4">
           <div className="neo-inner p-3 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Temperature</span>
              <span className="text-xl font-bold text-slate-800">{weather.main.temp}°C</span>
           </div>
           <div className="neo-inner p-3 flex flex-col items-center justify-center">
             <span className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Wind Speed</span>
             <span className="text-xl font-bold text-slate-800">{weather.wind.speed} m/s</span>
           </div>
           <div className="col-span-2 neo-inner p-3 flex items-center justify-between">
             <div className="flex items-center gap-2 text-slate-700">
               <AlertTriangle className={`w-5 h-5 ${floodRisk.includes('HIGH') ? 'text-red-500' : 'text-emerald-500'}`} />
               <span className="font-bold text-sm">Flood Probability:</span>
             </div>
             <span className={`font-black uppercase text-sm ${floodRisk.includes('HIGH') ? 'text-red-600' : 'text-emerald-600'}`}>{floodRisk}</span>
           </div>
         </div>
      )}
    </div>
  );
}
