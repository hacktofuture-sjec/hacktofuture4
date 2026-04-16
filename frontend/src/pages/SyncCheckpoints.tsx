import { securityApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
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
} from '../components/ui';

export default function SyncCheckpointsPage() {
  const { data, loading, error } = useAsync(() => securityApi.syncCheckpoints(), []);
  const rows = unwrap(data ?? undefined);

  return (
    <>
      <SectionHeader
        title="Sync checkpoints"
        subtitle="Tracking cursors (last_synced_time) used to paginate incremental syncs."
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No checkpoints recorded" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Resource</TH>
              <TH>Account</TH>
              <TH>Last synced</TH>
              <TH>Cursor</TH>
              <TH>Updated</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((c) => (
              <TR key={c.id}>
                <TD>{c.resource}</TD>
                <TD className="text-gray-500 font-mono text-[12px]">
                  {c.integration_account_id?.slice(0, 10) || '—'}
                </TD>
                <TD className="text-gray-300">{formatDate(c.last_synced_time)}</TD>
                <TD className="text-gray-500 font-mono text-[11px]">
                  {c.cursor ? c.cursor.slice(0, 24) + (c.cursor.length > 24 ? '…' : '') : '—'}
                </TD>
                <TD className="text-gray-500">{formatDate(c.updated_at)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
