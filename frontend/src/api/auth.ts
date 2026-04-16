/**
 * accounts.urls — auth, org, RBAC, invites.
 */
import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type {
  AuthTokens,
  Organization,
  OrganizationInvite,
  OrganizationMember,
  Paginated,
  Role,
  UserProfile,
} from './types';

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  timezone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (body: RegisterPayload) =>
    apiPost<AuthTokens & { user_id: string; email: string }, RegisterPayload>(
      '/auth/register/',
      body
    ),

  // Django SimpleJWT's TokenObtainPair expects "username" field by default. Our
  // custom serializer uses email as the USERNAME_FIELD on the user model, so we
  // send both for compatibility with Django's auth backend.
  login: (body: LoginPayload) =>
    apiPost<AuthTokens>('/auth/login/', {
      email: body.email,
      username: body.email,
      password: body.password,
    }),

  logout: (refresh: string) =>
    apiPost<{ detail: string }>('/auth/logout/', { refresh }),

  refresh: (refresh: string) =>
    apiPost<{ access: string }>('/auth/refresh/', { refresh }),

  me: () => apiGet<UserProfile>('/auth/me/'),

  updateMe: (body: Partial<UserProfile>) =>
    apiPatch<UserProfile, Partial<UserProfile>>('/auth/me/', body),

  getOrganization: (id: string) =>
    apiGet<Organization>(`/auth/organizations/${id}/`),

  updateOrganization: (id: string, body: Partial<Organization>) =>
    apiPatch<Organization, Partial<Organization>>(
      `/auth/organizations/${id}/`,
      body
    ),

  listMembers: (orgId: string) =>
    apiGet<Paginated<OrganizationMember> | OrganizationMember[]>(
      `/auth/organizations/${orgId}/members/`
    ),

  addMember: (orgId: string, body: { email: string; role?: string }) =>
    apiPost<OrganizationMember>(
      `/auth/organizations/${orgId}/members/`,
      body
    ),

  removeMember: (orgId: string, memberId: string) =>
    apiDelete(`/auth/organizations/${orgId}/members/${memberId}/`),

  listInvites: (orgId: string) =>
    apiGet<Paginated<OrganizationInvite> | OrganizationInvite[]>(
      `/auth/organizations/${orgId}/invites/`
    ),

  createInvite: (orgId: string, body: { email: string; role?: string }) =>
    apiPost<OrganizationInvite>(
      `/auth/organizations/${orgId}/invites/`,
      body
    ),

  acceptInvite: (orgId: string, token: string) =>
    apiPost<{ detail: string }>(
      `/auth/organizations/${orgId}/invites/${token}/accept/`
    ),

  listRoles: () => apiGet<Paginated<Role> | Role[]>('/auth/roles/'),
};
