export type SimulationState = {
  error: boolean;
  latency: boolean;
  crash: boolean;
  overload?: boolean;
};

export type ServiceSimulation = {
  service: string;
  state: SimulationState;
  url: string;
};

const normalizeBaseUrl = (value?: string) => (value || '').replace(/\/+$/, '');

// SMART URL GENERATORS: They automatically use the correct IP instead of 'localhost'
const getAuthBaseUrl = (): string => {
  const envBase = process.env.NEXT_PUBLIC_AUTH_BASE_URL;
  if (envBase && envBase.trim()) {
    return normalizeBaseUrl(envBase);
  }
  // Fallback to dynamic host instead of static localhost
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3001`;
};

const getMessagingBaseUrl = (): string => {
  const envBase = process.env.NEXT_PUBLIC_MESSAGING_BASE_URL;
  if (envBase && envBase.trim()) {
    return normalizeBaseUrl(envBase);
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3002`;
};

const getPresenceBaseUrl = (): string => {
  const envBase = process.env.NEXT_PUBLIC_PRESENCE_BASE_URL;
  if (envBase && envBase.trim()) {
    return normalizeBaseUrl(envBase);
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3003`;
};

async function fetchJson<T>(url: string, timeout = 5000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.debug(`[Simulation API] Fetching: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Simulation request failed with status ${response.status}`);
    }

    const data = await response.json() as T;
    console.debug(`[Simulation API] Success:`, data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      console.error(`[Simulation API] Fetch error:`, error.message);
      if (error.name === 'AbortError') {
        throw new Error('Simulation request timeout');
      }
      throw error;
    }
    throw new Error('Unknown error fetching simulation data');
  }
}

export async function fetchAuthSimulationState(): Promise<ServiceSimulation> {
  const baseUrl = getAuthBaseUrl();
  const url = `${baseUrl}/simulate/status`;
  
  try {
    const payload = await fetchJson<{ state: SimulationState }>(url);
    return {
      service: 'auth-service',
      state: payload.state || { error: false, latency: false, crash: false },
      url: baseUrl,
    };
  } catch (error) {
    console.error('[Simulation API] fetchAuthSimulationState failed:', error);
    return {
      service: 'auth-service',
      state: { error: false, latency: false, crash: false },
      url: baseUrl,
    };
  }
}

export async function fetchMessagingSimulationState(): Promise<ServiceSimulation> {
  const baseUrl = getMessagingBaseUrl();
  const url = `${baseUrl}/simulate/status`;
  
  try {
    const payload = await fetchJson<{ state: SimulationState }>(url);
    return {
      service: 'messaging-service',
      state: payload.state || { error: false, latency: false, crash: false, overload: false },
      url: baseUrl,
    };
  } catch (error) {
    console.error('[Simulation API] fetchMessagingSimulationState failed:', error);
    return {
      service: 'messaging-service', 
      state: { error: false, latency: false, crash: false, overload: false },
      url: baseUrl,
    };
  }
}

export async function fetchPresenceSimulationState(): Promise<ServiceSimulation> {
  const baseUrl = getPresenceBaseUrl();
  const url = `${baseUrl}/simulate/status`;
  
  try {
    const payload = await fetchJson<{ state: SimulationState }>(url);
    return {
      service: 'presence-service',
      state: payload.state || { error: false, latency: false, crash: false },
      url: baseUrl,
    };
  } catch (error) {
    console.error('[Simulation API] fetchPresenceSimulationState failed:', error);
    return {
      service: 'presence-service',
      state: { error: false, latency: false, crash: false },
      url: baseUrl,
    };
  }
}

export async function fetchAllSimulationStates(): Promise<ServiceSimulation[]> {
  try {
    const [auth, messaging, presence] = await Promise.all([
      fetchAuthSimulationState(),
      fetchMessagingSimulationState(),
      fetchPresenceSimulationState(),
    ]);
    
    return [auth, messaging, presence];
  } catch (error) {
    console.error('[Simulation API] fetchAllSimulationStates failed:', error);
    return [];
  }
}