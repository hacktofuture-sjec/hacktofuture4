import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';

// Custom Large Red Premium Pin
const redPremiumPin = L.divIcon({
    className: 'custom-pin',
    html: `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-12 h-12 bg-red-500/20 rounded-full animate-ping"></div>
            <div class="w-5 h-5 bg-red-600 rounded-full border-[4px] border-white shadow-2xl scale-125"></div>
            <div class="absolute bottom-[-8px] w-[3px] h-3 bg-red-600 rounded-full"></div>
        </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

// Custom Hotspot/Trend Pin (Orange)
const hotspotIcon = L.divIcon({
    className: 'hotspot-pin',
    html: `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-14 h-14 bg-orange-500/20 rounded-full animate-pulse"></div>
            <div class="w-7 h-7 bg-orange-500 rounded-full border-[5px] border-white shadow-2xl scale-110 flex items-center justify-center">
                <div class="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <div class="absolute bottom-[-10px] w-1 h-4 bg-orange-500 rounded-full shadow-lg"></div>
        </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

const HotspotMap = ({ complaints, userLocation }) => {
    const validComplaints = complaints.filter(c => c.lat && c.lng);

    // Calculate Cluster Centroids for Hotspots
    const clusterGroups = validComplaints.reduce((acc, c) => {
        if (c.clusterId !== null && c.clusterId !== undefined) {
            if (!acc[c.clusterId]) acc[c.clusterId] = [];
            acc[c.clusterId].push(c);
        }
        return acc;
    }, {});

    const hotspotPoints = Object.keys(clusterGroups)
        .filter(cid => clusterGroups[cid].length > 1)
        .map(cid => {
            const reports = clusterGroups[cid];
            const avgLat = reports.reduce((sum, r) => sum + r.lat, 0) / reports.length;
            const avgLng = reports.reduce((sum, r) => sum + r.lng, 0) / reports.length;
            return { id: cid, lat: avgLat, lng: avgLng, count: reports.length, dept: reports[0].department };
        });

    // Smart Centering: Prioritize valid data points over default center
    const defaultCenter = [12.9716, 77.5946]; 
    const center = validComplaints.length > 0 
        ? [validComplaints[0].lat, validComplaints[0].lng] 
        : (userLocation || defaultCenter);

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-[550px] rounded-[3rem] overflow-hidden shadow-2xl border-[10px] border-white bg-slate-100 relative group"
        >
            <MapContainer 
                center={center} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* Hotspot Cluster Centroid Pins */}
                {hotspotPoints.map((p) => (
                    <Marker key={`hotspot-${p.id}`} position={[p.lat, p.lng]} icon={hotspotIcon}>
                        <Popup>
                            <div className="p-3">
                                <p className="text-[10px] font-black text-brand-orange uppercase tracking-widest mb-1">High Density Hotspot</p>
                                <h4 className="font-bold text-slate-900">{p.count} Similar Reports Found</h4>
                                <p className="text-xs text-slate-500 font-medium">Primarily: {p.dept}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Individual Complaint Pins (Red & Big) */}
                {validComplaints.map((c) => (
                    <Marker key={c._id} position={[c.lat, c.lng]} icon={redPremiumPin}>
                        <Popup>
                            <div className="p-2">
                                <h4 className="font-bold text-slate-800">{c.title}</h4>
                                <p className="text-xs text-slate-500 uppercase font-black">{c.department} • {c.priority}</p>
                                <p className="text-[10px] mt-2 text-slate-400 font-medium">{c.location}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Premium Overlay UI */}
            <div className="absolute top-8 left-8 z-[1000] pointer-events-none">
                <div className="bg-white/90 backdrop-blur-xl px-10 py-6 rounded-[3rem] border border-slate-200 shadow-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">City Intelligence</p>
                    <h3 className="text-slate-900 font-black italic tracking-tighter text-2xl leading-none uppercase">JanSetu Overwatch</h3>
                </div>
            </div>

            <div className="absolute bottom-10 left-10 z-[1000] flex gap-4">
                <div className="bg-white text-slate-900 px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 border border-slate-100">
                    <div className="w-3 h-3 rounded-full bg-red-600 shadow-lg shadow-red-200" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Verified Reports</span>
                </div>
                <div className="bg-orange-500 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">Hotspots</span>
                </div>
            </div>
        </motion.div>
    );
};

export default HotspotMap;
