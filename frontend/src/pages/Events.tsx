import { Link } from 'react-router-dom';
import { eventsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  SectionHeader,
  Spinner,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDate,
  statusTone,
} from '../components/ui';

export default function EventsPage() {
  const { data, loading, error } = useAsync(() => eventsApi.list(), []);
  const rows = unwrap(data ?? undefined);

  return (
    <>
      <SectionHeader
        title="Raw events"
        subtitle="Event-sourced JSONB webhook payloads, stored before normalization."
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No events yet"
          hint="Webhooks from your integrations will appear here in real time."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>ID</TH>
              <TH>Source</TH>
              <TH>External ID</TH>
              <TH>Status</TH>
              <TH>Attempts</TH>
              <TH>Received</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((e) => (
              <TR key={e.id}>
                <TD>
                  <Link
                    to={`/events/${e.id}`}
                    className="text-gray-200 hover:text-indigo-300 font-mono text-[12px]"
                  >
                    {e.id.slice(0, 12)}
                  </Link>
                </TD>
                <TD className="text-gray-500">{e.source || '—'}</TD>
                <TD className="text-gray-500 font-mono text-[12px]">{e.external_id || '—'}</TD>
                <TD>
                  <Badge tone={statusTone(e.status)}>{e.status || '—'}</Badge>
                </TD>
                <TD className="text-gray-500">{e.attempts ?? 0}</TD>
                <TD className="text-gray-500">{formatDate(e.received_at)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
