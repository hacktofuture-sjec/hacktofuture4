import { create } from 'zustand';

export type CowStatus = 'Heat' | 'Monitor' | 'Healthy';

export interface Cow {
  id: string;
  name: string;
  breed: string;
  age: number;
  tagId: string;
  status: CowStatus;
  lastChecked: string;
  notes?: string;
}

export interface Alert {
  id: string;
  cowId: string;
  cowName: string;
  tagId: string;
  message: string;
  status: CowStatus;
  timestamp: string;
  source: 'CCTV' | 'Manual' | 'Image';
  read: boolean;
}

export interface DetectionEvent {
  id: string;
  tagId: string;
  event: string;
  timestamp: string;
  confidence: number;
}

interface CattleStore {
  cows: Cow[];
  alerts: Alert[];
  detectionEvents: DetectionEvent[];
  addCow: (cow: Omit<Cow, 'id' | 'status' | 'lastChecked'>) => void;
  updateCowStatus: (id: string, status: CowStatus) => void;
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  addDetectionEvent: (event: Omit<DetectionEvent, 'id' | 'timestamp'>) => void;
  clearDetectionEvents: () => void;
}

const initialCows: Cow[] = [
  { id: '101', name: 'Lakshmi', breed: 'Gir', age: 4, tagId: 'KA-1023', status: 'Healthy', lastChecked: new Date().toISOString() },
  { id: '102', name: 'Ganga', breed: 'Holstein', age: 3, tagId: 'KA-1024', status: 'Monitor', lastChecked: new Date().toISOString() },
  { id: '103', name: 'Durga', breed: 'Sahiwal', age: 5, tagId: 'KA-1025', status: 'Heat', lastChecked: new Date().toISOString() },
  { id: '104', name: 'Kamadhenu', breed: 'Jersey', age: 2, tagId: 'KA-1026', status: 'Healthy', lastChecked: new Date().toISOString() },
  { id: '105', name: 'Priya', breed: 'Murrah', age: 6, tagId: 'KA-1027', status: 'Healthy', lastChecked: new Date().toISOString() },
  { id: '106', name: 'Savitri', breed: 'Red Sindhi', age: 3, tagId: 'KA-1028', status: 'Monitor', lastChecked: new Date().toISOString() },
];

const initialAlerts: Alert[] = [
  {
    id: 'a1',
    cowId: '103',
    cowName: 'Durga',
    tagId: 'KA-1025',
    message: 'Cow Durga (Tag KA-1025) shows mounting behavior — likely in heat. Immediate veterinary attention recommended.',
    status: 'Heat',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    source: 'CCTV',
    read: false,
  },
  {
    id: 'a2',
    cowId: '102',
    cowName: 'Ganga',
    tagId: 'KA-1024',
    message: 'Cow Ganga (Tag KA-1024) showing increased restlessness. Monitor closely.',
    status: 'Monitor',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    source: 'CCTV',
    read: false,
  },
];

export const useCattleStore = create<CattleStore>((set, get) => ({
  cows: initialCows,
  alerts: initialAlerts,
  detectionEvents: [],

  addCow: (cow) => {
    const newCow: Cow = {
      ...cow,
      id: String(Date.now()),
      status: 'Healthy',
      lastChecked: new Date().toISOString(),
    };
    set((state) => ({ cows: [...state.cows, newCow] }));
  },

  updateCowStatus: (id, status) => {
    set((state) => ({
      cows: state.cows.map((c) =>
        c.id === id ? { ...c, status, lastChecked: new Date().toISOString() } : c
      ),
    }));
  },

  addAlert: (alert) => {
    const newAlert: Alert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set((state) => ({ alerts: [newAlert, ...state.alerts] }));
    // Also update cow status
    const cow = get().cows.find((c) => c.id === alert.cowId);
    if (cow) {
      get().updateCowStatus(alert.cowId, alert.status);
    }
  },

  markAlertRead: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
    }));
  },

  markAllAlertsRead: () => {
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
    }));
  },

  addDetectionEvent: (event) => {
    const newEvent: DetectionEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      detectionEvents: [newEvent, ...state.detectionEvents].slice(0, 50),
    }));
  },

  clearDetectionEvents: () => set({ detectionEvents: [] }),
}));
