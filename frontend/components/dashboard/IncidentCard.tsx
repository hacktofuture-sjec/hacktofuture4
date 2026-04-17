import { IncidentListItem } from "@/lib/types";
import StatusDot from "@/components/ui/StatusDot";
import Badge from "@/components/ui/Badge";
import { formatDistanceToNow } from "@/lib/utils";

interface Props {
  incident: IncidentListItem;
  isSelected: boolean;
  onClick: () => void;
}

function toTitle(text: string): string {
  return text
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export default function IncidentCard({ incident, isSelected, onClick }: Props) {
  return (
    <div
      id={`incident-card-${incident.incident_id}`}
      className={`incident-card ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.key === " ") {
            e.preventDefault();
          }
          onClick();
        }
      }}
      aria-selected={isSelected}
    >
      <div className="card-header">
        <div className="card-title-row">
          <StatusDot status={incident.status} />
          <span className="service-name">{incident.service}</span>
        </div>
        <Badge variant={incident.severity}>{incident.severity}</Badge>
      </div>
      <div className="card-body">
        <div className="card-row">
          <span className="card-key">Failure</span>
          <span className="card-value failure-class">{toTitle(incident.failure_class)}</span>
        </div>
        <div className="card-row">
          <span className="card-key">Confidence</span>
          <span className="card-value confidence">{Math.round(incident.monitor_confidence * 100)}%</span>
        </div>
      </div>
      <div className="card-footer">
        <span className="incident-id">{incident.incident_id}</span>
        <span className="time-ago">{formatDistanceToNow(incident.created_at)}</span>
      </div>
    </div>
  );
}
