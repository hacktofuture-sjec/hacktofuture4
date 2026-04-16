"use client";
import { useEffect, useState } from "react";
import { TimelineEvent } from "@/lib/types";
import { api } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";

interface Props {
  incidentId: string;
}

export default function TimelinePanel({ incidentId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <ul className="timeline-list">
        {events.map((event, idx) => (
          <li key={idx} className="timeline-item">
            <div>{event.timestamp}</div>
            <div>
              {event.status} · {event.actor}
            </div>
            <div>{event.note}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
