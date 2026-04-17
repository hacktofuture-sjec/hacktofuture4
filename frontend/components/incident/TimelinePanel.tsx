"use client";
import { useEffect, useState } from "react";
import { TimelineEvent } from "@/lib/types";
import { api } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import { formatDistanceToNow } from "@/lib/utils";

interface Props {
  incidentId: string;
}

function stageLabel(event: TimelineEvent): string {
  const actor = String(event.actor || "").toLowerCase();
  if (actor.includes("monitor")) return "Detected";
  if (actor.includes("diagnose")) return "Diagnosed";
  if (actor.includes("planner")) return "Planned";
  if (actor.includes("executor")) return "Executed";
  if (actor.includes("verifier")) return "Verified";
  if (actor.includes("system")) return "Resolved";
  return event.status;
}

function formatTimestamp(ts: string): string {
  const value = new Date(ts);
  if (Number.isNaN(value.getTime())) return ts;
  return value.toLocaleString();
}

function stageOrder(event: TimelineEvent): number {
  const actor = String(event.actor || "").toLowerCase();
  if (actor.includes("monitor")) return 1;
  if (actor.includes("diagnose")) return 2;
  if (actor.includes("planner")) return 3;
  if (actor.includes("executor")) return 4;
  if (actor.includes("verifier")) return 5;
  if (actor.includes("system")) return 6;
  return 99;
}

function compareTimelineEvents(a: TimelineEvent, b: TimelineEvent): number {
  const stageDiff = stageOrder(a) - stageOrder(b);
  if (stageDiff !== 0) {
    return stageDiff;
  }

  const left = new Date(a.timestamp).getTime();
  const right = new Date(b.timestamp).getTime();

  if (!Number.isNaN(left) && !Number.isNaN(right) && left !== right) {
    return left - right;
  }

  if (a.timestamp !== b.timestamp) {
    return String(a.timestamp).localeCompare(String(b.timestamp));
  }

  return stageOrder(a) - stageOrder(b);
}

export default function TimelinePanel({ incidentId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orderedEvents = [...events].sort(compareTimelineEvents);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getTimeline(incidentId)
      .then((res) => {
        if (!cancelled) {
          setEvents(res.events);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load timeline", err);
          setError("Failed to load timeline");
          setEvents([]);
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

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return <div className="timeline-panel panel">{error}</div>;
  }

  return (
    <section className="timeline-panel panel">
      <h3 className="section-title">Timeline</h3>
      <p className="timeline-subtitle">Incident lifecycle from detection through actions.</p>
      <ul className="timeline-list">
        {orderedEvents.map((event, idx) => {
          const label = stageLabel(event);
          return (
            <li key={idx} className="timeline-item timeline-step">
              <div className="timeline-step-header">
                <span className="timeline-stage">{label}</span>
                <span className="timeline-age">{formatDistanceToNow(event.timestamp)}</span>
              </div>
              <div className="timeline-step-meta">
                <span className="timeline-actor">{event.actor}</span>
                <span className="timeline-status">{event.status}</span>
              </div>
              <div className="timeline-time">{formatTimestamp(event.timestamp)}</div>
              <div className="timeline-note">{event.note}</div>
            </li>
          );
        })}
        {orderedEvents.length === 0 && <li className="timeline-item">No timeline events available yet.</li>}
      </ul>
    </section>
  );
}
