'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

// Fix for default marker icons in Leaflet with Next.js
// Custom high-tech marker function
const createCustomIcon = (isActive: boolean) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full ${isActive ? 'bg-rose-500/30 animate-ping' : 'bg-slate-500/10'}"></div>
        <div class="relative w-3 h-3 rounded-full border-2 ${isActive ? 'bg-rose-500 border-white shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-slate-600 border-slate-400'}"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

interface MapComponentProps {
  nodes: { id: string; name: string; lat: number; lng: number }[];
  activeNodeId: string | null;
  onNodeClick: (id: string) => void;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

export default function MapComponent({ nodes, activeNodeId, onNodeClick }: MapComponentProps) {
  const activeNode = nodes.find(n => n.id === activeNodeId);
  const center: [number, number] = activeNode ? [activeNode.lat, activeNode.lng] : [12.87, 74.84];

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-slate-800/50">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="w-full h-full opacity-90 contrast-125"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=9efec34f-bb10-4719-b002-c15d7ba74f82"
        />
        
        {nodes.map((node) => (
          <Marker 
            key={node.id} 
            position={[node.lat, node.lng]} 
            icon={createCustomIcon(node.id === activeNodeId)}
            eventHandlers={{
              click: () => onNodeClick(node.id),
            }}
          >
            <Popup className="custom-popup">
              <div className="p-2 bg-slate-900 text-white rounded font-sans uppercase tracking-widest text-[10px]">
                <strong className="text-emerald-400">{node.id}</strong><br />
                {node.name}
              </div>
            </Popup>
          </Marker>
        ))}

        {activeNode && <ChangeView center={[activeNode.lat, activeNode.lng]} />}
      </MapContainer>

      {/* Overlay for aesthetic blending */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] z-[400]" />
    </div>
  );
}
