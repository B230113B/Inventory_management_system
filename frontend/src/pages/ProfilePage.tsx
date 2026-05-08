import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setIsChangingPassword(true);

    try {
      await api.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword,
        passwordData.confirmPassword
      );
      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMessage(null);
      }, 2000);
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to change password',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Profile</h1>
        <p>Manage your account settings</p>
      </div>

      <div className="profile-container">
        <div className="card profile-card">
          <div className="card-body">
            <div className="profile-header">
              <div className="profile-avatar">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="profile-info">
                <h2>{user?.username}</h2>
                <span className={`user-role role-${user?.role}`}>
                  {user?.role === 'admin' ? 'Administrator' : 'Staff Member'}
                </span>
              </div>
            </div>

            <div className="profile-details">
              <div className="profile-field">
                <label>Username</label>
                <span>{user?.username}</span>
              </div>
              <div className="profile-field">
                <label>Email</label>
                <span>{user?.email}</span>
              </div>
              <div className="profile-field">
                <label>Role</label>
                <span>{user?.role === 'admin' ? 'Administrator' : 'Staff Member'}</span>
              </div>
              <div className="profile-field">
                <label>Account Status</label>
                <span className={user?.is_active ? 'status-active' : 'status-inactive'}>
                  {user?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="profile-field">
                <label>Member Since</label>
                <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            <div className="profile-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => setShowPasswordModal(true)} className="btn btn-secondary btn-lg">
                🔐 Change Password
              </button>
              <button onClick={handleLogout} className="btn btn-danger btn-lg">
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>🔐 Change Password</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label htmlFor="currentPassword">Current Password</label>
                  <input
                    type="password"
                    id="currentPassword"
                    className="form-control"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    className="form-control"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                    minLength={8}
                  />
                  <small className="form-text text-muted">At least 8 characters</small>
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    className="form-control"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
                {passwordMessage && (
                  <div className={`alert alert-${passwordMessage.type === 'success' ? 'success' : 'error'}`}>
                    {passwordMessage.text}
                  </div>
                )}
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}