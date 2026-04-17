/**
 * insights.urls — insights feed, dashboards, widgets, saved queries.
 */
import { apiGet, apiPost, apiPut } from './client';
import type {
  Dashboard,
  DashboardWidget,
  Insight,
  Paginated,
  SavedQuery,
} from './types';

export const insightsApi = {
  list: () => apiGet<Paginated<Insight> | Insight[]>('/insights/'),

  listDashboards: () =>
    apiGet<Paginated<Dashboard> | Dashboard[]>('/dashboards/'),

  createDashboard: (body: Partial<Dashboard>) =>
    apiPost<Dashboard, Partial<Dashboard>>('/dashboards/', body),

  getDashboard: (id: string) => apiGet<Dashboard>(`/dashboards/${id}/`),

  updateDashboard: (id: string, body: Partial<Dashboard>) =>
    apiPut<Dashboard, Partial<Dashboard>>(`/dashboards/${id}/`, body),

  listWidgets: (dashboardId: string) =>
    apiGet<Paginated<DashboardWidget> | DashboardWidget[]>(
      `/dashboards/${dashboardId}/widgets/`
    ),

  listSavedQueries: () =>
    apiGet<Paginated<SavedQuery> | SavedQuery[]>('/saved-queries/'),
};
