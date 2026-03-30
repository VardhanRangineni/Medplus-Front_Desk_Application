import './AppSidebar.css';
import {
  IconGrid, IconHome, IconUsers, IconBarChart,
  IconSettings, IconLogOut, IconUserCog, IconBuilding,
} from '../Icons/Icons';

const NAV_ITEMS = [
  { id: 'dashboard',       icon: <IconGrid size={20} />,     label: 'Dashboard'       },
  { id: 'home',            icon: <IconHome size={20} />,     label: 'Home'            },
  { id: 'user-management', icon: <IconUsers size={20} />,    label: 'User Management' },
  { id: 'reports',         icon: <IconBarChart size={20} />, label: 'Reports'         },
  { id: 'user-master',     icon: <IconUserCog size={20} />,  label: 'User Master'     },
  { id: 'location-master', icon: <IconBuilding size={20} />, label: 'Location Master' },
];

/**
 * AppSidebar — floating glass sidebar used across all app screens.
 * Expands on hover to show icon + label.
 *
 * Props:
 *   activeNav   – string id of the active nav item (e.g. 'dashboard')
 *   onNavChange – (id: string) => void
 *   onLogout    – () => void
 */
export default function AppSidebar({ activeNav, onNavChange, onLogout }) {
  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__nav">
        {NAV_ITEMS.map(item => (
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
        <button className="app-nav-btn">
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
