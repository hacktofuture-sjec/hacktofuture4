"use client";
import { useState, useCallback } from "react";
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
  const incidentList = Array.isArray(incidents) ? incidents : [];

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
