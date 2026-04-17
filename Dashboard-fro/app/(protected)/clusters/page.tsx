'use client';

import React from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { Cloud, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';

export default function ClustersPage() {
  const store = useAppStore();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Multi-Cluster Management</h1>
          <p className="text-gray-600 dark:text-white/60">Enterprise-scale Kubernetes management across multiple cloud providers</p>
        </div>

        {/* Global Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InternalGlassPanel>
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Total Clusters</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{store.clusters.length}</p>
          </InternalGlassPanel>
          <InternalGlassPanel>
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Total Services</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {store.clusters.reduce((sum, c) => sum + c.services, 0)}
            </p>
          </InternalGlassPanel>
          <InternalGlassPanel>
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Total Nodes</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {store.clusters.reduce((sum, c) => sum + c.nodeCount, 0)}
            </p>
          </InternalGlassPanel>
        </div>

        {/* Cluster Overviews */}
        <div>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Cluster Overviews</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {store.clusters.map((cluster) => (
              <InternalGlassPanel key={cluster.id}>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{cluster.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Cloud className="h-4 w-4 text-gray-600 dark:text-white/60" />
                      <p className="text-xs text-gray-600 dark:text-white/60 capitalize">{cluster.provider}</p>
                    </div>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      cluster.health === 'healthy'
                        ? 'bg-green-500'
                        : cluster.health === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                </div>

                <div className="space-y-3 mb-4 pb-4 border-b border-border/30">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Region</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{cluster.region}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Services</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{cluster.services}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Nodes</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{cluster.nodeCount}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-gray-600 dark:text-white/60">CPU Avg</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{cluster.averageCpu}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${cluster.averageCpu}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-gray-600 dark:text-white/60">Memory Avg</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{cluster.averageMemory}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${cluster.averageMemory}%` }}
                      />
                    </div>
                  </div>
                </div>
              </InternalGlassPanel>
            ))}
          </div>
        </div>

        {/* Global Security & Compliance */}
        <InternalGlassPanel>
          <div className="mb-6 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Global Security & Compliance</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Zero-Trust Network Policies */}
            <InternalGlassPanel density="compact" className="border-primary/20 bg-black/20">
              <div className="mb-3 flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Zero-Trust Network Policies</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/60">Enforcement Status</p>
                </div>
              </div>
              <div className="ml-8">
                <p className="text-xs font-semibold text-green-500">Enforced on 3/3 clusters</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
                  All ingress/egress traffic controlled via NetworkPolicy resources
                </p>
              </div>
            </InternalGlassPanel>

            {/* mTLS Certificate Rotation */}
            <InternalGlassPanel density="compact" className="border-accent/20 bg-black/20">
              <div className="mb-3 flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">mTLS Certificate Rotation</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/60">Refresh Status</p>
                </div>
              </div>
              <div className="ml-8">
                <p className="text-xs font-semibold text-green-500">Rotated: 30 days ago</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-white/60">Next rotation: 24 days remaining (automated)</p>
              </div>
            </InternalGlassPanel>

            {/* Advanced Threat Detection */}
            <InternalGlassPanel density="compact" className="border-yellow-500/20 bg-black/20">
              <div className="mb-3 flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Advanced Threat Detection</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/60">Status</p>
                </div>
              </div>
              <div className="ml-8">
                <p className="text-xs font-semibold text-yellow-500">2 Alerts in last 24h</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
                  Suspicious pod behavior detected in Asia-South cluster (under review)
                </p>
              </div>
            </InternalGlassPanel>

            {/* RBAC Compliance */}
            <InternalGlassPanel density="compact" className="border-primary/20 bg-black/20">
              <div className="mb-3 flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">RBAC Compliance</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/60">Access Control</p>
                </div>
              </div>
              <div className="ml-8">
                <p className="text-xs font-semibold text-green-500">100% Compliant</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-white/60">All service accounts follow least-privilege principle</p>
              </div>
            </InternalGlassPanel>

            {/* Pod Security Policies */}
            <InternalGlassPanel density="compact" className="border-primary/20 bg-black/20">
              <div className="mb-3 flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Pod Security Policies</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/60">Standards</p>
                </div>
              </div>
              <div className="ml-8">
                <p className="text-xs font-semibold text-green-500">Enforced</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
                  No privileged containers allowed; runtime security scanning active
                </p>
              </div>
            </InternalGlassPanel>

            {/* Audit Logging */}
            <InternalGlassPanel density="compact" className="border-primary/20 bg-black/20">
              <div className="mb-3 flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Audit Logging</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/60">Monitoring</p>
                </div>
              </div>
              <div className="ml-8">
                <p className="text-xs font-semibold text-green-500">Central Aggregation</p>
                <p className="mt-2 text-xs text-gray-600 dark:text-white/60">All control plane events logged and stored for 90 days</p>
              </div>
            </InternalGlassPanel>
          </div>
        </InternalGlassPanel>

        {/* Cluster Health Heatmap */}
        <InternalGlassPanel>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Aggregated Health Dashboard</h2>
          <div className="space-y-4">
            {store.clusters.map((cluster) => {
              const healthPercentage =
                cluster.health === 'healthy' ? 100 : cluster.health === 'warning' ? 75 : 25;
              return (
                <div key={cluster.id}>
                  <div className="mb-2 flex justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{cluster.name}</span>
                    <span className="text-sm text-gray-600 dark:text-white/60">{healthPercentage}% Health</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full transition-all ${
                        cluster.health === 'healthy'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : cluster.health === 'warning'
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                            : 'bg-gradient-to-r from-red-500 to-destructive'
                      }`}
                      style={{ width: `${healthPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </InternalGlassPanel>
      </div>
    </div>
  );
}
