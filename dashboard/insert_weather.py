import re

with open('src/app/page.tsx', 'r') as f:
    content = f.read()

# Add imports
import_str = "import { getLocalWeather, getFloodRisk } from './weatherApi';\nimport { CloudRain, Wind, Droplets, ThermometerSun } from 'lucide-react';\n"
if 'getLocalWeather' not in content:
    content = content.replace("import { AnimatePresence, motion } from 'framer-motion';", "import { AnimatePresence, motion } from 'framer-motion';\n" + import_str)

# Add states
state_str = """  const [weatherData, setWeatherData] = useState<any>(null);
  const [floodRisk, setFloodRisk] = useState<any>(null);

  useEffect(() => {
    // Default coords pointing to main sensor node Region (Mangalore roughly)
    const lat = 12.9141;
    const lng = 74.8560;
    
    getLocalWeather(lat, lng).then(data => setWeatherData(data));
    getFloodRisk(lat, lng).then(data => setFloodRisk(data));
  }, []);
"""
if 'const [weatherData' not in content:
    content = content.replace("const [pipelineState, setPipelineState]", state_str + "\n  const [pipelineState, setPipelineState]")

# Add UI section under Flow Summary
weather_ui = """            </section>

            <section className="rounded-[30px] border border-slate-200/50 bg-white/70 p-5 shadow-[0_22px_60px_rgba(2,6,23,0.15)] backdrop-blur-xl overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <CloudRain className="h-5 w-5 text-sky-500" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-800">Environmental Prediction</h2>
              </div>
              
              {!weatherData ? (
                <div className="text-sm text-slate-500 animate-pulse">Replicating NDRF APIs...</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-[20px] bg-gradient-to-br from-indigo-500/10 to-sky-500/10 p-4 border border-sky-200/50 relative overflow-hidden">
                    <div className="absolute right-0 top-0 -mr-6 -mt-6">
                       <ThermometerSun className="h-24 w-24 text-sky-400/20" />
                    </div>
                    <div className="relative z-10">
                      <div className="text-[10px] uppercase tracking-widest text-indigo-600 font-bold mb-1">Local Conditions</div>
                      <div className="text-2xl font-black text-slate-900">{Math.round(weatherData.main?.temp || 0)}°C</div>
                      <div className="text-xs text-slate-600 mt-1 capitalize font-medium">{weatherData.weather?.[0]?.description}</div>
                    </div>
                    <div className="relative z-10 text-right space-y-1">
                      <div className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-800"><Wind className="h-3 w-3 text-sky-600" /> {weatherData.wind?.speed} m/s</div>
                      <div className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-800"><Droplets className="h-3 w-3 text-sky-600" /> {weatherData.main?.humidity}%</div>
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-gradient-to-br from-rose-500/10 to-orange-500/10 p-4 border border-rose-200/50">
                    <div className="text-[10px] uppercase tracking-widest text-rose-600 font-bold mb-2">Flood Risk Analysis</div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-800">
                        {floodRisk ? 'Monitoring active' : 'Scanning terrain'}
                      </div>
                      <div className="text-xs px-2 py-1 bg-white/60 text-slate-900 rounded-full font-bold shadow-sm border border-slate-200/50">
                        {weatherData?.rain ? 'Elevated' : 'Low Warning'}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 leading-tight">
                      Replicating NDRF early-warning logic by correlating weather API rainfall density with terrain elevation profiles.
                    </div>
                  </div>
                </div>
              )}
"""

content = content.replace("</section>\n          </aside>", weather_ui + "\n          </aside>")

with open('src/app/page.tsx', 'w') as f:
    f.write(content)
