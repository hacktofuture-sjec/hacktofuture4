import React from "react";
import { render, screen } from "@testing-library/react";
import { RiskGauge } from "@/components/risk-gauge";
import type { GovernanceDecision } from "@/lib/types";

const makeDecision = (
  risk_score: number,
  decision: GovernanceDecision["decision"],
  factors: string[] = [],
): GovernanceDecision => ({
  id: "gov-001",
  incident_id: "inc-001",
  risk_score,
  decision,
  risk_factors: factors,
  created_at: new Date().toISOString(),
});

describe("RiskGauge", () => {
  it("shows Low Risk for score < 0.3", () => {
    render(<RiskGauge decision={makeDecision(0.15, "auto_apply")} />);
    expect(screen.getByText("Low Risk")).toBeInTheDocument();
  });

  it("shows Medium Risk for score 0.3–0.7", () => {
    render(<RiskGauge decision={makeDecision(0.55, "create_pr")} />);
    expect(screen.getByText("Medium Risk")).toBeInTheDocument();
  });

  it("shows High Risk for score >= 0.7", () => {
    render(<RiskGauge decision={makeDecision(0.85, "block_await_human")} />);
    expect(screen.getByText("High Risk")).toBeInTheDocument();
  });

  it("shows percentage on gauge", () => {
    render(<RiskGauge decision={makeDecision(0.72, "block_await_human")} />);
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("renders decision label", () => {
    render(<RiskGauge decision={makeDecision(0.2, "auto_apply")} />);
    expect(screen.getByText("Auto-Apply")).toBeInTheDocument();
  });

  it("renders risk factors", () => {
    render(<RiskGauge decision={makeDecision(0.8, "block_await_human", ["touches_secrets", "llm_generated"])} />);
    expect(screen.getByText("touches_secrets")).toBeInTheDocument();
    expect(screen.getByText("llm_generated")).toBeInTheDocument();
  });

  it("does not render factors section when empty", () => {
    render(<RiskGauge decision={makeDecision(0.2, "auto_apply", [])} />);
    expect(screen.queryByText("Factors")).not.toBeInTheDocument();
  });
});
