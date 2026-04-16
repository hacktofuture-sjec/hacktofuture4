import { insightsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Card,
  EmptyState,
  ErrorBanner,
  JsonBlock,
  SectionHeader,
  Spinner,
  formatDate,
} from '../components/ui';

export default function SavedQueriesPage() {
  const { data, loading, error } = useAsync(() => insightsApi.listSavedQueries(), []);
  const rows = unwrap(data ?? undefined);

  return (
    <>
      <SectionHeader
        title="Saved Queries"
        subtitle="Query logic backing metrics, dashboards, and insights."
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No saved queries" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((q) => (
            <Card key={q.id} className="p-5">
              <h3 className="text-sm font-semibold text-white">{q.name}</h3>
              {q.description && (
                <p className="text-[12px] text-gray-500 mt-1 mb-2">{q.description}</p>
              )}
              <JsonBlock value={q.query} />
              <p className="text-[11px] text-gray-600 mt-2">{formatDate(q.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
