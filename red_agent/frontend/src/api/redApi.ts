import axios from "axios";
import type { ScanRequest, ToolCall } from "@/types/red.types";

const RED_BASE_URL =
  import.meta.env.VITE_RED_API_URL ?? "http://localhost:8001";

const client = axios.create({
  baseURL: RED_BASE_URL,
  timeout: 15_000,
});

export const redApi = {
  health: () => client.get<{ status: string; agent: string }>("/health"),

  scanNetwork: (req: ScanRequest) =>
    client.post("/scan/network", req).then((r) => r.data),
  scanWeb: (req: ScanRequest) =>
    client.post("/scan/web", req).then((r) => r.data),
  scanSystem: (req: ScanRequest) =>
    client.post("/scan/system", req).then((r) => r.data),
  scanCloud: (req: ScanRequest) =>
    client.post("/scan/cloud", req).then((r) => r.data),

  recentScans: (limit = 20) =>
    client
      .get<ToolCall[]>("/scan/recent", { params: { limit } })
      .then((r) => r.data),

  lookupCve: (service: string, version?: string) =>
    client.post("/exploit/lookup_cve", { service, version }).then((r) => r.data),

  runExploit: (target: string, cve_id?: string) =>
    client.post("/exploit/run", { target, cve_id }).then((r) => r.data),

  planAttack: (target: string, intel: Record<string, unknown> = {}) =>
    client.post("/strategy/plan", { target, intel }).then((r) => r.data),

  currentStrategy: () =>
    client.get("/strategy/current").then((r) => r.data),
};
