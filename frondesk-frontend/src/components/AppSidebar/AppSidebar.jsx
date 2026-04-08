import './AppSidebar.css';
import {
  IconGrid, IconHome, IconUsers, IconBarChart,
  IconSettings, IconLogOut, IconUserCog, IconBuilding,
} from '../Icons/Icons';

const ALL_NAV_ITEMS = [
  { id: 'dashboard',       icon: <IconGrid size={20} />,     label: 'Dashboard',       roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST'] },
  { id: 'home',            icon: <IconHome size={20} />,     label: 'Home',            roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST'] },
  { id: 'user-management', icon: <IconUsers size={20} />,    label: 'User Management', roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'] },
  { id: 'reports',         icon: <IconBarChart size={20} />, label: 'Reports',         roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST'] },
  { id: 'user-master',     icon: <IconUserCog size={20} />,  label: 'User Master',     roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'] },
  { id: 'location-master', icon: <IconBuilding size={20} />, label: 'Location Master', roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'] },
];

/**
 * AppSidebar — floating glass sidebar used across all app screens.
 * Expands on hover to show icon + label.
 * Nav items are filtered by the current user's role.
 *
 * Props:
 *   session     – session object containing `role` (e.g. 'RECEPTIONIST')
 *   activeNav   – string id of the active nav item (e.g. 'dashboard')
 *   onNavChange – (id: string) => void
 *   onLogout    – () => void
 */
export default function AppSidebar({ session, activeNav, onNavChange, onLogout }) {
  const role = session?.role ?? 'RECEPTIONIST';

  const visibleItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(role));

  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__nav">
        {visibleItems.map(item => (
          <button
            key={item.id}
            className={`app-nav-btn${activeNav === item.id ? ' app-nav-btn--active' : ''}`}
            onClick={() => onNavChange?.(item.id)}
          >
            <span className="app-nav-btn__icon">{item.icon}</span>
            <span className="app-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-sidebar__bottom">
        <button
          className={`app-nav-btn${activeNav === 'settings' ? ' app-nav-btn--active' : ''}`}
          onClick={() => onNavChange?.('settings')}
        >
          <span className="app-nav-btn__icon"><IconSettings size={20} /></span>
          <span className="app-nav-label">Settings</span>
        </button>
        <button className="app-nav-btn app-nav-btn--logout" onClick={onLogout}>
          <span className="app-nav-btn__icon"><IconLogOut size={20} /></span>
          <span className="app-nav-label">Log Out</span>
        </button>
      </div>
    </aside>
  );
}
