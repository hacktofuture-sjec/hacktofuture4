/**
 * Tests for the API client — uses MSW (mock service worker) patterns
 * but kept lightweight here with jest fetch mocks.
 */

// Polyfill fetch for Node test environment
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

// Reset mock between tests
beforeEach(() => {
  mockFetch.mockClear();
});

describe("api client URL construction", () => {
  it("simulate posts to correct path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ incident_id: "new-inc-123" }),
    });

    const { api } = await import("@/lib/api-client");
    const result = await api.simulate("postgres_refused");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/webhook/simulate");
    expect(result).toEqual({ incident_id: "new-inc-123" });
  });

  it("getIncident calls correct path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ incident: { id: "abc-123" } }),
    });

    const { api } = await import("@/lib/api-client");
    await api.getIncident("abc-123");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/incidents/abc-123");
  });

  it("streamUrl returns correct SSE URL", async () => {
    const { api } = await import("@/lib/api-client");
    const url = api.streamUrl("inc-xyz");
    expect(url).toContain("/stream/inc-xyz");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const { api } = await import("@/lib/api-client");
    await expect(api.getIncident("bad-id")).rejects.toThrow("404");
  });

  it("approveIncident posts correct body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const { api } = await import("@/lib/api-client");
    await api.approveIncident("inc-001", "alice", "looks good");

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.reviewed_by).toBe("alice");
    expect(body.notes).toBe("looks good");
  });
});
