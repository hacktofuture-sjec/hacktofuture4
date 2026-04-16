import React from "react";
import { render, screen } from "@testing-library/react";
import { AgentTimeline } from "@/components/agent-timeline";
import type { AgentLog } from "@/lib/types";

const makeLog = (step: string, status: "running" | "done" | "error", detail = "detail"): AgentLog => ({
  id: `${step}-${status}`,
  incident_id: "inc-001",
  step_name: step,
  status,
  detail,
  created_at: new Date().toISOString(),
});

describe("AgentTimeline", () => {
  it("renders all six pipeline steps", () => {
    render(<AgentTimeline logs={[]} done={false} />);
    expect(screen.getByText(/Monitor/)).toBeInTheDocument();
    expect(screen.getByText(/Diagnostic/)).toBeInTheDocument();
    expect(screen.getByText(/Fix/)).toBeInTheDocument();
    expect(screen.getByText(/Governance/)).toBeInTheDocument();
    expect(screen.getByText(/Execute/)).toBeInTheDocument();
    expect(screen.getByText(/Learning/)).toBeInTheDocument();
  });

  it("shows done state for completed steps", () => {
    const logs = [makeLog("monitor", "done", "Normalised payload")];
    render(<AgentTimeline logs={logs} done={false} />);
    // Detail shows for done steps
    expect(screen.getByText("Normalised payload")).toBeInTheDocument();
  });

  it("shows pipeline complete when done is true", () => {
    render(<AgentTimeline logs={[]} done={true} />);
    expect(screen.getByText("Pipeline complete")).toBeInTheDocument();
  });

  it("does not show pipeline complete when done is false", () => {
    render(<AgentTimeline logs={[]} done={false} />);
    expect(screen.queryByText("Pipeline complete")).not.toBeInTheDocument();
  });

  it("deduplicates logs — uses latest status per step", () => {
    const logs = [
      makeLog("monitor", "running", "Starting"),
      makeLog("monitor", "done", "Finished"),
    ];
    render(<AgentTimeline logs={logs} done={false} />);
    // Only the last detail should appear
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.queryByText("Starting")).not.toBeInTheDocument();
  });

  it("renders error detail for errored step", () => {
    const logs = [makeLog("diagnostic", "error", "GitHub API unreachable")];
    render(<AgentTimeline logs={logs} done={false} />);
    expect(screen.getByText("GitHub API unreachable")).toBeInTheDocument();
  });
});
