'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ServiceNode {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  type: string;
  description: string;
  load: number;
  dependencies: string[];
  icon: React.ReactNode;
  isRootCause?: boolean;
  angle?: number;
  radius?: number;
}

interface OrbitalTopologyProps {
  services: ServiceNode[];
  onNodeSelect?: (nodeId: string | null) => void;
}

export default function OrbitalTopology({ services, onNodeSelect }: OrbitalTopologyProps) {
  const [rotation, setRotation] = useState(0);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-rotation when idle
  useEffect(() => {
    if (selectedNode) return;
    
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.5) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, [selectedNode]);

  // Handle click outside to reset
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedNode(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNodeClick = (nodeId: string) => {
    const nextSelected = nodeId === selectedNode ? null : nodeId;
    setSelectedNode(nextSelected);
    onNodeSelect?.(nextSelected);
  };

  const calculateNodePosition = (node: ServiceNode) => {
    const centerX = 300;
    const centerY = 200;
    const angle = (node.angle || 0) + rotation;
    const radius = node.radius || 150;
    
    const x = centerX + radius * Math.cos((angle * Math.PI) / 180);
    const y = centerY + radius * Math.sin((angle * Math.PI) / 180);
    
    return { x, y };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getConnectionState = (source: ServiceNode, target: ServiceNode): 'neutral' | 'warning' | 'critical' | 'root-cause' => {
    if (source.isRootCause || target.isRootCause) return 'root-cause';
    if (source.status === 'critical' || target.status === 'critical') return 'critical';
    if (source.status === 'warning' || target.status === 'warning') return 'warning';
    return 'neutral';
  };

  return (
    <div ref={containerRef} className="relative w-full h-[400px] bg-black/20 rounded-lg overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 600 400"
        className="absolute inset-0"
      >
        {/* Orbital paths */}
        {services.filter(node => (node.radius || 0) > 0).map(node => (
          <circle
            key={`orbit-${node.id}`}
            cx="300"
            cy="200"
            r={node.radius || 150}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ))}

        {/* Connection lines */}
        {services
          .filter(node => node.dependencies.length > 0)
          .map(node => {
            const fromPos = calculateNodePosition(node);
            return node.dependencies.map(depId => {
              const depNode = services.find(s => s.id === depId);
              if (!depNode) return null;
              const toPos = calculateNodePosition(depNode);
              const connectionState = getConnectionState(node, depNode);
              const isSelectedConnection = selectedNode === node.id || selectedNode === depId;
              const strokeColor =
                connectionState === 'root-cause'
                  ? 'rgba(239, 68, 68, 0.95)'
                  : connectionState === 'critical'
                    ? 'rgba(239, 68, 68, 0.8)'
                    : connectionState === 'warning'
                      ? 'rgba(245, 158, 11, 0.85)'
                      : isSelectedConnection
                        ? 'rgba(59, 130, 246, 0.5)'
                        : 'rgba(255, 255, 255, 0.1)';
              const strokeWidth =
                connectionState === 'root-cause' ? '3' : connectionState === 'critical' ? '2.5' : connectionState === 'warning' ? '2' : isSelectedConnection ? '2' : '1';
              const dash = connectionState === 'neutral' ? undefined : connectionState === 'warning' ? '3 4' : '4 3';
              
              return (
                <line
                  key={`connection-${node.id}-${depId}`}
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  className={connectionState === 'neutral' ? undefined : 'animate-pulse'}
                />
              );
            });
          })}

        {/* Nodes */}
        {services.map(node => {
          const position = calculateNodePosition(node);
          const isSelected = selectedNode === node.id;
          const isHovered = hoveredNode === node.id;
          const isRelated = selectedNode && node.dependencies.includes(selectedNode);
          const isRootCause = Boolean(node.isRootCause);
          
          return (
            <g
              key={node.id}
              transform={`translate(${position.x}, ${position.y})`}
              onClick={() => handleNodeClick(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              {/* Node circle */}
              <circle
                r={isRootCause ? '28' : isSelected ? '25' : isRelated ? '22' : isHovered ? '20' : '18'}
                fill={getStatusColor(node.status)}
                fillOpacity={isRootCause ? '1' : isSelected ? '1' : isRelated ? '0.8' : '0.6'}
                stroke={isRootCause ? '#fee2e2' : isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'}
                strokeWidth={isRootCause ? '3' : isSelected ? '2' : '1'}
                className={`transition-all duration-300 ${isRootCause ? 'animate-pulse' : ''}`}
              />
              
              {/* Node icon placeholder */}
              <text
                x="0"
                y="5"
                textAnchor="middle"
                fill="white"
                fontSize="12"
                className="pointer-events-none"
              >
                {node.name.charAt(0)}
              </text>
              
              {/* Node label */}
              {(node.radius || 0) > 0 && (
                <text
                  x="0"
                  y="35"
                  textAnchor="middle"
                  fill={isSelected ? "#ffffff" : isRelated ? "#93c5fd" : "rgba(255, 255, 255, 0.6)"}
                  fontSize="10"
                  className="pointer-events-none transition-colors duration-300"
                >
                  {node.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Detail card for selected node */}
      {selectedNode && (
        <div className="absolute top-4 right-4 w-64 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-white/10">
          {(() => {
            const node = services.find(s => s.id === selectedNode);
            if (!node) return null;
            
            return (
              <>
                <h3 className="text-white font-semibold mb-2">{node.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={`font-medium ${
                      node.status === 'healthy' ? 'text-green-400' :
                      node.status === 'warning' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {node.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="text-gray-200">{node.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Load:</span>
                    <span className="text-gray-200">{node.load}%</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-gray-400 text-xs">Description:</span>
                    <p className="text-gray-200 text-xs mt-1">{node.description}</p>
                  </div>
                  {node.dependencies.length > 0 && (
                    <div className="mt-3">
                      <span className="text-gray-400 text-xs">Dependencies:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {node.dependencies.map(dep => {
                          const depNode = services.find(s => s.id === dep);
                          return (
                            <span
                              key={dep}
                              className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded"
                            >
                              {depNode?.name || dep}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
