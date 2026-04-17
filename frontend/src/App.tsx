/**
 * Top-level router and providers. Everything under `<Layout />` requires auth
 * (enforced by <ProtectedRoute>). /login and /register are the only public
 * routes.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import DashboardPage from './pages/Dashboard';
import TicketsPage from './pages/Tickets';
import TicketDetailPage from './pages/TicketDetail';
import EventsPage from './pages/Events';
import EventDetailPage from './pages/EventDetail';
import DLQPage from './pages/DLQ';
import IntegrationsPage from './pages/Integrations';
import IntegrationDetailPage from './pages/IntegrationDetail';
import ProcessingPage from './pages/Processing';
import ProcessingDetailPage from './pages/ProcessingDetail';
import ChatPage from './pages/Chat';
import AgentPage from './pages/Agent';
import InsightsPage from './pages/Insights';
import DashboardsPage from './pages/Dashboards';
import DashboardDetailPage from './pages/DashboardDetail';
import SavedQueriesPage from './pages/SavedQueries';
import SettingsPage from './pages/Settings';
import ApiKeysPage from './pages/ApiKeys';
import AuditLogsPage from './pages/AuditLogs';
import SyncCheckpointsPage from './pages/SyncCheckpoints';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated app shell */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="insights" element={<InsightsPage />} />

            <Route path="tickets" element={<TicketsPage />} />
            <Route path="tickets/:id" element={<TicketDetailPage />} />

            <Route path="events" element={<EventsPage />} />
            <Route path="events/:id" element={<EventDetailPage />} />
            <Route path="dlq" element={<DLQPage />} />

            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="integrations/:id" element={<IntegrationDetailPage />} />

            <Route path="processing" element={<ProcessingPage />} />
            <Route path="processing/:id" element={<ProcessingDetailPage />} />

            <Route path="chat" element={<ChatPage />} />
            <Route path="agent" element={<AgentPage />} />

            <Route path="dashboards" element={<DashboardsPage />} />
            <Route path="dashboards/:id" element={<DashboardDetailPage />} />
            <Route path="saved-queries" element={<SavedQueriesPage />} />
            <Route path="sync" element={<SyncCheckpointsPage />} />

            <Route path="settings" element={<SettingsPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
