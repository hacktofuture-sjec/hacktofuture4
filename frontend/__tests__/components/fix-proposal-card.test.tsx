import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FixProposalCard } from "@/components/fix-proposal-card";
import type { FixProposal } from "@/lib/types";

const BASE_FIX: FixProposal = {
  id: "fp-001",
  incident_id: "inc-001",
  tier: "T1_human",
  vault_entry_id: "vault-abc",
  similarity_score: 0.91,
  fix_description: "Restore correct Postgres host in database.yml",
  fix_commands: ["git checkout -- config/database.yml", "systemctl restart app"],
  fix_diff: null,
  confidence: 0.92,
  reasoning: "Vault match (T1_human): signature 'infra:postgres:econnrefused'",
  rlm_trace: [],
  created_at: new Date().toISOString(),
};

describe("FixProposalCard", () => {
  it("renders T1 tier badge", () => {
    render(<FixProposalCard fix={BASE_FIX} />);
    expect(screen.getByText(/T1 Human Pattern/)).toBeInTheDocument();
  });

  it("renders T2 tier badge", () => {
    render(<FixProposalCard fix={{ ...BASE_FIX, tier: "T2_synthetic" }} />);
    expect(screen.getByText(/T2 Validated Logic/)).toBeInTheDocument();
  });

  it("renders T3 tier badge", () => {
    render(<FixProposalCard fix={{ ...BASE_FIX, tier: "T3_llm" }} />);
    expect(screen.getByText(/T3 Synthesized/)).toBeInTheDocument();
  });

  it("renders fix description", () => {
    render(<FixProposalCard fix={BASE_FIX} />);
    expect(screen.getByText("Restore correct Postgres host in database.yml")).toBeInTheDocument();
  });

  it("renders all fix commands", () => {
    render(<FixProposalCard fix={BASE_FIX} />);
    expect(screen.getByText("git checkout -- config/database.yml")).toBeInTheDocument();
    expect(screen.getByText("systemctl restart app")).toBeInTheDocument();
  });

  it("shows confidence percentage", () => {
    render(<FixProposalCard fix={BASE_FIX} />);
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("shows similarity score when present", () => {
    render(<FixProposalCard fix={BASE_FIX} />);
    expect(screen.getByText(/91\.0%/)).toBeInTheDocument();
  });

  it("hides similarity score when null", () => {
    render(<FixProposalCard fix={{ ...BASE_FIX, similarity_score: null }} />);
    expect(screen.queryByText(/Similarity/)).not.toBeInTheDocument();
  });

  it("renders diff section when diff present", () => {
    const { container } = render(
      <FixProposalCard fix={{ ...BASE_FIX, fix_diff: "--- a/f\n+++ b/f" }} />
    );
    // The diff toggle is an un-labelled button (chevron only) — find it and click
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    // First button in the diff section — click to expand
    fireEvent.click(buttons[0]);
    expect(screen.getByText(/--- a\/f/)).toBeInTheDocument();
  });
});
