import { IncidentListItem } from "@/lib/types";
import IncidentCard from "./IncidentCard";

interface Props {
  incidents: IncidentListItem[];
  onSelect: (id: string) => void;
  selected: string | null;
}

export default function IncidentFeed({ incidents, onSelect, selected }: Props) {
  if (incidents.length === 0) {
    return (
      <div className="empty-feed">
        <p>
          No incidents yet. Use the <strong>Inject Fault</strong> button to start.
        </p>
      </div>
    );
  }

  return (
    <div className="incident-feed" role="list" aria-label="Incident feed">
      {incidents.map((inc) => (
        <IncidentCard
          key={inc.incident_id}
          incident={inc}
          isSelected={selected === inc.incident_id}
          onClick={() => onSelect(inc.incident_id)}
        />
      ))}
    </div>
  );
}
