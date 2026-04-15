'use client';

import { create } from 'zustand';

// ===== Data Types =====
export interface Service {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
  uptime: number;
  region: string;
  cluster: string;
  dependencies: string[];
}

export interface Anomaly {
  id: string;
  serviceId: string;
  serviceName: string;
  severity: 'warning' | 'critical';
  metric: string;
  currentValue: number;
  baselineValue: number;
  deviation: number;
  confidence: number;
  timestamp: Date;
  explanation: string;
}

export interface Incident {
  id: string;
  serviceId: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved' | 'investigating';
  rootCause?: string;
  affectedServices: string[];
  mttr?: number;
  remediationMethod?: 'autonomous' | 'manual';
  resolvedAt?: Date;
  postmortem?: string;
}

export interface Trace {
  id: string;
  startService: string;
  path: { service: string; latency: number }[];
  totalLatency: number;
  status: 'success' | 'failure';
  timestamp: Date;
}

export interface Cluster {
  id: string;
  name: string;
  provider: 'aws' | 'gcp' | 'azure';
  region: string;
  services: number;
  averageCpu: number;
  averageMemory: number;
  health: 'healthy' | 'warning' | 'critical';
  nodeCount: number;
}

export interface RemediationAction {
  id: string;
  incidentId: string;
  action: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  confidence: number;
  reason: string;
  executedAt?: Date;
  result?: string;
}

export interface PerformanceMetric {
  timestamp: Date;
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
}

export interface LearningMetric {
  date: Date;
  accuracy: number;
  precision: number;
  falsePositives: number;
  mttr: number;
  opexSavings: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  service: string;
  message: string;
}

// ===== App Store Type =====
export interface AppStore {
  // Global state
  services: Service[];
  anomalies: Anomaly[];
  incidents: Incident[];
  traces: Trace[];
  clusters: Cluster[];
  remediationActions: RemediationAction[];
  performanceHistory: PerformanceMetric[];
  learningHistory: LearningMetric[];
  logs: LogEntry[];

  // UI state
  selectedService: Service | null;
  selectedAnomaly: Anomaly | null;
  selectedIncident: Incident | null;
  selectedCluster: Cluster | null;
  remediationMode: 'manual' | 'autonomous';
  serviceFilter: string | null;

  // Actions
  setServices: (services: Service[]) => void;
  updateService: (service: Service) => void;
  addAnomaly: (anomaly: Anomaly) => void;
  removeAnomaly: (id: string) => void;
  addIncident: (incident: Incident) => void;
  resolveIncident: (id: string, postmortem: string) => void;
  addTrace: (trace: Trace) => void;
  setClusters: (clusters: Cluster[]) => void;
  addRemediationAction: (action: RemediationAction) => void;
  updateRemediationAction: (id: string, status: string, result?: string) => void;
  addPerformanceMetric: (metric: PerformanceMetric) => void;
  addLearningMetric: (metric: LearningMetric) => void;
  addLog: (log: LogEntry) => void;
  clearOldLogs: (hours: number) => void;

  // Selection actions
  setSelectedService: (service: Service | null) => void;
  setSelectedAnomaly: (anomaly: Anomaly | null) => void;
  setSelectedIncident: (incident: Incident | null) => void;
  setSelectedCluster: (cluster: Cluster | null) => void;
  setRemediationMode: (mode: 'manual' | 'autonomous') => void;
  setServiceFilter: (filter: string | null) => void;
}

// ===== Generate Mock Data =====
const generateMockServices = (): Service[] => {
  const services = ['api-gateway', 'auth-service', 'order-manager', 'inventory-db', 'cache-layer', 'notification-service', 'payment-processor', 'analytics-engine'];
  return services.map((name, idx) => ({
    id: `svc-${idx}`,
    name,
    status: Math.random() > 0.7 ? (Math.random() > 0.5 ? 'warning' : 'critical') : 'healthy',
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    latency: Math.random() * 500,
    errorRate: Math.random() * 5,
    uptime: 99 + Math.random() * 0.9,
    region: ['us-east', 'eu-west', 'asia-south'][idx % 3],
    cluster: `cluster-${Math.floor(idx / 3)}`,
    dependencies: services.filter((_, i) => Math.random() > 0.6 && i !== idx).slice(0, 3),
  }));
};

const generateMockClusters = (): Cluster[] => [
  {
    id: 'cluster-0',
    name: 'Production US-East',
    provider: 'aws',
    region: 'us-east-1',
    services: 8,
    averageCpu: 45,
    averageMemory: 62,
    health: 'healthy',
    nodeCount: 12,
  },
  {
    id: 'cluster-1',
    name: 'Production EU-West',
    provider: 'aws',
    region: 'eu-west-1',
    services: 8,
    averageCpu: 38,
    averageMemory: 55,
    health: 'healthy',
    nodeCount: 10,
  },
  {
    id: 'cluster-2',
    name: 'Production Asia-South',
    provider: 'gcp',
    region: 'asia-south-1',
    services: 6,
    averageCpu: 52,
    averageMemory: 68,
    health: 'warning',
    nodeCount: 8,
  },
];

// ===== Create Store =====
export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  services: generateMockServices(),
  anomalies: [],
  incidents: [],
  traces: [],
  clusters: generateMockClusters(),
  remediationActions: [],
  performanceHistory: [],
  learningHistory: [],
  logs: [],

  selectedService: null,
  selectedAnomaly: null,
  selectedIncident: null,
  selectedCluster: null,
  remediationMode: 'manual',
  serviceFilter: null,

  // Actions
  setServices: (services) => set({ services }),
  updateService: (updatedService) =>
    set((state) => ({
      services: state.services.map((s) => (s.id === updatedService.id ? updatedService : s)),
    })),

  addAnomaly: (anomaly) =>
    set((state) => ({
      anomalies: [anomaly, ...state.anomalies],
    })),

  removeAnomaly: (id) =>
    set((state) => ({
      anomalies: state.anomalies.filter((a) => a.id !== id),
    })),

  addIncident: (incident) =>
    set((state) => ({
      incidents: [incident, ...state.incidents],
    })),

  resolveIncident: (id, postmortem) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === id
          ? {
              ...i,
              status: 'resolved',
              postmortem,
              resolvedAt: new Date(),
            }
          : i
      ),
    })),

  addTrace: (trace) =>
    set((state) => ({
      traces: [trace, ...state.traces].slice(0, 100),
    })),

  setClusters: (clusters) => set({ clusters }),

  addRemediationAction: (action) =>
    set((state) => ({
      remediationActions: [action, ...state.remediationActions],
    })),

  updateRemediationAction: (id, status, result) =>
    set((state) => ({
      remediationActions: state.remediationActions.map((a) =>
        a.id === id
          ? {
              ...a,
              status: status as any,
              result,
              executedAt: status === 'completed' ? new Date() : a.executedAt,
            }
          : a
      ),
    })),

  addPerformanceMetric: (metric) =>
    set((state) => ({
      performanceHistory: [...state.performanceHistory, metric].slice(-288), // Keep last 24 hours of 5-sec intervals
    })),

  addLearningMetric: (metric) =>
    set((state) => ({
      learningHistory: [...state.learningHistory, metric],
    })),

  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 1000),
    })),

  clearOldLogs: (hours) =>
    set((state) => {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      return {
        logs: state.logs.filter((log) => log.timestamp > cutoff),
      };
    }),

  setSelectedService: (service) => set({ selectedService: service }),
  setSelectedAnomaly: (anomaly) => set({ selectedAnomaly: anomaly }),
  setSelectedIncident: (incident) => set({ selectedIncident: incident }),
  setSelectedCluster: (cluster) => set({ selectedCluster: cluster }),
  setRemediationMode: (mode) => set({ remediationMode: mode }),
  setServiceFilter: (filter) => set({ serviceFilter: filter }),
}));
