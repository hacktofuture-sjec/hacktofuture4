import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { extractError, insightsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  JsonBlock,
  SectionHeader,
  Spinner,
  TextArea,
  formatDate,
} from '../components/ui';

export default function DashboardDetailPage() {
  const { id = '' } = useParams();
  const dashboard = useAsync(() => insightsApi.getDashboard(id), [id]);
  const widgets = useAsync(() => insightsApi.listWidgets(id), [id]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  useEffect(() => {
    if (dashboard.data) {
      setName(dashboard.data.name);
      setDescription(dashboard.data.description ?? '');
    }
  }, [dashboard.data]);

  const save = async () => {
    setOpError(null);
    setSaving(true);
    try {
      await insightsApi.updateDashboard(id, { name, description });
      dashboard.reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  if (dashboard.loading) return <Spinner />;
  if (dashboard.error) return <ErrorBanner message={dashboard.error} />;
  const d = dashboard.data;
  if (!d) return <EmptyState title="Dashboard not found" />;

  const widgetList = unwrap(widgets.data ?? undefined);

  return (
    <>
      <Link
        to="/dashboards"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to dashboards
      </Link>

      <SectionHeader
        title={d.name}
        subtitle={`Updated ${formatDate(d.updated_at || d.created_at)}`}
      />

      {opError && (
        <div className="mb-4">
          <ErrorBanner message={opError} />
        </div>
      )}

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
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="flex items-center gap-1.5">
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Card>

      <h3 className="text-sm font-semibold text-white mb-3">Widgets</h3>

      {widgets.loading ? (
        <Spinner />
      ) : widgets.error ? (
        <ErrorBanner message={widgets.error} />
      ) : widgetList.length === 0 ? (
        <EmptyState title="No widgets configured" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {widgetList.map((w) => (
            <Card key={w.id} className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white">{w.title}</h4>
                <span className="text-[10px] uppercase tracking-[0.12em] text-indigo-300 font-semibold">
                  {w.widget_type}
                </span>
              </div>
              {w.config ? (
                <JsonBlock value={w.config} />
              ) : (
                <p className="text-[12px] text-gray-500">No config.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
