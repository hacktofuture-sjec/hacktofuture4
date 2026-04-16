import type { TopbarProps } from '../../types';
import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

export default function Topbar({ title, breadcrumb }: TopbarProps) {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar__breadcrumb">
        <span className="topbar__breadcrumb-path">{breadcrumb}</span>
        <span className="topbar__breadcrumb-sep">/</span>
        <span className="topbar__breadcrumb-current">{title}</span>
      </div>

      <div className="topbar__actions">
        <button className="topbar__notify-btn" aria-label="Notifications" type="button">
          <span className="material-symbols-outlined topbar__notify-icon">notifications</span>
        </button>

        <div className="topbar__divider" aria-hidden="true" />

        <div className="topbar__profile">
          <div className="topbar__profile-info">
            <div className="topbar__profile-name">{user?.name ?? user?.login ?? 'User'}</div>
            <div className="topbar__profile-role">Maintainer</div>
          </div>
          {user?.avatar_url ? (
            <img
              alt={user.login}
              className="topbar__profile-img"
              src={user.avatar_url}
            />
          ) : (
            <div className="topbar__profile-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-container-high)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
