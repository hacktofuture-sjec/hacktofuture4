interface Props {
  connected: boolean;
}

export default function ConnectionBadge({ connected }: Props) {
  return (
    <span className="connection-badge">
      {connected ? "WebSocket Connected" : "WebSocket Disconnected"}
    </span>
  );
}
