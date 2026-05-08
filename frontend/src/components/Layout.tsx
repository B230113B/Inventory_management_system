import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={toggleSidebar}>
          <span className="hamburger-icon">☰</span>
        </button>
        <div className="mobile-brand">
          <span className="mobile-logo">IM</span>
          <span>SwiftStock</span>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}