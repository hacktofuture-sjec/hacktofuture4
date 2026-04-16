"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Props {
  onInjected: () => void;
}

export default function FaultInjector({ onInjected }: Props) {
  const [scenarios, setScenarios] = useState<{ scenario_id: string; name: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listScenarios()
      .then(setScenarios)
      .catch((err) => {
        console.error("Failed to load scenarios", err);
        setError("Failed to load scenarios");
      });
  }, []);

  const inject = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await api.injectFault(selected);
      onInjected();
    } catch (err) {
      console.error("Failed to inject fault", err);
      setError("Failed to inject fault");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fault-injector">
      <select
        id="scenario-select"
        className="scenario-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Select fault scenario"
      >
        <option value="">Select scenario...</option>
        {scenarios.map((s) => (
          <option key={s.scenario_id} value={s.scenario_id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        id="inject-fault-btn"
        className="btn-inject"
        onClick={inject}
        disabled={loading || !selected}
        aria-busy={loading}
      >
        {loading ? "Injecting..." : "Inject Fault"}
      </button>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
