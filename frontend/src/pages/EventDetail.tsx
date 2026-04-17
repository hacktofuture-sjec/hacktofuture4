import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { eventsApi } from '../api';
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

export default function EventDetailPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useAsync(() => eventsApi.get(id), [id]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return <EmptyState title="Event not found" />;

  return (
    <>
      <Link
        to="/events"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to events
      </Link>
      <SectionHeader
        title={`Event ${data.id.slice(0, 8)}`}
        subtitle={`${data.source || 'unknown'} · ${formatDate(data.received_at)}`}
        action={<Badge tone={statusTone(data.status)}>{data.status || '—'}</Badge>}
      />

      <Card className="p-5 mb-4 text-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Meta label="Integration" value={data.integration_id} />
        <Meta label="External ID" value={data.external_id} />
        <Meta label="Attempts" value={String(data.attempts ?? 0)} />
        <Meta label="Processed at" value={formatDate(data.processed_at)} />
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-2">Raw payload</h3>
        <JsonBlock value={data.payload} />
      </Card>
    </>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] text-gray-600 font-medium">
        {label}
      </p>
      <p className="text-gray-200 font-mono text-[12px] break-all">{value || '—'}</p>
    </div>
  );
}
