import { IncidentSnapshot } from "@/lib/types";
import { formatDistanceToNow } from "@/lib/utils";

interface Props {
  snapshot: IncidentSnapshot | null;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "n/a";
  const value = new Date(ts);
  if (Number.isNaN(value.getTime())) return ts;
  return `${value.toLocaleDateString()} ${value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} · ${formatDistanceToNow(ts)}`;
}

export default function SignalPanel({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <section className="signal-panel panel-empty">
        <h3 className="section-title">Observation Signals</h3>
        <p>No snapshot is available yet for this incident.</p>
      </section>
    );
  }

  return (
    <section className="signal-panel panel">
      <h3 className="section-title">Observation Signals</h3>
      <p className="signal-subtitle">Structured monitor output for this incident.</p>
      <div className="signal-grid">
        <div className="signal-item">
          <strong>Alert</strong>
          <div>{snapshot.alert}</div>
        </div>
        <div className="signal-item">
          <strong>Service / Pod</strong>
          <div>
            {snapshot.service} / {snapshot.pod}
          </div>
        </div>
        <div className="signal-item">
          <strong>CPU</strong>
          <div>{snapshot.metrics.cpu}</div>
        </div>
        <div className="signal-item">
          <strong>Memory</strong>
          <div>{snapshot.metrics.memory}</div>
        </div>
        <div className="signal-item">
          <strong>Restarts</strong>
          <div>{snapshot.metrics.restarts}</div>
        </div>
        <div className="signal-item">
          <strong>Latency Δ</strong>
          <div>{snapshot.metrics.latency_delta}</div>
        </div>
        <div className="signal-item">
          <strong>Failure Class</strong>
          <div>{snapshot.failure_class}</div>
        </div>
        <div className="signal-item">
          <strong>Monitor Confidence</strong>
          <div>{Math.round(snapshot.monitor_confidence * 100)}%</div>
        </div>
      </div>

      <div className="monitor-section">
        <h4 className="subsection-title">Top Events</h4>
        {snapshot.events.length === 0 ? (
          <div className="panel-empty">No Kubernetes events captured in this snapshot.</div>
        ) : (
          <div className="table-wrap">
            <table className="event-table" aria-label="Top Kubernetes events">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Type</th>
                  <th>Count</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.events.map((event, idx) => (
                  <tr key={idx}>
                    <td>{event.reason}</td>
                    <td>{event.type}</td>
                    <td>{event.count}</td>
                    <td>{formatTimestamp(event.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="monitor-section">
        <h4 className="subsection-title">Log Signatures</h4>
        {snapshot.logs_summary.length === 0 ? (
          <div className="panel-empty">No log signatures found in this snapshot.</div>
        ) : (
          <ul className="log-signature-list">
            {snapshot.logs_summary.map((log, idx) => (
              <li key={idx} className="log-signature-item">
                <span className="log-signature-text">{log.signature}</span>
                <span className="log-signature-count">×{log.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="monitor-section">
        <h4 className="subsection-title">Trace Summary</h4>
        {!snapshot.trace_summary ? (
          <div className="panel-empty">No trace summary available for this incident.</div>
        ) : (
          <div className="trace-grid">
            <div className="signal-item">
              <strong>Hot Span</strong>
              <div>{snapshot.trace_summary.hot_span}</div>
            </div>
            <div className="signal-item">
              <strong>Path</strong>
              <div>{snapshot.trace_summary.suspected_path}</div>
            </div>
            <div className="signal-item">
              <strong>P95</strong>
              <div>{snapshot.trace_summary.p95_ms} ms</div>
            </div>
          </div>
        )}
      </div>

      <details className="json-viewer" open>
        <summary className="json-summary">Monitor Snapshot JSON</summary>
        <pre className="json-code">{JSON.stringify(snapshot, null, 2)}</pre>
      </details>
    </section>
  );
}
