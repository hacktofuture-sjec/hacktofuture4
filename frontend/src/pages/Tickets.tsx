import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ticketsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  Input,
  SectionHeader,
  Select,
  Spinner,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDate,
  statusTone,
} from '../components/ui';

const STATUSES = ['', 'open', 'in_progress', 'blocked', 'resolved'];

export default function TicketsPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const { data, loading, error } = useAsync(
    () => ticketsApi.list({ status: status || undefined }),
    [status]
  );

  const rows = useMemo(() => {
    const list = unwrap(data ?? undefined);
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((t) =>
      `${t.title ?? ''} ${t.external_id ?? ''} ${t.provider ?? ''}`
        .toLowerCase()
        .includes(needle)
    );
  }, [data, q]);

  return (
    <>
      <SectionHeader
        title="Unified Tickets"
        subtitle="AI-normalized tickets across Jira, Linear, HubSpot and more."
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <Input
            placeholder="Filter by title, id, provider…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:w-48"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.replace('_', ' ') : 'All statuses'}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No tickets match these filters" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Title</TH>
              <TH>Provider</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH>Assignee</TH>
              <TH>Updated</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link to={`/tickets/${t.id}`} className="text-gray-100 hover:text-indigo-300">
                    <span className="text-gray-500 mr-2">
                      {t.external_id || t.id.slice(0, 8)}
                    </span>
                    {t.title}
                  </Link>
                </TD>
                <TD className="text-gray-500">{t.provider || '—'}</TD>
                <TD className="text-gray-500">{t.normalized_type || '—'}</TD>
                <TD>
                  <Badge tone={statusTone(t.normalized_status)}>
                    {t.normalized_status || '—'}
                  </Badge>
                </TD>
                <TD className="text-gray-500">{t.assignee_email || '—'}</TD>
                <TD className="text-gray-500">
                  {formatDate(t.updated_at || t.created_at)}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
