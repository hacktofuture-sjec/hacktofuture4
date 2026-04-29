'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface NeoMapProps {
  simulationStage: number; 
}

const NODES = {
  'NM-01': [12.9141, 74.8560], // Trigger
  'NM-02': [12.9280, 74.8734], // Relay
  'NM-03': [12.9089, 74.8901], // Relay
  'NM-04': [12.8956, 74.8723], // Relay
  'NDRF': [12.8700, 74.8400]   // Command Post
};

function getMarkerHtml(state: 'normal'|'alert'|'relay'|'ndrf') {
  const color = state === 'alert' ? '#FF6B6B' : state === 'relay' ? '#FFE66D' : state === 'ndrf' ? '#A855F7' : '#4ECDC4';
  const size = state === 'ndrf' ? 24 : 16;
  const pulse = state === 'alert' ? `<div class="absolute inset-0 rounded-full animate-pulse-ring" style="background:${color}"></div>` : '';
  
  if (state === 'ndrf') {
    return `<div class="relative w-6 h-6 flex items-center justify-center">
      ${pulse}
      <svg viewBox="0 0 24 24" class="w-full h-full relative z-10" fill="${color}"><path d="M12 2L2 9l3.5 11h13L22 9z"/></svg>
    </div>`;
  }
  return `<div class="relative w-4 h-4 flex items-center justify-center">
    ${pulse}
    <div class="w-full h-full rounded-full relative z-10 shadow-[2px_2px_4px_#c5cad0,-2px_-2px_4px_#ffffff]" style="background:${color}"></div>
  </div>`;
}

export default function NeoMap({ simulationStage }: NeoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletApp = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || leafletApp.current) return;
    
    // Initialize map
    const map = L.map(mapRef.current, {
      center: [12.9141, 74.8560],
      zoom: 13,
      zoomControl: false,
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Setup markers
    const markers: any = {};
    markers['NM-01'] = L.marker(NODES['NM-01'] as L.LatLngExpression, { icon: L.divIcon({ html: getMarkerHtml('normal'), className: '' }) }).addTo(map);
    markers['NM-02'] = L.marker(NODES['NM-02'] as L.LatLngExpression, { icon: L.divIcon({ html: getMarkerHtml('normal'), className: '' }) }).addTo(map);
    markers['NM-03'] = L.marker(NODES['NM-03'] as L.LatLngExpression, { icon: L.divIcon({ html: getMarkerHtml('normal'), className: '' }) }).addTo(map);
    markers['NM-04'] = L.marker(NODES['NM-04'] as L.LatLngExpression, { icon: L.divIcon({ html: getMarkerHtml('normal'), className: '' }) }).addTo(map);
    markers['NDRF'] = L.marker(NODES['NDRF'] as L.LatLngExpression, { icon: L.divIcon({ html: getMarkerHtml('ndrf'), className: '' }) }).addTo(map);

    // SVG Overlay for lines
    const svgOverlay = L.svg();
    svgOverlay.addTo(map);
    const svgRoot = map.getPanes().overlayPane.querySelector('svg');
    if (svgRoot) {
      svgRoot.innerHTML = `
        <g id="mesh-lines" stroke-width="4" stroke-linecap="round" fill="none" style="filter: drop-shadow(0px 0px 4px rgba(0,0,0,0.2));"></g>
      `;
    }

    leafletApp.current = { map, markers, lines: [] };

    return () => {
      map.remove();
      leafletApp.current = null;
    };
  }, []);

  // Handle Animation Stages
  useEffect(() => {
    if (!leafletApp.current) return;
    const { map, markers, lines } = leafletApp.current;
    const g = map.getPanes().overlayPane.querySelector('#mesh-lines');
    if (!g) return;

    if (simulationStage === 0) {
      markers['NM-01'].setIcon(L.divIcon({ html: getMarkerHtml('normal'), className: '' }));
      markers['NM-02'].setIcon(L.divIcon({ html: getMarkerHtml('normal'), className: '' }));
      markers['NM-03'].setIcon(L.divIcon({ html: getMarkerHtml('normal'), className: '' }));
      markers['NM-04'].setIcon(L.divIcon({ html: getMarkerHtml('normal'), className: '' }));
      markers['NDRF'].setIcon(L.divIcon({ html: getMarkerHtml('ndrf'), className: '' }));
      lines.forEach((l: any) => l.remove());
      leafletApp.current.lines = [];
      g.innerHTML = '';
      return;
    }

    const drawLine = (fromNode: string, toNode: string, color: string) => {
      const from = map.latLngToLayerPoint(NODES[fromNode as keyof typeof NODES]);
      const to = map.latLngToLayerPoint(NODES[toNode as keyof typeof NODES]);
      const lineHtml = `<path d="M${from.x} ${from.y} L${to.x} ${to.y}" stroke="${color}" class="animate-dash-line" opacity="0.8" />`;
      g.innerHTML += lineHtml;
      
      const polyline = L.polyline([NODES[fromNode as keyof typeof NODES] as L.LatLngExpression, NODES[toNode as keyof typeof NODES] as L.LatLngExpression], {
        color: color, weight: 0, opacity: 0 // Invisible logical line
      }).addTo(map);
      leafletApp.current.lines.push(polyline);
    };

    if (simulationStage >= 1) {
      markers['NM-01'].setIcon(L.divIcon({ html: getMarkerHtml('alert'), className: '' }));
    }
    if (simulationStage >= 2) {
      drawLine('NM-01', 'NM-02', '#FF6B6B');
    }
    if (simulationStage >= 3) {
      markers['NM-02'].setIcon(L.divIcon({ html: getMarkerHtml('relay'), className: '' }));
      drawLine('NM-02', 'NM-03', '#FFE66D');
    }
    if (simulationStage >= 4) {
      markers['NM-03'].setIcon(L.divIcon({ html: getMarkerHtml('relay'), className: '' }));
      drawLine('NM-03', 'NM-04', '#FFE66D');
    }
    if (simulationStage >= 5) {
      markers['NM-04'].setIcon(L.divIcon({ html: getMarkerHtml('relay'), className: '' }));
      drawLine('NM-04', 'NDRF', '#A855F7');
    }
    if (simulationStage >= 6) {
      markers['NDRF'].setIcon(L.divIcon({ html: getMarkerHtml('alert'), className: '' })); // Flash NDRF
    }

    // Bind recalculation
    const updateSVG = () => {
      g.innerHTML = '';
      if (simulationStage >= 2) drawLine('NM-01', 'NM-02', '#FF6B6B');
      if (simulationStage >= 3) drawLine('NM-02', 'NM-03', '#FFE66D');
      if (simulationStage >= 4) drawLine('NM-03', 'NM-04', '#FFE66D');
      if (simulationStage >= 5) drawLine('NM-04', 'NDRF', '#A855F7');
    };

    map.on('moveend zoomend', updateSVG);
    return () => { map.off('moveend zoomend', updateSVG); };

  }, [simulationStage]);

  return (
    <div className="neo-inset h-full w-full relative overflow-hidden z-0">
      <div ref={mapRef} className="absolute inset-0 leaflet-container" style={{ background: 'transparent' }} />
    </div>
  );
}
