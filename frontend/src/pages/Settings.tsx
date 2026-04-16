/**
 * Organization settings — profile fields, members list, invite management, roles.
 * Requires the auth context to expose the org id; since the backend `/me/`
 * response only returns the org name, we resolve the id once via the JWT
 * claims (the login response includes org_id in the decoded token).
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, UserPlus } from 'lucide-react';
import { authApi, extractError, tokenStore, unwrap } from '../api';
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
  Select,
  Spinner,
  TD,
  TH,
  THead,
  TR,
  Table,
  formatDate,
  statusTone,
} from '../components/ui';
import type { Organization } from '../api/types';

function decodeOrgIdFromToken(): string | null {
  const access = tokenStore.getAccess();
  if (!access) return null;
  try {
    const [, payload] = access.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      org_id?: string;
    };
    return decoded.org_id ?? null;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const orgId = useMemo(decodeOrgIdFromToken, []);

  const org = useAsync(
    () => (orgId ? authApi.getOrganization(orgId) : Promise.resolve(null as Organization | null)),
    [orgId]
  );
  const members = useAsync(
    () => (orgId ? authApi.listMembers(orgId) : Promise.resolve([])),
    [orgId]
  );
  const invites = useAsync(
    () => (orgId ? authApi.listInvites(orgId) : Promise.resolve([])),
    [orgId]
  );
  const roles = useAsync(() => authApi.listRoles(), []);

  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (org.data?.name) setOrgName(org.data.name);
  }, [org.data]);

  if (!orgId) {
    return (
      <ErrorBanner message="Could not resolve your organization id from the current session." />
    );
  }

  const memberList = unwrap(members.data ?? undefined);
  const inviteList = unwrap(invites.data ?? undefined);
  const roleList = unwrap(roles.data ?? undefined);

  const saveOrg = async () => {
    setSaving(true);
    setOpError(null);
    try {
      await authApi.updateOrganization(orgId, { name: orgName });
      org.reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setOpError(null);
    try {
      await authApi.createInvite(orgId, {
        email: inviteEmail.trim(),
        role: inviteRole || undefined,
      });
      setInviteEmail('');
      invites.reload();
    } catch (err) {
      setOpError(extractError(err));
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string) => {
    setOpError(null);
    try {
      await authApi.removeMember(orgId, memberId);
      members.reload();
    } catch (err) {
      setOpError(extractError(err));
    }
  };

  return (
    <>
      <SectionHeader
        title="Organization"
        subtitle="Tenant profile, members, invites, and role-based access."
      />

      {opError && (
        <div className="mb-4">
          <ErrorBanner message={opError} />
        </div>
      )}

      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Profile</h3>
        {org.loading ? (
          <Spinner />
        ) : org.error ? (
          <ErrorBanner message={org.error} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name">
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </Field>
            <Field label="Slug">
              <Input value={org.data?.slug ?? ''} disabled />
            </Field>
            <Field label="Plan">
              <Input value={org.data?.plan_tier ?? '—'} disabled />
            </Field>
            <Field label="Created">
              <Input value={formatDate(org.data?.created_at)} disabled />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={saveOrg} disabled={saving} className="flex items-center gap-1.5">
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-300" />
          Invite teammate
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-3">
          <Input
            type="email"
            placeholder="teammate@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="">Default role</option>
            {roleList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {inviting ? 'Sending…' : 'Send invite'}
          </Button>
        </div>
      </Card>

      <h3 className="text-sm font-semibold text-white mb-3">Members</h3>
      {members.loading ? (
        <Spinner />
      ) : members.error ? (
        <ErrorBanner message={members.error} />
      ) : memberList.length === 0 ? (
        <EmptyState title="No members yet" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Joined</TH>
              <TH>Status</TH>
              <TH></TH>
            </tr>
          </THead>
          <tbody>
            {memberList.map((m) => (
              <TR key={m.id}>
                <TD>{m.full_name || '—'}</TD>
                <TD className="text-gray-500">{m.email}</TD>
                <TD>
                  <Badge>{m.role_name || '—'}</Badge>
                </TD>
                <TD className="text-gray-500">{formatDate(m.joined_at)}</TD>
                <TD>
                  <Badge tone={m.is_active ? 'success' : 'neutral'}>
                    {m.is_active ? 'active' : 'inactive'}
                  </Badge>
                </TD>
                <TD>
                  <button
                    onClick={() => removeMember(m.id)}
                    title="Remove"
                    className="text-gray-500 hover:text-red-400 p-1.5 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <h3 className="text-sm font-semibold text-white mb-3 mt-8">Pending invites</h3>
      {invites.loading ? (
        <Spinner />
      ) : invites.error ? (
        <ErrorBanner message={invites.error} />
      ) : inviteList.length === 0 ? (
        <EmptyState title="No pending invites" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Expires</TH>
            </tr>
          </THead>
          <tbody>
            {inviteList.map((i) => (
              <TR key={i.id}>
                <TD>{i.email}</TD>
                <TD className="text-gray-500">{i.role}</TD>
                <TD>
                  <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                </TD>
                <TD className="text-gray-500">{formatDate(i.expires_at)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
