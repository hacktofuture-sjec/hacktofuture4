import { Sparkles } from 'lucide-react';
import { insightsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
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

export default function InsightsPage() {
  const { data, loading, error } = useAsync(() => insightsApi.list(), []);
  const rows = unwrap(data ?? undefined);

  return (
    <>
      <SectionHeader
        title="Insights"
        subtitle="Generative summaries periodically produced from normalized product data."
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-5 h-5" />}
          title="No insights yet"
          hint="Insights are generated on a schedule; check back soon."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((i) => (
            <Card key={i.id} className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">{i.title}</h3>
                <div className="flex items-center gap-2">
                  {i.category && <Badge>{i.category}</Badge>}
                  {i.severity && <Badge tone={statusTone(i.severity)}>{i.severity}</Badge>}
                </div>
              </div>
              {i.body && (
                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {i.body}
                </p>
              )}
              <p className="text-[11px] text-gray-600 mt-3">{formatDate(i.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
