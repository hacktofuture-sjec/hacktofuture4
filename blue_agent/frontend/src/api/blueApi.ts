import axios from "axios";
import type {
  ClosePortRequest,
  HardenServiceRequest,
  ToolCall,
} from "@/types/blue.types";

const BLUE_BASE_URL =
  import.meta.env.VITE_BLUE_API_URL ?? "http://localhost:8002";

const client = axios.create({
  baseURL: BLUE_BASE_URL,
  timeout: 15_000,
});

export const blueApi = {
  health: () => client.get<{ status: string; agent: string }>("/health"),

  closePort: (req: ClosePortRequest) =>
    client.post("/defend/close_port", req).then((r) => r.data),
  hardenService: (req: HardenServiceRequest) =>
    client.post("/defend/harden_service", req).then((r) => r.data),
  isolateHost: (host: string, reason?: string) =>
    client.post("/defend/isolate_host", { host, reason }).then((r) => r.data),

  recentDefenses: (limit = 20) =>
    client
      .get<ToolCall[]>("/defend/recent", { params: { limit } })
      .then((r) => r.data),

  applyPatch: (host: string, cve_id?: string, pkg?: string) =>
    client
      .post("/patch/apply", { host, cve_id, package: pkg })
      .then((r) => r.data),
  verifyFix: (host: string, cve_id: string) =>
    client.post("/patch/verify_fix", { host, cve_id }).then((r) => r.data),

  planDefense: (host: string, threat: Record<string, unknown> = {}) =>
    client.post("/strategy/plan", { host, threat }).then((r) => r.data),
  currentStrategy: () =>
    client.get("/strategy/current").then((r) => r.data),
};
