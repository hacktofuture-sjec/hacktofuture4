"use client";
import { useState } from "react";
import { DiagnosisPayload } from "@/lib/types";
import { api } from "@/lib/api";
import ProgressBar from "@/components/ui/ProgressBar";
import Spinner from "@/components/ui/Spinner";

interface Props {
  diagnosis: DiagnosisPayload | null;
  incidentId: string;
  onRefresh: () => void;
}

export default function DiagnosisPanel({ diagnosis, incidentId, onRefresh }: Props) {
  const [running, setRunning] = useState(false);

  if (!diagnosis) {
    return (
      <div className="diagnosis-panel panel-empty">
        <button
          className="btn-primary"
          onClick={async () => {
            setRunning(true);
            try {
              await api.diagnose(incidentId);
              onRefresh();
            } catch (error) {
              console.error("Failed to run diagnosis", error);
            } finally {
              setRunning(false);
            }
          }}
          disabled={running}
          aria-busy={running}
        >
          {running ? <Spinner /> : "Run Diagnosis"}
        </button>
      </div>
    );
  }

  const mode = (diagnosis as any).diagnosis_mode ?? (diagnosis as any).source ?? "rule";
  const fingerprintMatched =
    (diagnosis as any).fingerprint_matched ?? Boolean((diagnosis as any).fingerprint_id);
  const evidence = Array.isArray((diagnosis as any).evidence)
    ? (diagnosis as any).evidence
    : [String((diagnosis as any).reasoning ?? "No evidence available")];

  return (
    <section className="diagnosis-panel panel">
      <h3 className="section-title">Diagnosis</h3>
      <p>
        <strong>Root cause:</strong> {diagnosis.root_cause}
      </p>
      <p>
        <strong>Mode:</strong> {String(mode)}
      </p>
      <ProgressBar value={Number(diagnosis.confidence ?? 0)} label="Confidence" />
      <p>
        <strong>Fingerprint matched:</strong> {fingerprintMatched ? "Yes" : "No"}
      </p>
      <p>
        <strong>Evidence:</strong>
      </p>
      <ul>
        {evidence.map((e: string, idx: number) => (
          <li key={idx}>{e}</li>
        ))}
      </ul>
    </section>
  );
}
