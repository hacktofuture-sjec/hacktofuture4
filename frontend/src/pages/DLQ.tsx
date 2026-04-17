import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { eventsApi, extractError, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  JsonBlock,
  SectionHeader,
  Spinner,
  formatDate,
} from '../components/ui';

export default function DLQPage() {
  const { data, loading, error, reload } = useAsync(() => eventsApi.listDLQ(), []);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const rows = unwrap(data ?? undefined);

  const retry = async (id: string) => {
    setRetrying(id);
    setOpError(null);
    try {
      await eventsApi.retryDLQ(id);
      reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setRetrying(null);
    }
  };

  return (
    <>
      <SectionHeader
        title="Dead Letter Queue"
        subtitle="Events that failed validation after 3 LangGraph retries."
      />

      {opError && (
        <div className="mb-4">
          <ErrorBanner message={opError} />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="DLQ is clean"
          hint="No events have failed validation recently. Nice."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-200 font-medium">
                    {item.reason || 'Validation failed'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                    {item.id} · attempts {item.attempts ?? 0} · last{' '}
                    {formatDate(item.last_attempt_at)}
                  </p>
                </div>
                <Button
                  variant="subtle"
                  disabled={retrying === item.id}
                  onClick={() => retry(item.id)}
                  className="flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {retrying === item.id ? 'Retrying…' : 'Retry'}
                </Button>
              </div>

              {item.validation_errors && item.validation_errors.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {item.validation_errors.map((e, idx) => (
                    <li
                      key={idx}
                      className="text-[12px] text-red-300 font-mono bg-red-500/5 border border-red-500/20 rounded px-2 py-1"
                    >
                      {e}
                    </li>
                  ))}
                </ul>
              )}

              {item.payload && <JsonBlock value={item.payload} />}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
