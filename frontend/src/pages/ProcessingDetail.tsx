import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { processingApi, unwrap } from '../api';
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

export default function ProcessingDetailPage() {
  const { id = '' } = useParams();
  const run = useAsync(() => processingApi.getRun(id), [id]);
  const steps = useAsync(() => processingApi.listSteps(id), [id]);

  if (run.loading) return <Spinner />;
  if (run.error) return <ErrorBanner message={run.error} />;
  const r = run.data;
  if (!r) return <EmptyState title="Run not found" />;

  const stepList = unwrap(steps.data ?? undefined);

  return (
    <>
      <Link
        to="/processing"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to runs
      </Link>

      <SectionHeader
        title={`Run ${r.id.slice(0, 8)}`}
        subtitle={`${r.source || 'unknown'} · started ${formatDate(r.started_at)}`}
        action={<Badge tone={statusTone(r.status)}>{r.status}</Badge>}
      />

      <Card className="p-5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Kv label="Attempts" value={String(r.attempt_count ?? 0)} />
        <Kv
          label="Raw event"
          value={
            r.raw_event_id != null
              ? String(r.raw_event_id).slice(0, 12)
              : r.event_id != null
                ? String(r.event_id).slice(0, 12)
                : '—'
          }
        />
        <Kv label="Started" value={formatDate(r.started_at)} />
        <Kv label="Finished" value={formatDate(r.completed_at ?? r.finished_at)} />
      </Card>

      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <ArrowRight className="w-4 h-4 text-indigo-300" />
        Step transitions
      </h3>

      {steps.loading ? (
        <Spinner />
      ) : steps.error ? (
        <ErrorBanner message={steps.error} />
      ) : stepList.length === 0 ? (
        <EmptyState title="No step transitions logged" />
      ) : (
        <ol className="space-y-3">
          {stepList.map((s, idx) => (
            <li key={s.id} className="relative pl-8">
              <span className="absolute left-0 top-1 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[11px] font-semibold">
                {idx + 1}
              </span>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="text-[13px] font-medium text-gray-200">
                      {s.step_name || s.node || '—'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {formatDate(s.logged_at || s.created_at)}
                      {typeof s.duration_ms === 'number' && ` · ${s.duration_ms} ms`}
                    </p>
                  </div>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </div>

                {(s.error_message || s.error) && (
                  <p className="text-[12px] text-red-300 font-mono bg-red-500/5 border border-red-500/20 rounded px-2 py-1 mb-2">
                    {s.error_message || s.error}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(s.input_data ?? s.input) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600 font-semibold mb-1">
                        Input
                      </p>
                      <JsonBlock value={s.input_data ?? s.input} />
                    </div>
                  )}
                  {(s.output_data ?? s.output) && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600 font-semibold mb-1">
                        Output
                      </p>
                      <JsonBlock value={s.output_data ?? s.output} />
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] text-gray-600 font-medium">
        {label}
      </p>
      <p className="text-gray-200 mt-0.5 font-mono text-[12px]">{value}</p>
    </div>
  );
}
