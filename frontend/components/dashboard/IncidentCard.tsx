import { IncidentListItem } from "@/lib/types";
import StatusDot from "@/components/ui/StatusDot";
import Badge from "@/components/ui/Badge";
import { formatDistanceToNow } from "@/lib/utils";

interface Props {
  incident: IncidentListItem;
  isSelected: boolean;
  onClick: () => void;
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
        <StatusDot status={incident.status} />
        <span className="service-name">{incident.service}</span>
        <span className="status-label">{incident.status.replace(/_/g, " ")}</span>
        <Badge variant={incident.severity}>{incident.severity}</Badge>
      </div>
      <div className="card-body">
        <span className="failure-class">{incident.failure_class.replace(/_/g, " ")}</span>
        <span className="confidence">Monitor confidence: {Math.round(incident.monitor_confidence * 100)}%</span>
      </div>
      <div className="card-footer">
        <span className="incident-id">{incident.incident_id}</span>
        <span className="time-ago">{formatDistanceToNow(incident.created_at)}</span>
      </div>
    </div>
  );
}
