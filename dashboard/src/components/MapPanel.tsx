'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { motion } from 'framer-motion';
import { ArrowUpRight, Radar, ShieldCheck, Waypoints } from 'lucide-react';

interface GeoNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  role?: 'sensor' | 'relay';
}

interface NdrfCenter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  label?: string;
}

interface ActiveAlert {
  id: string;
  threatLevel?: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  headline?: string;
  gasThreatLabel?: string;
}

interface LatestReading {
  nodeId: string;
  lat: number;
  lng: number;
  address: string;
  accelerationG: number;
  gasRaw: number;
  gasPercent: number;
  quakeIntensity: number;
  motion: boolean;
  tempC: number | null;
  humidity: number | null;
  timestamp: string;
}

interface MapPanelProps {
  nodes: GeoNode[];
  centers: NdrfCenter[];
  activeNodeId?: string | null;
  activeAlert?: ActiveAlert | null;
  latestReading?: LatestReading | null;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface RoutePlan {
  activeNode: GeoNode | null;
  relayA: GeoNode | null;
  relayB: GeoNode | null;
  nearestCenter: NdrfCenter | null;
  path: GeoNode[];
  distanceKm: number;
  tone: 'rose' | 'orange' | 'amber' | 'emerald' | 'sky';
}

const DEFAULT_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const DEFAULT_PADDING = { top: 96, bottom: 104, left: 104, right: 104 };

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function buildBounds(points: Array<{ lat: number; lng: number }>) {
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const latSpan = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.01);
  const lngSpan = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.01);
  const latPad = Math.max(latSpan * 0.18, 0.004);
  const lngPad = Math.max(lngSpan * 0.18, 0.004);

  return {
    minLat: Math.min(...latitudes) - latPad,
    maxLat: Math.max(...latitudes) + latPad,
    minLng: Math.min(...longitudes) - lngPad,
    maxLng: Math.max(...longitudes) + lngPad,
  };
}

function pathData(points: ScreenPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function dotStyle(role: 'sensor' | 'relay' | 'center', active: boolean, tone: RoutePlan['tone']) {
  const accent = {
    rose: 'from-rose-500 to-fuchsia-500',
    orange: 'from-orange-500 to-amber-500',
    amber: 'from-amber-500 to-yellow-500',
    emerald: 'from-emerald-500 to-teal-500',
    sky: 'from-sky-500 to-cyan-500',
  }[tone];

  if (role === 'center') {
    return active
      ? `bg-gradient-to-br ${accent}  `
      : 'bg-gradient-to-br from-slate-300 to-slate-500  ';
  }

  if (role === 'relay') {
    return active
      ? 'bg-gradient-to-br from-sky-500 to-blue-500  '
      : 'bg-gradient-to-br from-sky-300 to-sky-400  ';
  }

  return active
    ? `bg-gradient-to-br ${accent}  `
    : 'bg-gradient-to-br from-slate-400 to-slate-500  ';
}

export default function MapPanel({ nodes, centers, activeNodeId, activeAlert, latestReading }: MapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapTick, setMapTick] = useState(0);
  const [mapSize, setMapSize] = useState({ width: 1, height: 1 });

  const route = useMemo<RoutePlan>(() => {
    const activeNode =
      nodes.find((node) => node.id === activeNodeId) ||
      nodes.find((node) => node.id === latestReading?.nodeId) ||
      nodes[0] ||
      null;

    const nearestCenter = activeNode
      ? [...centers].sort((a, b) => distanceKm(activeNode, a) - distanceKm(activeNode, b))[0] || null
      : centers[0] || null;

    const relayCandidates = nodes.filter((node) => node.id !== activeNode?.id);
    const midpoint = activeNode && nearestCenter
      ? {
          lat: (activeNode.lat + nearestCenter.lat) / 2,
          lng: (activeNode.lng + nearestCenter.lng) / 2,
        }
      : null;

    const relayA = midpoint
      ? [...relayCandidates].sort((a, b) => distanceKm(a, midpoint) - distanceKm(b, midpoint))[0] || null
      : relayCandidates[0] || null;

    const relayB = relayA
      ? relayCandidates
          .filter((node) => node.id !== relayA.id)
          .sort((a, b) => (nearestCenter ? distanceKm(a, nearestCenter) - distanceKm(b, nearestCenter) : 0))[0] || null
      : null;

    const path = [activeNode, relayA, relayB, nearestCenter].filter(Boolean) as GeoNode[] | NdrfCenter[];
    const routeDistance = path.reduce((sum, point, index) => {
      if (index === 0) return sum;
      const prev = path[index - 1];
      return sum + distanceKm(prev, point);
    }, 0);

    const level = activeAlert?.threatLevel ?? 'GREEN';
    const tone: RoutePlan['tone'] =
      level === 'RED'
        ? 'rose'
        : level === 'ORANGE'
          ? 'orange'
          : level === 'YELLOW'
            ? 'amber'
            : activeAlert
              ? 'emerald'
              : 'sky';

    return {
      activeNode,
      relayA,
      relayB,
      nearestCenter,
      path: path as GeoNode[],
      distanceKm: routeDistance,
      tone,
    };
  }, [activeAlert, activeNodeId, centers, latestReading, nodes]);

  const allPoints = useMemo(() => [...nodes, ...centers], [centers, nodes]);
  const bounds = useMemo(() => buildBounds(allPoints), [allPoints]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DEFAULT_STYLE,
      center: [nodes[0]?.lng ?? 74.856, nodes[0]?.lat ?? 12.914],
      zoom: 11.8,
      pitch: 46,
      bearing: -14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const syncFrame = () => setMapTick((value) => value + 1);

    map.on('load', () => {
      setMapReady(true);
      syncFrame();

      const boundsToFit = new maplibregl.LngLatBounds(
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat]
      );
      map.fitBounds(boundsToFit, {
        padding: DEFAULT_PADDING,
        duration: 0,
        maxZoom: 13.5,
      });
    });

    map.on('move', syncFrame);
    map.on('zoom', syncFrame);
    map.on('rotate', syncFrame);
    map.on('pitch', syncFrame);
    map.on('resize', syncFrame);

    mapInstanceRef.current = map;

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, [bounds, mapReady, nodes]);

  useEffect(() => {
    const element = mapContainerRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setMapSize({ width: Math.max(width, 1), height: Math.max(height, 1) });
      mapInstanceRef.current?.resize();
      setMapTick((value) => value + 1);
    });

    resizeObserver.observe(element);
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      if (resizeObserverRef.current === resizeObserver) {
        resizeObserverRef.current = null;
      }
    };
  }, []);

  const projected = useMemo(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) {
      return new Map<string, ScreenPoint>();
    }

    const pointMap = new Map<string, ScreenPoint>();
    nodes.forEach((node) => {
      const projectedPoint = map.project([node.lng, node.lat]);
      pointMap.set(node.id, { x: projectedPoint.x, y: projectedPoint.y });
    });
    centers.forEach((center) => {
      const projectedPoint = map.project([center.lng, center.lat]);
      pointMap.set(center.id, { x: projectedPoint.x, y: projectedPoint.y });
    });
    return pointMap;
  }, [centers, mapReady, mapTick, nodes]);

  const activeToneColor =
    route.tone === 'rose'
      ? '#e11d48'
      : route.tone === 'orange'
        ? '#f97316'
        : route.tone === 'amber'
          ? '#d97706'
          : route.tone === 'emerald'
            ? '#059669'
            : '#0284c7';

  const currentMap = mapInstanceRef.current;
  const routePoints = route.path
    .map((point) => projected.get(point.id))
    .filter(Boolean) as ScreenPoint[];

  const pathD = routePoints.length > 1 ? pathData(routePoints) : '';
  const activeNodePoint = route.activeNode ? projected.get(route.activeNode.id) : null;
  const centerPoint = route.nearestCenter ? projected.get(route.nearestCenter.id) : null;
  const relayPoint = route.relayA ? projected.get(route.relayA.id) : null;
  const relayPointB = route.relayB ? projected.get(route.relayB.id) : null;

  const mappedNodes = nodes.map((node) => ({
    ...node,
    point: projected.get(node.id) || { x: 0, y: 0 },
    distanceToCenter: route.nearestCenter ? distanceKm(node, route.nearestCenter) : 0,
  }));

  const mappedCenters = centers.map((center) => ({
    ...center,
    point: projected.get(center.id) || { x: 0, y: 0 },
    distanceToNode: route.activeNode ? distanceKm(route.activeNode, center) : 0,
  }));

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-slate-200/10 neo-inner0  ">
      <div ref={mapContainerRef} className="absolute inset-0" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.20),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(244,63,94,0.14),transparent_26%)]" />

      <svg
        width={mapSize.width}
        height={mapSize.height}
        viewBox={`0 0 ${mapSize.width} ${mapSize.height}`}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="meshStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={activeToneColor} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.8 0 1 0 0 0.2 0 0 1 0 0.3 0 0 0 18 -7"
            />
          </filter>
        </defs>

        {routePoints.length > 1 && (
          <>
            <motion.path
              d={pathD}
              fill="none"
              stroke="url(#meshStroke)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="16 18"
              animate={{ strokeDashoffset: [0, -180] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              filter="url(#glow)"
              opacity="0.96"
            />
            <path
              d={pathD}
              fill="none"
              stroke={activeToneColor}
              strokeOpacity="0.18"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-6 top-6 rounded-full border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 shadow-lg  ">
          Real geospatial mesh overlay
        </div>

        <div className="absolute right-6 top-6 w-[340px] rounded-[24px] border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 p-4    ">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-sky-600">Route summary</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {route.activeNode?.id ?? 'No active node'} to nearest NDRF center
              </div>
            </div>
            <div className="rounded-full neo-inner bg-[#e0e5ec] text-slate-800 p-2 text-sky-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 p-3 text-xs leading-5 text-slate-700">
            {activeAlert ? (
              <>
                {activeAlert.headline || 'Incoming event'} routed through the mesh with a relay hop sequence and final handoff to the closest NDRF center.
              </>
            ) : (
              <>
                No active crisis. The mesh is ready and the nearest center will light up as soon as a node triggers.
              </>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.18em] text-sky-700">
            <div className="rounded-xl border border-slate-200/50 bg-sky-500/10 px-3 py-2">Node</div>
            <div className="rounded-xl border border-slate-200/50 bg-cyan-500/10 px-3 py-2">Mesh relay</div>
            <div className="rounded-xl border border-slate-200/50 bg-emerald-500/10 px-3 py-2">NDRF center</div>
          </div>
        </div>

        {mappedCenters.map((center) => {
        const isNearest = route.nearestCenter?.id === center.id;
        return (
          <div
            key={center.id}
            className="absolute"
            style={{ left: `${center.point.x}px`, top: `${center.point.y}px` }}
          >
            <motion.div
              animate={{ scale: isNearest ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute -left-5 -top-5 h-10 w-10 rounded-full ${isNearest ? 'bg-emerald-500/18' : 'bg-slate-400/10'}`}
            />
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-950   ${dotStyle('center', isNearest, route.tone)}`}>
              <ShieldCheck className="h-4 w-4 text-slate-900 drop-shadow" />
            </div>
            <div className="mt-2 min-w-[150px] -translate-x-1/2 rounded-2xl border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 px-3 py-2 text-center text-[11px] font-semibold text-slate-900 shadow-lg  ">
              <div>{center.name}</div>
              <div className="mt-1 text-[10px] font-normal uppercase tracking-[0.16em] text-sky-600">
                {isNearest ? 'Nearest NDRF center' : center.label ?? 'NDRF center'}
              </div>
            </div>
          </div>
        );
        })}

        {mappedNodes.map((node) => {
        const isActive = route.activeNode?.id === node.id;
        const isRelay = route.relayA?.id === node.id || route.relayB?.id === node.id;
        const role = isRelay ? 'relay' : 'sensor';
        const markerTone: RoutePlan['tone'] = isActive ? route.tone : 'sky';
        const point = node.point;

        return (
          <div
            key={node.id}
            className="absolute"
            style={{ left: `${point.x}px`, top: `${point.y}px` }}
          >
            {isActive && (
              <motion.div
                animate={{ scale: [1, 2.4, 1], opacity: [0.45, 0.1, 0.45] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className={`absolute -left-8 -top-8 h-16 w-16 rounded-full ${route.tone === 'rose' ? 'bg-rose-400/35' : route.tone === 'orange' ? 'bg-orange-400/30' : route.tone === 'amber' ? 'bg-amber-400/30' : 'bg-emerald-400/26'}`}
              />
            )}

            <div className={`relative flex h-6 w-6 items-center justify-center rounded-full border-4 border-slate-950   ${dotStyle(role, isActive, markerTone)}`} />

            <div className="mt-2 min-w-[160px] -translate-x-1/2 rounded-2xl border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 px-3 py-2 text-center text-[11px] font-semibold text-slate-900 shadow-lg  ">
              <div className="flex items-center justify-center gap-2">
                <span>{node.id}</span>
                <span className="rounded-full neo-inner bg-[#e0e5ec] text-slate-800 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-sky-700">
                  {isActive ? 'Trigger' : isRelay ? 'Relay' : 'Sensor'}
                </span>
              </div>
              <div className="mt-1 font-normal text-slate-700">{node.name}</div>
              <div className="mt-1 text-[10px] font-normal uppercase tracking-[0.16em] text-sky-600">
                {route.nearestCenter ? `${node.distanceToCenter.toFixed(2)} km from nearest center` : 'Mesh ready'}
              </div>
            </div>
          </div>
        );
        })}

        <div className="absolute bottom-6 left-6 right-6 grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <div className="rounded-[24px] border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 p-4    ">
            <div className="text-[11px] uppercase tracking-[0.24em] text-sky-600">Active node</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{route.activeNode?.name ?? 'Standby'}</div>
            <div className="mt-1 text-sm text-slate-700">
              {route.activeNode ? `${route.distanceKm.toFixed(2)} km routed to ${route.nearestCenter?.name ?? 'NDRF center'}` : 'Waiting for telemetry trigger'}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 p-4    ">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-700">Mesh hops</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {route.path.length > 1 ? `${route.path.length - 1} hops` : 'No active route'}
            </div>
            <div className="mt-1 text-sm text-slate-700">
              {route.relayB ? `${route.relayA?.id} → ${route.relayB?.id} → NDRF` : route.relayA ? `${route.relayA.id} → NDRF` : 'Relay chain will appear on trigger'}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 p-4    ">
            <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-700">Status</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {activeAlert ? `${activeAlert.threatLevel} response` : 'Mesh standing by'}
            </div>
            <div className="mt-1 text-sm text-slate-700">
              {activeAlert ? 'Packets are flowing to the closest NDRF center.' : 'No live crisis path has been activated yet.'}
            </div>
          </div>
        </div>

        {mapReady && activeNodePoint && centerPoint && (
          <>
            <motion.div
              className="absolute h-4 w-4 rounded-full bg-white  "
              style={{ left: activeNodePoint.x - 8, top: activeNodePoint.y - 8 }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0.2, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute h-4 w-4 rounded-full bg-emerald-300  "
              style={{ left: centerPoint.x - 8, top: centerPoint.y - 8 }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.24, 0.8] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {relayPoint && (
              <motion.div
                className="absolute h-3.5 w-3.5 rounded-full bg-sky-300  "
                style={{ left: relayPoint.x - 7, top: relayPoint.y - 7 }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.75, 0.25, 0.75] }}
                transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut', delay: 0.18 }}
              />
            )}
            {relayPointB && (
              <motion.div
                className="absolute h-3.5 w-3.5 rounded-full bg-cyan-300  "
                style={{ left: relayPointB.x - 7, top: relayPointB.y - 7 }}
                animate={{ scale: [1, 1.35, 1], opacity: [0.75, 0.22, 0.75] }}
                transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: 0.32 }}
              />
            )}
          </>
        )}

        {!mapReady && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="rounded-[28px] border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 px-6 py-5    ">
              <div className="text-[11px] uppercase tracking-[0.24em] text-sky-600">Loading map</div>
              <div className="mt-2 text-sm text-slate-700">Initializing real map tiles and mesh overlays.</div>
            </div>
          </div>
        )}

        <div className="absolute bottom-[18px] left-6 flex items-center gap-3 rounded-full border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-lg  ">
          <Radar className="h-4 w-4 text-sky-600" />
          {currentMap ? 'MapLibre base layer active' : 'Preparing map base layer'}
          <span className="rounded-full neo-inner bg-[#e0e5ec] text-slate-800 px-2 py-1 text-[10px] tracking-[0.18em] text-slate-900">
            {route.activeNode ? `${route.path.length - 1} hops` : 'standby'}
          </span>
        </div>

        <div className="absolute bottom-[18px] right-6 rounded-full border border-slate-200/50 neo-inner bg-[#e0e5ec] text-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-lg  ">
          <Waypoints className="mr-2 inline h-4 w-4 text-cyan-700" />
          {route.nearestCenter?.name ?? 'NDRF center ready'}
        </div>
      </div>
    </div>
  );
}
