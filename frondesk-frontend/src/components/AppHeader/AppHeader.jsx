import './AppHeader.css';
import logo from '../../assets/images/logo.png';
import { IconMapPin, IconChevronDown, IconCalendar } from '../Icons/Icons';

function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * AppHeader — floating glass header used across all app screens.
 *
 * Props:
 *   session  – { fullName, employeeId, locationName }
 */
export default function AppHeader({ session }) {
  const today     = new Date();
  const dateStr   = formatDate(today);
  const dateShort = formatDateShort(today);
  const initial   = (session?.fullName?.[0] ?? session?.employeeId?.[0] ?? 'A').toUpperCase();

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
        <button className="app-header__pill">
          <IconMapPin size={13} />
          <span>{session?.locationName ?? 'Corporate Office'}</span>
          <IconChevronDown size={13} />
        </button>

        <button className="app-header__datepill">
          <IconCalendar size={13} />
          <span>{dateShort} – {dateShort}</span>
        </button>

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
