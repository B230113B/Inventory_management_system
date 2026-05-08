import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/products', label: 'Product Stock', icon: '📦' },
    { path: '/orders', label: 'Order Management', icon: '📋' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  const handleNavClick = () => {
    onClose();
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  return (
    <>
      {/* Desktop Sidebar - always visible on large screens */}
      <aside className="sidebar desktop-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">IM</div>
          <div className="sidebar-brand">
            <h2>SwiftStock</h2>
            <span>Inventory Portal</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username}</span>
              <span className={`user-role role-${user?.role}`}>
                {user?.role === 'admin' ? 'Administrator' : 'Staff'}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer - slide in/out on small screens */}
      <aside className={`sidebar mobile-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">IM</div>
          <div className="sidebar-brand">
            <h2>SwiftStock</h2>
            <span>Inventory Portal</span>
          </div>
          <button className="sidebar-close-btn" onClick={onClose}>×</button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={handleNavClick}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username}</span>
              <span className={`user-role role-${user?.role}`}>
                {user?.role === 'admin' ? 'Administrator' : 'Staff'}
              </span>
            </div>
          </div>
          <button onClick={() => { handleLogout(); onClose(); }} className="btn-logout">
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>
    </>
  );
}