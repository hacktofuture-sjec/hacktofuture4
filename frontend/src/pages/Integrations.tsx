import { Link } from 'react-router-dom';
import { Briefcase, Hash, Plug } from 'lucide-react';
import { integrationsApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  Card,
  EmptyState,
  ErrorBanner,
  SectionHeader,
  Spinner,
} from '../components/ui';
import type { ReactNode } from 'react';

function ProviderIcon({ provider }: { provider: string }): ReactNode {
  const p = provider.toLowerCase();
  if (p === 'jira') return <Briefcase className="w-4 h-4 text-blue-400" />;
  if (p === 'slack') return <Hash className="w-4 h-4 text-purple-400" />;
  if (p === 'linear') return <Plug className="w-4 h-4 text-violet-400" />;
  if (p === 'hubspot') return <Plug className="w-4 h-4 text-orange-400" />;
  return <Plug className="w-4 h-4 text-gray-400" />;
}

export default function IntegrationsPage() {
  const { data, loading, error } = useAsync(() => integrationsApi.list(), []);
  const rows = unwrap(data ?? undefined);

  return (
    <>
      <SectionHeader
        title="Integrations"
        subtitle="Natively supported providers — connect an account to start syncing."
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No integrations available" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((i) => (
            <Link
              key={i.id}
              to={`/integrations/${i.id}`}
              className="block transition-all"
            >
              <Card className="p-5 h-full hover:border-indigo-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                    <ProviderIcon provider={i.provider} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{i.name}</h3>
                    <p className="text-[11px] text-gray-500 capitalize">{i.provider}</p>
                  </div>
                </div>
                {i.description && (
                  <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-3">
                    {i.description}
                  </p>
                )}
                {i.capabilities && i.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {i.capabilities.slice(0, 5).map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-gray-500"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
