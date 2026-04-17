"use client";
import { useState, useCallback, useEffect } from "react";
import { useIncidents } from "@/hooks/useIncidents";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WSMessage } from "@/lib/types";
import IncidentFeed from "@/components/dashboard/IncidentFeed";
import StatsBar from "@/components/dashboard/StatsBar";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import FaultInjector from "@/components/controls/FaultInjector";
import IncidentDrawer from "@/components/incident/IncidentDrawer";
import styles from "./page.module.css";

export default function Dashboard() {
  const { incidents, reload } = useIncidents();
  const [selected, setSelected] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const incidentList = Array.isArray(incidents) ? incidents : [];

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("a07-theme") : null;
    const preferred: "dark" | "light" = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(preferred);
    document.documentElement.setAttribute("data-theme", preferred);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("a07-theme", next);
  };

  const onMessage = useCallback(
    (msg: WSMessage) => {
      if (
        [
          "incident_event",
          "status_change",
          "diagnosis_complete",
          "plan_ready",
          "execution_update",
          "incident_resolved",
        ].includes(msg.type)
      ) {
        reload();
      }
    },
    [reload],
  );

  const { connected } = useWebSocket(onMessage);

  const resolved = incidentList.filter((i) => i.status === "resolved").length;
  const open = incidentList.filter(
    (i) => !["resolved", "failed"].includes(i.status),
  ).length;

  return (
    <div className={`${styles.page} dashboard`}>
      <header className="header">
        <div className="header-left">
          <span className="logo">T3PS2</span>
          <span className="header-sub">
            Autonomous Kubernetes Incident Response
          </span>
        </div>
        <div className="header-right">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle light and dark theme">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <ConnectionBadge connected={connected} />
          <FaultInjector onInjected={reload} />
        </div>
      </header>

      <StatsBar total={incidentList.length} open={open} resolved={resolved} />

      <main className="main">
        <IncidentFeed
          incidents={incidentList}
          onSelect={setSelected}
          selected={selected}
        />
      </main>

      {selected && (
        <IncidentDrawer
          incidentId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
