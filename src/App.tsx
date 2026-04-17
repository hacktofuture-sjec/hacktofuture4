import { useState } from 'react';
import Sidebar, { Page } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Animals from './pages/Animals';
import CCTVMonitoring from './pages/CCTVMonitoring';
import ImageAnalysis from './pages/ImageAnalysis';
import Alerts from './pages/Alerts';
import ManualCheckIn from './pages/ManualCheckIn';
import { Menu } from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle: Record<Page, string> = {
    dashboard: 'Dashboard',
    animals: 'Animals',
    monitoring: 'CCTV Monitoring',
    'image-analysis': 'Image Analysis',
    'manual-checkin': 'Manual Check-In',
    alerts: 'Alerts',
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'animals': return <Animals />;
      case 'monitoring': return <CCTVMonitoring />;
      case 'image-analysis': return <ImageAnalysis />;
      case 'manual-checkin': return <ManualCheckIn />;
      case 'alerts': return <Alerts />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar
          currentPage={currentPage}
          onNavigate={(page) => setCurrentPage(page)}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Sidebar - mobile */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          currentPage={currentPage}
          onNavigate={(page) => { setCurrentPage(page); setMobileMenuOpen(false); }}
          collapsed={false}
          onToggle={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
          <button
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800">{pageTitle[currentPage]}</h2>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-500">CattleWatch AI</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              System Active
            </div>
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              VT
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
