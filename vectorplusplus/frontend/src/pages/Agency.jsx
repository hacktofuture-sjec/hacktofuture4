import { useState, useEffect } from "react";
import axios from "axios";
import { RefreshCw, Zap } from "../icons";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

export default function AgencyBoard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState("");
  const [scraping, setScraping] = useState(false);
  const [generatingFor, setGeneratingFor] = useState(null);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/agency/leads`);
      setLeads(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleScrape = async () => {
    if (!city) return;
    setScraping(true);
    try {
      await axios.post(`${API}/agency/scrape`, { city });
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
    setScraping(false);
  };

  const handleClearLeads = async () => {
    setLoading(true);
    try {
      await axios.delete(`${API}/agency/leads`);
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleGenerateSite = async (id) => {
    setGeneratingFor(id);
    try {
      await axios.post(`${API}/agency/generate-site/${id}`);
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
    setGeneratingFor(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-indigo-500 bg-clip-text text-transparent">
            Agency CRM
          </h2>
          <p className="text-slate-400 text-sm">Find prospects and generate preview websites to pitch.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            className="input !py-1.5"
            placeholder="City (e.g. Austin)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button 
            onClick={handleScrape} 
            disabled={scraping}
            className="btn-primary !py-1.5 !px-3 font-semibold text-sm flex items-center gap-2"
          >
            {scraping ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            Find Leads
          </button>
          <button 
            onClick={handleClearLeads} 
            disabled={loading}
            className="btn-ghost !py-1.5 !px-3 font-semibold text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Clear Leads
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {leads.map(lead => (
          <div key={lead.id} className="glass p-5 rounded-2xl relative overflow-hidden group">
            {lead.has_poor_presence && (
              <div className="absolute top-0 right-0 bg-red-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                HOT LEAD
              </div>
            )}
            <h3 className="font-bold text-lg text-white mb-1">{lead.name || "Unknown Restaraunt"}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
               <span className="text-yellow-500 font-bold">★ {lead.google_rating || lead.rating || "N/A"}</span>
               <span>({lead.review_count || lead.reviews || 0} reviews)</span>
            </div>
            
            <p className="text-xs text-slate-400 mb-4 h-12 overflow-hidden leading-snug">
              {lead.reasons || "Looks like an okay website, could be better."}
            </p>

            <div className="flex items-center gap-2 mt-auto">
              {!lead.preview_url || lead.preview_url === lead.preview_site_url ? (
                <button
                  onClick={() => handleGenerateSite(lead.id)}
                  disabled={generatingFor === lead.id}
                  className="w-full bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center gap-2"
                >
                  {generatingFor === lead.id ? (
                    <><RefreshCw size={14} className="animate-spin" /> Building...</>
                  ) : "Generate Pitch Site"}
                </button>
              ) : (
                <a 
                  href={`http://localhost:3000${lead.preview_url}`}
                  target="_blank" rel="noreferrer"
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center"
                >
                  View Preview Site →
                </a>
              )}
            </div>
          </div>
        ))}
        {leads.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No leads yet. Enter a city and click "Find Leads" to scrape open APIs!
          </div>
        )}
      </div>
    </div>
  );
}
