import React, { useState, useEffect } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isCollapsed));
    // Apply a CSS variable to the root element so pages can use it
    document.documentElement.style.setProperty(
      '--sidebar-width', 
      isCollapsed ? '4.5rem' : '16rem'
    );
  }, [isCollapsed]);

  return (
    <div className={`dashboard-layout ${isCollapsed ? 'dashboard-layout--collapsed' : ''}`}>
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div className="dashboard-layout__content">
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;
