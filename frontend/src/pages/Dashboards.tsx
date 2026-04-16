import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { extractError, insightsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  SectionHeader,
  Spinner,
  TextArea,
  formatDate,
} from '../components/ui';

export default function DashboardsPage() {
  const { data, loading, error, reload } = useAsync(
    () => insightsApi.listDashboards(),
    []
  );
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const rows = unwrap(data ?? undefined);

  const onCreate = async () => {
    setOpError(null);
    setSubmitting(true);
    try {
      await insightsApi.createDashboard({ name, description });
      setName('');
      setDescription('');
      setShowForm(false);
      reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Dashboards"
        subtitle="Custom widget containers mapped to users / organizations."
        action={
          <Button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'New dashboard'}
          </Button>
        }
      />

      {opError && (
        <div className="mb-4">
          <ErrorBanner message={opError} />
        </div>
      )}

      {showForm && (
        <Card className="p-5 mb-5 space-y-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description">
            <TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!name.trim() || submitting}>
              {submitting ? 'Creating…' : 'Create dashboard'}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No dashboards yet" hint="Create your first dashboard to pin widgets." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((d) => (
            <Link key={d.id} to={`/dashboards/${d.id}`}>
              <Card className="p-5 h-full hover:border-indigo-500/30 transition-all">
                <h3 className="text-sm font-semibold text-white">{d.name}</h3>
                {d.description && (
                  <p className="text-[12px] text-gray-500 mt-1 line-clamp-3">{d.description}</p>
                )}
                <p className="text-[11px] text-gray-600 mt-3">
                  Updated {formatDate(d.updated_at || d.created_at)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
