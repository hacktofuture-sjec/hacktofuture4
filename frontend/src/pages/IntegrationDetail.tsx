import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { extractError, integrationsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Badge,
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
  statusTone,
} from '../components/ui';

export default function IntegrationDetailPage() {
  const { id = '' } = useParams();
  const integration = useAsync(() => integrationsApi.get(id), [id]);
  const accounts = useAsync(() => integrationsApi.listAccounts(id), [id]);

  const [showForm, setShowForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [configText, setConfigText] = useState('{\n  "api_key": ""\n}');
  const [opError, setOpError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const onCreate = async () => {
    setOpError(null);
    setSubmitting(true);
    try {
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(configText || '{}');
      } catch {
        throw new Error('Config must be valid JSON');
      }
      await integrationsApi.createAccount(id, {
        display_name: displayName || undefined,
        config,
      });
      setShowForm(false);
      setDisplayName('');
      setConfigText('{\n  "api_key": ""\n}');
      accounts.reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onSync = async (accountId: string) => {
    setSyncing(accountId);
    setOpError(null);
    try {
      await integrationsApi.triggerSync(id, accountId);
      accounts.reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setSyncing(null);
    }
  };

  if (integration.loading) return <Spinner />;
  if (integration.error) return <ErrorBanner message={integration.error} />;
  const i = integration.data;
  if (!i) return <EmptyState title="Integration not found" />;

  const accountList = unwrap(accounts.data ?? undefined);

  return (
    <>
      <Link
        to="/integrations"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to integrations
      </Link>

      <SectionHeader
        title={i.name}
        subtitle={i.description || `${i.provider} integration`}
        action={
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Connect account'}
          </Button>
        }
      />

      {opError && (
        <div className="mb-4">
          <ErrorBanner message={opError} />
        </div>
      )}

      {showForm && (
        <Card className="p-5 mb-5">
          <h3 className="text-sm font-semibold text-white mb-3">New account</h3>
          <div className="space-y-3">
            <Field label="Display name">
              <Input
                placeholder="Acme Engineering Jira"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Field
              label="Credentials / config (JSON)"
              hint="OAuth payload or API key fields, depending on the provider."
            >
              <TextArea
                rows={6}
                className="font-mono text-[12px]"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={onCreate} disabled={submitting}>
                {submitting ? 'Connecting…' : 'Save account'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <h3 className="text-sm font-semibold text-white mb-3">Connected accounts</h3>

      {accounts.loading ? (
        <Spinner />
      ) : accounts.error ? (
        <ErrorBanner message={accounts.error} />
      ) : accountList.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          hint="Add credentials to begin syncing data from this provider."
        />
      ) : (
        <div className="space-y-3">
          {accountList.map((a) => (
            <Card
              key={a.id}
              className="p-4 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {a.display_name || `Account ${a.id.slice(0, 8)}`}
                </p>
                <p className="text-[11px] text-gray-500">
                  last synced {formatDate(a.last_synced_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusTone(a.status)}>{a.status || '—'}</Badge>
                <Button
                  variant="subtle"
                  disabled={syncing === a.id}
                  onClick={() => onSync(a.id)}
                  className="flex items-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncing === a.id ? 'animate-spin' : ''}`}
                  />
                  {syncing === a.id ? 'Syncing…' : 'Sync now'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
