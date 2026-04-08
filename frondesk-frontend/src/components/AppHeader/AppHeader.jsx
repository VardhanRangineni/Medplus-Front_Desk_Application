import './AppHeader.css';
import logo from '../../assets/images/logo.png';
import { IconMapPin } from '../Icons/Icons';

function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * AppHeader — floating glass header used across all app screens.
 *
 * Props:
 *   session  – { fullName, employeeId, locationName, locationId, role }
 */
export default function AppHeader({ session }) {
  const dateStr  = formatDate(new Date());
  const initial  = (session?.fullName?.[0] ?? session?.employeeId?.[0] ?? 'A').toUpperCase();
  const location = session?.locationName ?? null;

  return (
    <header className="app-header">
      <div className="app-header__left">
        <img src={logo} alt="MedPlus" className="app-header__logo" />
        <div>
          <h1 className="app-header__title">Front Desk</h1>
          <p className="app-header__date">{dateStr}</p>
        </div>
      </div>

      <div className="app-header__right">
        {location && (
          <div className="app-header__location">
            <IconMapPin size={13} />
            <span className="app-header__location-name">{location}</span>
          </div>
        )}
        <div className="app-header__user">
          <div className="app-header__avatar">{initial}</div>
          <span className="app-header__username">
            {session?.fullName ?? session?.employeeId}
          </span>
        </div>
      </div>
    </header>
  );
}
