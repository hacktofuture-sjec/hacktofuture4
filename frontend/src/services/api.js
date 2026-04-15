import axios from 'axios';
import { io } from 'socket.io-client';

const normalizeUrl = (url) => url?.replace(/\/+$/, '') || '';

const getApiUrl = () => {
  const envUrl = normalizeUrl(import.meta.env.VITE_API_URL);
  if (envUrl) return envUrl;
  return '';
};

const API_URL = getApiUrl();
const AUTH_URL = `${API_URL}/api/auth`;
const MESSAGING_API_URL = `${API_URL}/api/messaging`;
const PRESENCE_API_URL = `${API_URL}/api/presence`;
const AGENT_BASE_URL = normalizeUrl(import.meta.env.VITE_AGENT_URL) || 'http://127.0.0.1:4000';
const AGENT_URL = AGENT_BASE_URL ? `${AGENT_BASE_URL}/agent` : '/agent';
const MESSAGING_SOCKET_PATH = '/socket.io/messaging';
const PRESENCE_SOCKET_PATH = '/socket.io/presence';

console.log('[Nova Chat] API Gateway:', API_URL);

const axiosInstance = axios.create({
  timeout: 30000,
});


const requestWithFallback = async (urls, requestFn) => {
  let lastError;
  for (const url of urls) {
    try {
      return await requestFn(url);
    } catch (err) {
      lastError = err;
      if (!err || !err.isAxiosError) {
        throw err;
      }
      if (!err.response || err.response.status === 404 || err.response.status >= 500) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

const buildApiUrl = (base, route) => {
  if (!base) return route;
  return `${base}${route}`;
};

export const registerUser = async ({ username, password, email }) => {
  const baseUrls = [AUTH_URL];
  let lastError;

  for (const baseUrl of baseUrls) {
    const endpoints = [
      buildApiUrl(baseUrl, '/register'),
      buildApiUrl(baseUrl, '/signup'),
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axiosInstance.post(endpoint, { username, password, email });
        return response.data;
      } catch (err) {
        lastError = err;
        // If endpoint is missing, try the compatibility endpoint.
        if (err?.response?.status === 404) {
          continue;
        }
        throw err;
      }
    }
  }

  throw lastError;
};

export const loginUser = async ({ username, password, email }) => {
  const urls = [AUTH_URL];
  const response = await requestWithFallback(urls, (url) =>
    axiosInstance.post(buildApiUrl(url, '/login'), { username, password, email })
  );
  return response.data;
};

export const fetchUserMessages = async (userId) => {
  const urls = [MESSAGING_API_URL];
  const response = await requestWithFallback(urls, (url) =>
    axiosInstance.get(`${url}/messages/${userId}`)
  );
  return response.data;
};

export const fetchAllUsers = async () => {
  const urls = [AUTH_URL];
  const response = await requestWithFallback(urls, (url) =>
    axiosInstance.get(buildApiUrl(url, '/users'))
  );
  return response.data;
};

export const deleteUserById = async (userId) => {
  const urls = [AUTH_URL];
  const response = await requestWithFallback(urls, (url) =>
    axiosInstance.delete(buildApiUrl(url, `/users/${userId}`))
  );
  return response.data;
};

export const fetchAgentAnalyze = async () => {
  const urls = [AGENT_URL, '/agent'];
  const response = await requestWithFallback(urls, (url) =>
    axiosInstance.get(buildApiUrl(url, '/analyze'))
  );
  return response.data;
};

const createSocketProxy = (baseUrl, path) => {
  const normalizedUrl = normalizeUrl(baseUrl);
  const socketUrl = normalizedUrl || undefined;
  return io(socketUrl, {
    path,
    timeout: 5000,
    reconnectionAttempts: 3,
    transports: ['websocket', 'polling'],
  });
};

export const initMessagingSocket = () => {
  return createSocketProxy(API_URL, MESSAGING_SOCKET_PATH);
};

export const initPresenceSocket = () => {
  return createSocketProxy(API_URL, PRESENCE_SOCKET_PATH);
};
