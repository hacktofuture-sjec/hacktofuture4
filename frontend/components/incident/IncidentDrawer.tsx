"use client";
import { useEffect, useState } from "react";
import { IncidentDetail } from "@/lib/types";
import { api } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import SignalPanel from "./SignalPanel";
import DiagnosisPanel from "./DiagnosisPanel";
import PlannerPanel from "./PlannerPanel";
import ExecutorPanel from "./ExecutorPanel";
import TimelinePanel from "./TimelinePanel";
import TokenCostPanel from "./TokenCostPanel";

interface Props {
  incidentId: string;
  onClose: () => void;
}

export default function IncidentDrawer({ incidentId, onClose }: Props) {
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "signals" | "diagnosis" | "plan" | "execution" | "timeline" | "cost"
  >("signals");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getIncident(incidentId)
      .then((data) => {
        if (!cancelled) {
          setIncident(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load incident details", err);
          setError("Failed to load incident details");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  const TABS = ["signals", "diagnosis", "plan", "execution", "timeline", "cost"] as const;

  const refreshIncident = () => {
    return api
      .getIncident(incidentId)
      .then(setIncident)
      .catch((err) => {
        console.error("Failed to refresh incident details", err);
      });
  };

  return (
    <div
      className="drawer-overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="incident-drawer-title"
    >
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2 id="incident-drawer-title" className="drawer-title">
              {incidentId}
            </h2>
            {incident && (
              <span className="drawer-subtitle">
                {incident.service} · {incident.namespace} · {incident.failure_class} · {incident.status}
              </span>
            )}
          </div>
          <button
            id="close-drawer-btn"
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <nav className="drawer-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              role="tab"
              aria-selected={activeTab === tab}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        <div className="drawer-body">
          {loading && <Spinner />}
          {!loading && error && <div className="panel-empty">{error}</div>}
          {!loading && incident && (
            <>
              {activeTab === "signals" && <SignalPanel snapshot={incident.snapshot} />}
              {activeTab === "diagnosis" && (
                <DiagnosisPanel
                  diagnosis={incident.diagnosis}
                  incidentId={incidentId}
                  onRefresh={refreshIncident}
                />
              )}
              {activeTab === "plan" && (
                <PlannerPanel
                  plan={incident.plan}
                  incidentId={incidentId}
                  incidentStatus={incident.status}
                  plannedAt={(incident as any).planned_at ?? null}
                  replanAttempts={(incident as any).replan_attempts}
                  updatedAt={incident.updated_at}
                  onRefresh={refreshIncident}
                />
              )}
              {activeTab === "execution" && (
                <ExecutorPanel
                  execution={incident.execution}
                  incidentId={incidentId}
                  onRefresh={refreshIncident}
                />
              )}
              {activeTab === "timeline" && <TimelinePanel incidentId={incidentId} />}
              {activeTab === "cost" && <TokenCostPanel incidentId={incidentId} />}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
