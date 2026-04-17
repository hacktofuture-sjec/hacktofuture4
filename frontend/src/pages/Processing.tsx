import { Link } from 'react-router-dom';
import { processingApi, unwrap } from '../api';
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

export default function ProcessingPage() {
  const { data, loading, error } = useAsync(() => processingApi.listRuns(), []);
  const rows = unwrap(data ?? undefined);

  return (
    <>
      <SectionHeader
        title="Processing Runs"
        subtitle="Top-level LangGraph pipeline executions (Mapper → Validator → Retry → Commit)."
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No pipeline runs yet" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Run</TH>
              <TH>Source</TH>
              <TH>Status</TH>
              <TH>Attempts</TH>
              <TH>Started</TH>
              <TH>Finished</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>
                  <Link
                    to={`/processing/${r.id}`}
                    className="font-mono text-[12px] text-gray-200 hover:text-indigo-300"
                  >
                    {r.id.slice(0, 12)}
                  </Link>
                </TD>
                <TD className="text-gray-500">{r.source || '—'}</TD>
                <TD>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </TD>
                <TD className="text-gray-500">{r.attempt_count ?? 0}</TD>
                <TD className="text-gray-500">{formatDate(r.started_at)}</TD>
                <TD className="text-gray-500">
                  {formatDate(r.completed_at ?? r.finished_at)}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
