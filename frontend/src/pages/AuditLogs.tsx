import { securityApi, unwrap } from '../api';
import { useAsync } from '../hooks/useAsync';
import {
  EmptyState,
  ErrorBanner,
  JsonBlock,
  SectionHeader,
  Spinner,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDate,
} from '../components/ui';
import { useState } from 'react';

export default function AuditLogsPage() {
  const { data, loading, error } = useAsync(() => securityApi.auditLogs(), []);
  const rows = unwrap(data ?? undefined);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <SectionHeader
        title="Audit logs"
        subtitle="Security-relevant events recorded across the platform, RBAC-scoped."
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No audit events recorded" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Resource</TH>
              <TH>IP</TH>
              <TH></TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((l) => {
              const isOpen = openId === l.id;
              return (
                <>
                  <TR key={l.id}>
                    <TD className="text-gray-500">{formatDate(l.created_at)}</TD>
                    <TD>{l.actor || 'system'}</TD>
                    <TD className="text-gray-200 font-mono text-[12px]">{l.action}</TD>
                    <TD className="text-gray-500">
                      {l.resource_type
                        ? `${l.resource_type}${l.resource_id ? ` · ${l.resource_id.slice(0, 10)}` : ''}`
                        : '—'}
                    </TD>
                    <TD className="text-gray-500 font-mono text-[11px]">
                      {l.ip_address || '—'}
                    </TD>
                    <TD>
                      {l.metadata && (
                        <button
                          onClick={() => setOpenId(isOpen ? null : l.id)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300"
                        >
                          {isOpen ? 'hide' : 'details'}
                        </button>
                      )}
                    </TD>
                  </TR>
                  {isOpen && l.metadata && (
                    <tr key={`${l.id}-meta`} className="border-t border-white/[0.04]">
                      <td colSpan={6} className="px-4 py-3 bg-white/[0.02]">
                        <JsonBlock value={l.metadata} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
