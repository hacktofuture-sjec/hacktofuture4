import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';

// Custom Large Red Premium Pin
const redPremiumPin = L.divIcon({
    className: 'custom-pin',
    html: `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 sm:w-12 sm:h-12 bg-red-500/20 rounded-full animate-ping"></div>
            <div class="w-4 h-4 sm:w-5 sm:h-5 bg-red-600 rounded-full border-[3px] sm:border-[4px] border-white shadow-2xl scale-125"></div>
            <div class="absolute bottom-[-6px] w-[2px] h-2 bg-red-600 rounded-full"></div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

// Custom Hotspot/Trend Pin (Orange)
const hotspotIcon = L.divIcon({
    className: 'hotspot-pin',
    html: `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 sm:w-14 sm:h-14 bg-orange-500/20 rounded-full animate-pulse"></div>
            <div class="w-5 h-5 sm:w-7 sm:h-7 bg-orange-500 rounded-full border-[3px] sm:border-[5px] border-white shadow-2xl scale-110 flex items-center justify-center">
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
            <div class="absolute bottom-[-8px] w-1 h-3 bg-orange-500 rounded-full shadow-lg"></div>
        </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
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
            className="w-full h-[340px] sm:h-[460px] lg:h-[520px] rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-xl border-4 sm:border-8 border-white bg-slate-100 relative group isolate z-0"
        >
            <MapContainer 
                center={center} 
                zoom={13} 
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
                            <div className="p-2">
                                <p className="text-[9px] font-black text-brand-orange uppercase tracking-wider mb-0.5">High Density Hotspot</p>
                                <h4 className="font-bold text-xs text-slate-900">{p.count} Similar Reports</h4>
                                <p className="text-[10px] text-slate-500 font-medium">{p.dept}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Individual Complaint Pins */}
                {validComplaints.map((c) => (
                    <Marker key={c._id} position={[c.lat, c.lng]} icon={redPremiumPin}>
                        <Popup>
                            <div className="p-2">
                                <h4 className="font-bold text-xs text-slate-800">{c.title}</h4>
                                <p className="text-[10px] text-slate-500 uppercase font-black">{c.department} • {c.priority}</p>
                                <p className="text-[9px] mt-1 text-slate-400 font-medium truncate max-w-[180px]">{c.location}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Overlay UI Badges */}
            <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-20 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-lg">
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 sm:mb-1">City Intelligence</p>
                    <h3 className="text-slate-900 font-black tracking-tight text-xs sm:text-base leading-none uppercase">JanSetu Radar</h3>
                </div>
            </div>

            <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 z-20 flex gap-2 sm:gap-3 pointer-events-none">
                <div className="bg-white/95 text-slate-900 px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg sm:rounded-xl shadow-md flex items-center gap-1.5 sm:gap-2 border border-slate-200">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-600" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Reports</span>
                </div>
                <div className="bg-orange-500/95 text-white px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg sm:rounded-xl shadow-md flex items-center gap-1.5 sm:gap-2">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Hotspots</span>
                </div>
            </div>
        </motion.div>
    );
};

export default HotspotMap;
