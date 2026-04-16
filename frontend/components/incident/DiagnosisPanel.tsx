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

  return (
    <section className="diagnosis-panel panel">
      <h3 className="section-title">Diagnosis</h3>
      <p>
        <strong>Root cause:</strong> {diagnosis.root_cause}
      </p>
      <p>
        <strong>Mode:</strong> {diagnosis.diagnosis_mode}
      </p>
      <ProgressBar value={diagnosis.confidence} label="Confidence" />
      <p>
        <strong>Fingerprint matched:</strong> {diagnosis.fingerprint_matched ? "Yes" : "No"}
      </p>
      <p>
        <strong>Evidence:</strong>
      </p>
      <ul>
        {diagnosis.evidence.map((e, idx) => (
          <li key={idx}>{e}</li>
        ))}
      </ul>
    </section>
  );
}
