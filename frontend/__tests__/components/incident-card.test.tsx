import React from "react";
import { render, screen } from "@testing-library/react";
import { IncidentCard } from "@/components/incident-card";
import type { Incident } from "@/lib/types";

// Next/link needs a router — mock it
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

const BASE_INCIDENT: Incident = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  source: "simulator",
  failure_type: "infra",
  raw_payload: { description: "Postgres connection refused" },
  status: "processing",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("IncidentCard", () => {
  it("renders the failure type badge", () => {
    render(<IncidentCard incident={BASE_INCIDENT} />);
    expect(screen.getByText("INFRA")).toBeInTheDocument();
  });

  it("renders the source label", () => {
    render(<IncidentCard incident={BASE_INCIDENT} />);
    expect(screen.getByText("simulator")).toBeInTheDocument();
  });

  it("renders the description from raw_payload", () => {
    render(<IncidentCard incident={BASE_INCIDENT} />);
    expect(screen.getByText("Postgres connection refused")).toBeInTheDocument();
  });

  it("renders the status label", () => {
    render(<IncidentCard incident={BASE_INCIDENT} />);
    expect(screen.getByText("Processing")).toBeInTheDocument();
  });

  it("links to the correct incident detail URL", () => {
    render(<IncidentCard incident={BASE_INCIDENT} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/incidents/${BASE_INCIDENT.id}`);
  });

  it("renders resolved status correctly", () => {
    render(<IncidentCard incident={{ ...BASE_INCIDENT, status: "resolved" }} />);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("renders failed status correctly", () => {
    render(<IncidentCard incident={{ ...BASE_INCIDENT, status: "failed" }} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders awaiting_approval status", () => {
    render(<IncidentCard incident={{ ...BASE_INCIDENT, status: "awaiting_approval" }} />);
    expect(screen.getByText("Awaiting Approval")).toBeInTheDocument();
  });

  it("falls back to truncated ID when description missing", () => {
    render(<IncidentCard incident={{ ...BASE_INCIDENT, raw_payload: {} }} />);
    expect(screen.getByText(/Incident 550e8400/)).toBeInTheDocument();
  });
});
