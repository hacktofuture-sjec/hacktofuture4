import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MessageCircle } from 'lucide-react';
import { ticketsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  JsonBlock,
  SectionHeader,
  Spinner,
  formatDate,
  statusTone,
} from '../components/ui';

export default function TicketDetailPage() {
  const { id = '' } = useParams();

  const ticket = useAsync(() => ticketsApi.get(id), [id]);
  const activities = useAsync(() => ticketsApi.activities(id), [id]);
  const comments = useAsync(() => ticketsApi.comments(id), [id]);

  if (ticket.loading) return <Spinner />;
  if (ticket.error) return <ErrorBanner message={ticket.error} />;
  const t = ticket.data;
  if (!t) return <EmptyState title="Ticket not found" />;

  const activityList = unwrap(activities.data ?? undefined);
  const commentList = unwrap(comments.data ?? undefined);

  return (
    <>
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to tickets
      </Link>

      <SectionHeader
        title={t.title}
        subtitle={`${t.provider || 'unknown'} · ${t.external_id || t.id}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(t.normalized_status)}>{t.normalized_status}</Badge>
            {t.priority && <Badge tone="neutral">{t.priority}</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-2">Description</h3>
            <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
              {t.description || '— no description —'}
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-300" />
              Comments
            </h3>
            {comments.loading ? (
              <Spinner />
            ) : comments.error ? (
              <ErrorBanner message={comments.error} />
            ) : commentList.length === 0 ? (
              <EmptyState title="No comments yet" />
            ) : (
              <ul className="space-y-3">
                {commentList.map((c) => (
                  <li
                    key={c.id}
                    className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                  >
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                      <span>{c.author_email || 'Unknown'}</span>
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-300" />
              Activity
            </h3>
            {activities.loading ? (
              <Spinner />
            ) : activities.error ? (
              <ErrorBanner message={activities.error} />
            ) : activityList.length === 0 ? (
              <EmptyState title="No activity recorded" />
            ) : (
              <ul className="space-y-2.5">
                {activityList.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 text-[13px] border-l-2 border-indigo-500/40 pl-3"
                  >
                    <div className="flex-1">
                      <p className="text-gray-300">
                        <span className="text-gray-500">{a.actor || 'system'}</span>{' '}
                        <span className="font-medium">{a.action}</span>
                        {a.from_value && a.to_value && (
                          <>
                            {' '}
                            <span className="text-gray-500">from</span>{' '}
                            <code className="text-[11px]">{a.from_value}</code>{' '}
                            <span className="text-gray-500">to</span>{' '}
                            <code className="text-[11px]">{a.to_value}</code>
                          </>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-600">{formatDate(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5 text-sm space-y-3">
            <h3 className="text-sm font-semibold text-white mb-1">Details</h3>
            <Row label="Type" value={t.normalized_type} />
            <Row label="Assignee" value={t.assignee_email} />
            <Row label="Reporter" value={t.reporter_email} />
            <Row label="Due" value={formatDate(t.due_date)} />
            <Row label="Created" value={formatDate(t.created_at)} />
            <Row label="Updated" value={formatDate(t.updated_at)} />
          </Card>

          {t.provider_metadata && Object.keys(t.provider_metadata).length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-2">Provider metadata</h3>
              <JsonBlock value={t.provider_metadata} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] uppercase tracking-[0.1em] text-gray-600 font-medium">
        {label}
      </span>
      <span className="text-gray-300 text-right truncate max-w-[60%]">{value || '—'}</span>
    </div>
  );
}
