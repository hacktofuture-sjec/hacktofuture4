import axios from "axios";

const client = axios.create({ baseURL: "http://localhost:8001", timeout: 180000 });

export interface CveSummary {
  id: string;
  published: string;
  description: string;
  severity: string;
  score: number | null;
  vector: string | null;
  cwes: string[];
  references: string[];
}
export interface CveLookupResponse {
  total: number;
  results: CveSummary[];
}

function parseFilename(disposition?: string): string | null {
  if (!disposition) return null;
  const m = /filename="?([^";]+)"?/.exec(disposition);
  return m ? m[1] : null;
}

export const redApi = {
  health: () => client.get("/health").then(r => r.data),

  /* ── Chat ── */
  chat: (message: string, target?: string) =>
    client.post("/chat", { message, target }).then(r => r.data),

  /* ── Mission launcher (direct, no LLM round-trip) ── */
  launchMission: (target: string, attack_type = "full") =>
    client.post("/mission/launch", { target, attack_type }).then(r => r.data),

  /* ── Scans ── */
  recon: (target: string, context?: string) =>
    client.post("/scan/recon", { target, context }).then(r => r.data),
  reconStatus: (sid: string) =>
    client.get(`/scan/recon/${sid}`).then(r => r.data),
  autoExploit: (target: string, recon_session_id: string) =>
    client.post("/exploit/auto", { target, recon_session_id }).then(r => r.data),
  exploitStatus: (eid: string) =>
    client.get(`/exploit/auto/${eid}`).then(r => r.data),

  /* ── CVE lookup (NVD proxy) ── */
  lookupCveById: (cveId: string) =>
    client.get<CveLookupResponse>("/cve/lookup", { params: { cve_id: cveId } }).then(r => r.data),
  searchCveByKeyword: (keyword: string, limit = 10) =>
    client.get<CveLookupResponse>("/cve/lookup", { params: { keyword, limit } }).then(r => r.data),

  /* ── Real-time CVE feed (what the backend polled from NVD) ── */
  cveFeed: (limit = 30) =>
    client.get<{ total: number; results: CveSummary[]; api_key_in_use: boolean }>(
      "/cve/feed", { params: { limit } }
    ).then(r => r.data).catch(() => ({ total: 0, results: [], api_key_in_use: false })),

  /* ── Report download ── */
  downloadReport: (missionId?: string) => {
    const path = missionId ? `/report/mission/${missionId}` : "/report/mission/latest";
    return client.get(path, { responseType: "blob" }).then(r => ({
      blob: r.data as Blob,
      filename: parseFilename(r.headers["content-disposition"] as string | undefined) ?? "red-report.md",
    }));
  },

  listReconSessions: () =>
    client.get("/scan/recon/sessions").then(r => r.data).catch(() => []),
};
