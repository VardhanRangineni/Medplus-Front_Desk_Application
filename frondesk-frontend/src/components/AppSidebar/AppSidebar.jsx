import './AppSidebar.css';
import { hasAnyRole } from '../../services/locationScope';
import {
  IconGrid, IconHome, IconUsers, IconBarChart,
  IconLogOut,
  IconClipboardList,
  IconMapPin,
  IconMonitor,
} from '../Icons/Icons';

/**
 * Role hierarchy for navigation visibility:
 *   PRIMARY_ADMIN  (Admin)       — all screens, all locations' data
 *   REGIONAL_ADMIN (Supervisor)  — all screens, their location's data only
 *   RECEPTIONIST                 — operational screens only, their location's data only
 */
const ALL_NAV_ITEMS = [
  { id: 'dashboard',       icon: <IconGrid size={20} />,            label: 'Dashboard',        roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST'] },
  { id: 'home',            icon: <IconHome size={20} />,            label: 'Check In / Out',   roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST'] },
  { id: 'reports',         icon: <IconBarChart size={20} />,        label: 'Reports',          roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN', 'RECEPTIONIST'] },
  { id: 'staff-activity',  icon: <IconClipboardList size={20} />,   label: 'Staff Activity',   roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'] },
  { id: 'user-management', icon: <IconUsers size={20} />,           label: 'User Management',  roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'] },
  { id: 'location-master', icon: <IconMapPin size={20} />,          label: 'Location Master',  roles: ['PRIMARY_ADMIN'] },
  { id: 'device-master',   icon: <IconMonitor size={20} />,         label: 'Device Master',    roles: ['PRIMARY_ADMIN', 'REGIONAL_ADMIN'] },
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
  const visibleItems = ALL_NAV_ITEMS.filter((item) => hasAnyRole(session, item.roles));

  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__nav">
        {visibleItems.map(item => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={`app-nav-btn${activeNav === item.id ? ' app-nav-btn--active' : ''}`}
            onClick={() => onNavChange?.(item.id)}
          >
            <span className="app-nav-btn__icon">{item.icon}</span>
            <span className="app-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-sidebar__bottom">
        <button type="button" title="Log Out" className="app-nav-btn app-nav-btn--logout" onClick={onLogout}>
          <span className="app-nav-btn__icon"><IconLogOut size={20} /></span>
          <span className="app-nav-label">Log Out</span>
        </button>
      </div>
    </aside>
  );
}
