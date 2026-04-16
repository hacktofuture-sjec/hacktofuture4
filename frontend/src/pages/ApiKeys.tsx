import { useState } from 'react';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { extractError, securityApi, unwrap } from '../api';
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
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDate,
} from '../components/ui';

export default function ApiKeysPage() {
  const { data, loading, error, reload } = useAsync(() => securityApi.listApiKeys(), []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const rows = unwrap(data ?? undefined);

  const onCreate = async () => {
    setSubmitting(true);
    setOpError(null);
    try {
      const created = await securityApi.createApiKey({ name });
      if (created.key) setFreshKey(created.key);
      setName('');
      setShowForm(false);
      reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onRevoke = async (id: string) => {
    setOpError(null);
    try {
      await securityApi.revokeApiKey(id);
      reload();
    } catch (err) {
      setOpError(extractError(err));
    }
  };

  return (
    <>
      <SectionHeader
        title="API Keys"
        subtitle="Service-account credentials used by the FastAPI agent and internal services."
        action={
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'New key'}
          </Button>
        }
      />

      {opError && (
        <div className="mb-4">
          <ErrorBanner message={opError} />
        </div>
      )}

      {freshKey && (
        <Card className="p-4 mb-4 bg-amber-500/5 border-amber-500/25">
          <p className="text-[12px] text-amber-200 mb-2 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            Copy this key now — you won't be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 px-3 py-2 rounded-md text-[12px] font-mono text-amber-200 break-all">
              {freshKey}
            </code>
            <Button
              variant="subtle"
              onClick={() => navigator.clipboard?.writeText(freshKey)}
              className="flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </Button>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="p-5 mb-5 space-y-3">
          <Field label="Key name" hint="e.g. 'Langgraph Service', 'Ingestion Worker'.">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={submitting || !name.trim()}>
              {submitting ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<KeyRound className="w-5 h-5" />} title="No API keys yet" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Prefix</TH>
              <TH>Status</TH>
              <TH>Last used</TH>
              <TH>Created</TH>
              <TH></TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((k) => (
              <TR key={k.id}>
                <TD>{k.name}</TD>
                <TD className="text-gray-500 font-mono text-[12px]">
                  {k.prefix ? `${k.prefix}…` : '—'}
                </TD>
                <TD>
                  <Badge tone={k.revoked_at ? 'danger' : 'success'}>
                    {k.revoked_at ? 'revoked' : 'active'}
                  </Badge>
                </TD>
                <TD className="text-gray-500">{formatDate(k.last_used_at)}</TD>
                <TD className="text-gray-500">{formatDate(k.created_at)}</TD>
                <TD>
                  {!k.revoked_at && (
                    <button
                      onClick={() => onRevoke(k.id)}
                      title="Revoke"
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
