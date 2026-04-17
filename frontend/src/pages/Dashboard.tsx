import {
  Activity,
  AlertOctagon,
  Ticket as TicketIcon,
  Sparkles,
  Plug,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import {
  eventsApi,
  insightsApi,
  integrationsApi,
  processingApi,
  ticketsApi,
  unwrap,
} from '../api';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  SectionHeader,
  Spinner,
  formatDate,
  statusTone,
} from '../components/ui';
import type { ReactNode } from 'react';
import { formatInsightText } from '../utils/apiDisplay';

function Stat({
  icon,
  label,
  value,
  hint,
  to,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  to?: string;
}) {
  const inner = (
    <Card className="p-4 h-full transition-all hover:border-indigo-500/30 hover:bg-white/[0.02]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-gray-500 font-semibold">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-gray-500">{hint}</div>}
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const tickets = useAsync(() => ticketsApi.list({ page_size: 5 }), []);
  const events = useAsync(() => eventsApi.list({ page_size: 1 }), []);
  const dlq = useAsync(() => eventsApi.listDLQ({ page_size: 1 }), []);
  const runs = useAsync(() => processingApi.listRuns({ page_size: 5 }), []);
  const insights = useAsync(() => insightsApi.list(), []);
  const integrations = useAsync(() => integrationsApi.list(), []);

  const ticketList = unwrap(tickets.data ?? undefined);
  const runList = unwrap(runs.data ?? undefined);
  const insightList = unwrap(insights.data ?? undefined);

  const countOf = (v: unknown): number | string => {
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'object' && v !== null && 'count' in (v as Record<string, unknown>)) {
      return (v as { count: number }).count ?? 0;
    }
    return 0;
  };

  return (
    <>
      <SectionHeader
        title="Welcome back"
        subtitle="Operational signal across your tools, normalized in real time."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat
          icon={<TicketIcon className="w-3.5 h-3.5" />}
          label="Tickets"
          value={countOf(tickets.data)}
          hint="Unified across providers"
          to="/tickets"
        />
        <Stat
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Events ingested"
          value={countOf(events.data)}
          hint="Raw webhook payloads"
          to="/events"
        />
        <Stat
          icon={<AlertOctagon className="w-3.5 h-3.5" />}
          label="Dead Letter Queue"
          value={countOf(dlq.data)}
          hint="Failed after 3 retries"
          to="/dlq"
        />
        <Stat
          icon={<Plug className="w-3.5 h-3.5" />}
          label="Integrations"
          value={unwrap(integrations.data ?? undefined).length}
          hint="Providers available"
          to="/integrations"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent tickets */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent tickets</h3>
            <Link
              to="/tickets"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {tickets.loading ? (
            <Spinner />
          ) : tickets.error ? (
            <ErrorBanner message={tickets.error} />
          ) : ticketList.length === 0 ? (
            <EmptyState
              title="No tickets yet"
              hint="Once an integration is connected, normalized tickets will show here."
            />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {ticketList.slice(0, 5).map((t) => (
                <li key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    to={`/tickets/${t.id}`}
                    className="flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 truncate group-hover:text-white">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {t.provider || 'unknown'} ·{' '}
                        {formatDate(t.updated_at || t.created_at)}
                      </p>
                    </div>
                    <Badge tone={statusTone(t.normalized_status)}>
                      {t.normalized_status || '—'}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent runs */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Pipeline runs</h3>
            <Link
              to="/processing"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {runs.loading ? (
            <Spinner />
          ) : runs.error ? (
            <ErrorBanner message={runs.error} />
          ) : runList.length === 0 ? (
            <EmptyState title="No runs yet" />
          ) : (
            <ul className="space-y-2.5">
              {runList.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <Link
                      to={`/processing/${r.id}`}
                      className="text-gray-200 hover:text-white truncate block text-[13px]"
                    >
                      Run {r.id.slice(0, 8)}
                    </Link>
                    <p className="text-[11px] text-gray-500">
                      {r.source || 'unknown'} · {formatDate(r.started_at)}
                    </p>
                  </div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Insights */}
        <Card className="lg:col-span-3 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              Generated insights
            </h3>
            <Link
              to="/insights"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {insights.loading ? (
            <Spinner />
          ) : insights.error ? (
            <ErrorBanner message={insights.error} />
          ) : insightList.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-5 h-5" />}
              title="No insights yet"
              hint="Insights are generated periodically from unified ticket activity."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insightList.slice(0, 4).map((i) => {
                const insightPreview = formatInsightText(i);
                return (
                <div
                  key={i.id}
                  className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h4 className="text-[13px] font-medium text-gray-200">{i.title}</h4>
                    {i.severity && <Badge tone={statusTone(i.severity)}>{i.severity}</Badge>}
                  </div>
                  {insightPreview.trim() !== '' && (
                    <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-3">
                      {insightPreview}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-600 mt-2">{formatDate(i.created_at)}</p>
                </div>
              );})}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
