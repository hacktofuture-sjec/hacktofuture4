import { IncidentStatus } from "@/lib/types";

interface Props {
  status: IncidentStatus;
}

const colorByStatus: Record<IncidentStatus, string> = {
  open: "var(--color-open)",
  diagnosing: "var(--color-diagnosing)",
  planned: "var(--color-planned)",
  pending_approval: "var(--color-pending)",
  executing: "var(--color-executing)",
  verifying: "var(--color-verifying)",
  resolved: "var(--color-resolved)",
  failed: "var(--color-failed)",
};

export default function StatusDot({ status }: Props) {
  return (
    <span
      className="status-dot"
      aria-label={`status-${status}`}
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: colorByStatus[status],
      }}
    />
  );
}
