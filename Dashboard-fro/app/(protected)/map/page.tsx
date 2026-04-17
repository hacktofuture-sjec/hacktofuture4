'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchAgentAnalyze, type AgentAnalyzeResponse } from '@/lib/agent-analyze';
import OrbitalTopology from '@/components/ui/orbital-topology';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';

type GraphHealth = 'healthy' | 'warning' | 'critical';

type GraphNode = {
  id: string;
  label: string;
  health: GraphHealth;
  mode: string;
  reachable?: boolean;
  restartCount?: number;
  severity?: string;
  isRootCause: boolean;
  rcaReason?: string;
  decisionAction?: string;
  decisionExplanation?: string;
};

type GraphLink = {
  source: string;
  target: string;
};

const ARCH_LINKS: GraphLink[] = [
  { source: 'frontend', target: 'auth-service' },
  { source: 'frontend', target: 'messaging-service' },
  { source: 'frontend', target: 'presence-service' },
  { source: 'agent-service', target: 'messaging-service' },
  { source: 'agent-service', target: 'auth-service' },
  { source: 'agent-service', target: 'presence-service' },
];

const CORE_SERVICES = new Set(['auth-service', 'messaging-service', 'presence-service']);

const FIXED_NODE_ORDER = ['frontend', 'agent-service', 'auth-service', 'messaging-service', 'presence-service'];

const normalizeServiceId = (value?: string | null) => (value || '').trim().toLowerCase();

const toGraphHealth = (analyze: AgentAnalyzeResponse, serviceName: string, backendHealth?: string, reachable?: boolean): GraphHealth => {
  const normalizedService = normalizeServiceId(serviceName);
  const normalizedHealth = normalizeServiceId(backendHealth);
  const rootCause = normalizeServiceId(analyze.rca?.rootCause);
  const restartCount = analyze.kubernetesSignals?.restartCount ?? 0;
  const isMessagingOverload = Boolean(analyze.kubernetesSignals?.resourceOverload) && normalizedService === 'messaging-service';

  if (isMessagingOverload) return 'critical';
  if (rootCause && rootCause === normalizedService) return 'critical';
  if (reachable === false) return 'critical';
  if (normalizedHealth.includes('critical') || normalizedHealth.includes('down') || normalizedHealth.includes('error') || normalizedHealth.includes('crash')) {
    return 'critical';
  }
  if (normalizedHealth.includes('degraded') || normalizedHealth.includes('warning') || normalizedHealth.includes('latency')) {
    return 'warning';
  }
  if (restartCount >= 1) return 'warning';

  return 'healthy';
};

function transformBackendToGraph(data: AgentAnalyzeResponse): { nodes: GraphNode[]; links: GraphLink[] } {
  const monitorServices = (data.monitoring?.services ?? []).filter((service) => {
    const id = normalizeServiceId(service.service);
    return CORE_SERVICES.has(id) || id === 'agent-service';
  });
  const rootCause = normalizeServiceId(data.rca?.rootCause);
  const restartCount = data.kubernetesSignals?.restartCount;
  const hasCoreService = monitorServices.some((service) => CORE_SERVICES.has(normalizeServiceId(service.service)));

  const dynamicNodes: GraphNode[] = monitorServices.map((service) => {
    const id = normalizeServiceId(service.service);
    const health = toGraphHealth(data, service.service, service.health, service.reachable);
    return {
      id,
      label: service.service,
      health,
      mode: service.mode || 'unknown',
      reachable: service.reachable,
      restartCount,
      severity: data.rca?.severity,
      isRootCause: rootCause === id,
      rcaReason: rootCause === id ? data.rca?.reason : undefined,
      decisionAction: data.decision?.target && normalizeServiceId(data.decision.target) === id ? data.decision.action : undefined,
      decisionExplanation:
        data.decision?.target && normalizeServiceId(data.decision.target) === id ? data.decision.explanation : undefined,
    };
  });

  const nodesById = new Map<string, GraphNode>();
  dynamicNodes.forEach((node) => nodesById.set(node.id, node));

  if (hasCoreService && !nodesById.has('frontend')) {
    nodesById.set('frontend', {
      id: 'frontend',
      label: 'frontend',
      health: data.decision?.actionNeeded ? 'warning' : 'healthy',
      mode: 'ui',
      reachable: true,
      restartCount,
      severity: data.rca?.severity,
      isRootCause: rootCause === 'frontend',
      rcaReason: rootCause === 'frontend' ? data.rca?.reason : undefined,
      decisionAction:
        data.decision?.target && normalizeServiceId(data.decision.target) === 'frontend' ? data.decision.action : undefined,
      decisionExplanation:
        data.decision?.target && normalizeServiceId(data.decision.target) === 'frontend' ? data.decision.explanation : undefined,
    });
  }

  if (hasCoreService && !nodesById.has('agent-service')) {
    nodesById.set('agent-service', {
      id: 'agent-service',
      label: 'agent-service',
      health: toGraphHealth(data, 'agent-service', 'healthy', true),
      mode: 'active',
      reachable: true,
      restartCount,
      severity: data.rca?.severity,
      isRootCause: rootCause === 'agent-service',
      rcaReason: rootCause === 'agent-service' ? data.rca?.reason : undefined,
      decisionAction:
        data.decision?.target && normalizeServiceId(data.decision.target) === 'agent-service' ? data.decision.action : undefined,
      decisionExplanation:
        data.decision?.target && normalizeServiceId(data.decision.target) === 'agent-service' ? data.decision.explanation : undefined,
    });
  }

  const nodes = FIXED_NODE_ORDER.map((id) => nodesById.get(id)).filter((node): node is GraphNode => Boolean(node));
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const links = ARCH_LINKS.filter((link) => nodeIdSet.has(link.source) && nodeIdSet.has(link.target));

  return { nodes, links };
}

export default function DependencyMapPage() {
  const [analyze, setAnalyze] = useState<AgentAnalyzeResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const next = await fetchAgentAnalyze();
        if (!isMounted) return;
        setAnalyze(next);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to fetch dependency data';
        setError(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const graph = useMemo(() => transformBackendToGraph(analyze ?? { success: false }), [analyze]);

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    graph.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [graph.nodes]);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;

  const serviceData = useMemo(() => {
    const dynamicNodes = graph.nodes;
    const dependenciesBySource = new Map<string, string[]>();
    graph.links.forEach((link) => {
      const next = dependenciesBySource.get(link.source) ?? [];
      next.push(link.target);
      dependenciesBySource.set(link.source, next);
    });

    return [
      {
        id: 'central',
        name: 'Core Platform',
        status: 'healthy' as const,
        type: 'central',
        description: 'Central service orchestrator and API gateway',
        load: 90,
        dependencies: [],
        icon: null,
        angle: 0,
        radius: 0,
      },
      ...dynamicNodes.map((node, index) => ({
        id: node.id,
        name: node.label,
        status: node.health,
        type: 'service',
        description: `${node.label} - ${node.mode}${node.reachable === false ? ' (unreachable)' : ''}`,
        load: node.health === 'critical' ? 95 : node.health === 'warning' ? 75 : 55,
        dependencies: dependenciesBySource.get(node.id) ?? [],
        icon: null,
        isRootCause: node.isRootCause,
        angle: (index * 45) % 360,
        radius: 150,
      })),
    ];
  }, [graph.links, graph.nodes]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Service Dependency Map</h1>
          <p className="text-gray-600 dark:text-white/60">Interactive topology showing microservice relationships and health status</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Network Graph */}
          <InternalGlassPanel className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Service Topology</h2>
            <OrbitalTopology services={serviceData} onNodeSelect={setSelectedNodeId} />
          </InternalGlassPanel>

          {/* Deep-Dive Panel */}
          <InternalGlassPanel className="lg:col-span-2">
            {selectedNode ? (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedNode.label}</h2>

                {/* Service Details */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Status</p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          selectedNode.health === 'healthy'
                            ? 'bg-green-500'
                            : selectedNode.health === 'warning'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{selectedNode.health}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Mode</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedNode.mode}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Reachable</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {typeof selectedNode.reachable === 'boolean' ? (selectedNode.reachable ? 'true' : 'false') : 'N/A'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Restart Count</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedNode.restartCount ?? 'N/A'}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Severity</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{selectedNode.severity ?? 'N/A'}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Root Cause</p>
                    <p className={`text-sm font-semibold ${selectedNode.isRootCause ? 'text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {selectedNode.isRootCause ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                {/* Dependencies */}
                <div className="border-t border-border/30 pt-4">
                  <p className="text-xs text-gray-600 dark:text-white/60 mb-3">Downstream Dependencies</p>
                  <div className="space-y-2">
                    {(graph.links.filter((link) => link.source === selectedNode.id).map((link) => link.target)).map((dep) => (
                        <div key={dep} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0B1220]/50 p-2">
                          <span className="text-sm text-gray-900 dark:text-white">{dep}</span>
                          <span className="text-xs text-gray-600 dark:text-white/60">{nodeById.get(dep)?.health ?? 'unknown'}</span>
                        </div>
                      ))}
                    {graph.links.filter((link) => link.source === selectedNode.id).length === 0 && (
                      <p className="text-xs text-gray-600 dark:text-white/60">No dependencies</p>
                    )}
                  </div>
                </div>

                {/* AI Diagnostic */}
                <InternalGlassPanel density="compact" className="border-primary/20 bg-black/25">
                  <p className="mb-2 text-xs font-semibold text-primary">AI Diagnostic Summary</p>
                  <p className="text-xs text-gray-600 dark:text-white/60">
                    {selectedNode.rcaReason || selectedNode.decisionExplanation || 'No RCA summary available for this node.'}
                  </p>
                  {selectedNode.decisionAction && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
                      Action: <span className="font-semibold text-gray-900 dark:text-white">{selectedNode.decisionAction}</span>
                    </p>
                  )}
                </InternalGlassPanel>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 dark:text-white/60">
                {loading ? 'Loading dependency map...' : error ? `Unable to refresh map: ${error}` : 'Click a node to view details'}
              </div>
            )}
          </InternalGlassPanel>
        </div>

        {/* All Services List */}
        <InternalGlassPanel>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">All Services</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {graph.nodes.map((service) => (
              <InternalGlassPanel
                key={service.id}
                density="compact"
                className="cursor-pointer transition-all hover:shadow-[0_10px_36px_rgba(0,0,0,0.34)]"
                onClick={() => setSelectedNodeId(service.id)}
              >
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{service.label}</h3>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.health === 'healthy'
                        ? 'bg-green-500'
                        : service.health === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <p className="text-gray-600 dark:text-white/60">Health: <span className="font-semibold text-gray-900 dark:text-white capitalize">{service.health}</span></p>
                  <p className="text-gray-600 dark:text-white/60">Mode: <span className="font-semibold text-gray-900 dark:text-white">{service.mode}</span></p>
                  <p className="text-gray-600 dark:text-white/60">Restarts: <span className="font-semibold text-gray-900 dark:text-white">{service.restartCount ?? 'N/A'}</span></p>
                </div>
              </InternalGlassPanel>
            ))}
          </div>
        </InternalGlassPanel>
      </div>
    </div>
  );
}
