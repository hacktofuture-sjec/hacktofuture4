"use client";
import { useState } from "react";
import { VerificationOutput } from "@/lib/types";
import { api } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";

interface Props {
  verification: VerificationOutput | null;
  incidentId: string;
  onRefresh: () => void;
}

export default function VerifierPanel({ verification, incidentId, onRefresh }: Props) {
  const [running, setRunning] = useState(false);

  if (!verification) {
    return (
      <div className="verifier-panel panel-empty" style={{ marginTop: 12 }}>
        <button
          className="btn-primary"
          onClick={async () => {
            setRunning(true);
            try {
              await api.verify(incidentId);
              onRefresh();
            } catch (error) {
              console.error("Failed to run verification", error);
            } finally {
              setRunning(false);
            }
          }}
          disabled={running}
          aria-busy={running}
        >
          {running ? <Spinner /> : "Run Verify"}
        </button>
      </div>
    );
  }

  return (
    <section className="verifier-panel panel" style={{ marginTop: 12 }}>
      <h3 className="section-title">Verification</h3>
      <p>
        <strong>Recovered:</strong> {verification.recovered ? "Yes" : "No"}
      </p>
      <p>
        <strong>Close reason:</strong> {verification.close_reason}
      </p>
      <ul>
        {verification.thresholds_checked.map((t, idx) => (
          <li key={idx}>
            {t.metric}: observed {t.observed} / threshold {t.threshold} ({t.passed ? "pass" : "fail"})
          </li>
        ))}
      </ul>
    </section>
  );
}
