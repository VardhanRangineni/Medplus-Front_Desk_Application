import logo from './assets/logo.png';
import screenshotDashboard from './assets/Dashboard.png';
import screenshotCheckIn from './assets/Check In-out.png';
import screenshotReports from './assets/Reports.png';
import screenshotStaffActivity from './assets/Staff Activity.png';
import screenshotUserManagement from './assets/User Management.png';
import './App.css';

const INSTALLER_FILENAME = 'MedPlus Visitor Management System Setup 1.0.0.exe';
const INSTALLER_DOWNLOAD_URL = 'https://drive.google.com/file/d/1SDVAVU8gX1uiGybCSiwqRX_QLOOlZ6BM/view?usp=sharing';
const APP_VERSION = '1.0.0';

const FEATURES = [
  {
    title: 'Visitor & Employee Check-in',
    desc: 'Register visitors and employees at reception with guided forms, HRMS lookup, and instant check-in/out.',
    icon: 'checkin',
  },
  {
    title: 'QR Pre-registration',
    desc: 'Visitors pre-register online and arrive with a QR code — scan at the desk for fast, contactless entry.',
    icon: 'qr',
  },
  {
    title: 'Real-time Dashboard',
    desc: 'Live stats on today\'s visitors, check-ins, and footfall trends across your location.',
    icon: 'dashboard',
  },
  {
    title: 'Reports & Export',
    desc: 'Filter by date, department, and status. Export visitor logs to Excel for audits and compliance.',
    icon: 'reports',
  },
  {
    title: 'Card Management',
    desc: 'Assign and track visitor access cards. Print card layouts configured for your site.',
    icon: 'card',
  },
  {
    title: 'Role-based Access',
    desc: 'Receptionist, Regional Admin, and Primary Admin roles with location-scoped permissions.',
    icon: 'roles',
  },
];

const BENEFITS = [
  { title: 'Faster reception workflows', desc: 'Reduce queue time with QR pre-reg, HRMS auto-fill, and one-screen check-in/out.' },
  { title: 'Accurate visitor records', desc: 'Every entry is timestamped with person-to-meet, department, reason, and card number.' },
  { title: 'Secure workstation login', desc: 'Sessions bind to workstation MAC so only authorised PCs can access the desk app.' },
  { title: 'Multi-location ready', desc: 'Admins switch locations; regional supervisors see data scoped to their site.' },
  { title: 'Audit-ready reporting', desc: 'Historical logs, frequent-visitor insights, and Excel export for compliance reviews.' },
  { title: 'Desktop-native experience', desc: 'Windows installer with shortcuts — no browser tabs, built for front-desk daily use.' },
];

function Icon({ name, size = 22 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true };
  switch (name) {
    case 'download':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case 'checkin':
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </svg>
      );
    case 'qr':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
        </svg>
      );
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'card':
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'roles':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return null;
  }
}

function DownloadButton({ className = '', children, size }) {
  return (
    <a
      href={INSTALLER_DOWNLOAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`lp-btn lp-btn--primary ${size === 'sm' ? 'lp-btn--sm' : ''} ${className}`.trim()}
    >
      <Icon name="download" size={18} />
      {children ?? 'Download for Windows'}
    </a>
  );
}

const SCREENSHOTS = [
  { label: 'Dashboard — live visitor stats', title: 'MedPlus MVMS — Dashboard', src: screenshotDashboard },
  { label: 'Check In / Out — reception desk', title: 'MedPlus MVMS — Check In / Out', src: screenshotCheckIn },
  { label: 'Reports — filters & export', title: 'MedPlus MVMS — Reports', src: screenshotReports },
  { label: 'Staff activity log', title: 'MedPlus MVMS — Staff Activity', src: screenshotStaffActivity },
  { label: 'User management', title: 'MedPlus MVMS — User Management', src: screenshotUserManagement },
];

function ScreenshotImage({ src, alt }) {
  return (
    <img
      src={src}
      alt={alt}
      className="lp-shot__img"
      loading="lazy"
    />
  );
}

export default function App() {
  return (
    <div className="lp-page">
      <header className="lp-header">
        <div className="lp-container lp-header__inner">
          <a href="#" className="lp-brand">
            <img src={logo} alt="MedPlus Visitor" className="lp-brand__logo" />
            <div className="lp-brand__text">
              <span className="lp-brand__name">MedPlus Visitor</span>
              <span className="lp-brand__tag">Management System</span>
            </div>
          </a>
          <nav className="lp-nav" aria-label="Page sections">
            <a href="#features">Features</a>
            <a href="#screenshots">Screenshots</a>
            <a href="#requirements">Requirements</a>
            <a href="#download">Download</a>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-container lp-hero__grid">
          <div className="lp-hero__content">
            <span className="lp-hero__badge">Windows Desktop · v{APP_VERSION}</span>
            <h1 className="lp-hero__title">
              MedPlus Visitor Management System
            </h1>
            <p className="lp-hero__sub">
              The all-in-one reception desk app for visitor check-in, employee entry,
              QR pre-registration, reports, and card management — built for MedPlus locations.
            </p>
            <div className="lp-hero__actions">
              <DownloadButton>Download for Windows</DownloadButton>
              <a href="#features" className="lp-btn lp-btn--outline lp-btn--hero-outline">Explore features</a>
            </div>
            <p className="lp-hero__meta">
              {INSTALLER_FILENAME} · Windows 10/11 (64-bit)
            </p>
          </div>
          <div className="lp-hero__visual">
            <img src={logo} alt="MedPlus Visitor Management System" className="lp-hero__logo" />
          </div>
        </div>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-container">
          <div className="lp-section__head">
            <span className="lp-section__eyebrow">Features</span>
            <h2 className="lp-section__title">Everything reception needs, in one app</h2>
            <p className="lp-section__sub">
              From walk-in visitors to scheduled meetings — manage every entry with speed and accuracy.
            </p>
          </div>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feature">
                <div className="lp-feature__icon">
                  <Icon name={f.icon} />
                </div>
                <h3 className="lp-feature__title">{f.title}</h3>
                <p className="lp-feature__desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--alt">
        <div className="lp-container">
          <div className="lp-section__head">
            <span className="lp-section__eyebrow">Benefits</span>
            <h2 className="lp-section__title">Why teams choose MVMS</h2>
            <p className="lp-section__sub">
              Designed for high-traffic reception desks with security, speed, and reporting built in.
            </p>
          </div>
          <div className="lp-benefits">
            {BENEFITS.map((b) => (
              <div key={b.title} className="lp-benefit">
                <span className="lp-benefit__check" aria-hidden="true">✓</span>
                <div>
                  <p className="lp-benefit__title">{b.title}</p>
                  <p className="lp-benefit__desc">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="screenshots" className="lp-section">
        <div className="lp-container">
          <div className="lp-section__head">
            <span className="lp-section__eyebrow">Screenshots</span>
            <h2 className="lp-section__title">A glimpse of the workspace</h2>
            <p className="lp-section__sub">
              Clean, focused screens built for daily front-desk use — dashboard, check-in, reports, and QR flows.
            </p>
          </div>
          <div className="lp-screenshots">
            {SCREENSHOTS.map(({ label, title, src }) => (
              <figure key={label} className="lp-shot">
                <div className="lp-shot__chrome">
                  <span className="lp-shot__dot lp-shot__dot--r" />
                  <span className="lp-shot__dot lp-shot__dot--y" />
                  <span className="lp-shot__dot lp-shot__dot--g" />
                  <span className="lp-shot__title-bar">{title}</span>
                </div>
                <div className="lp-shot__body">
                  <ScreenshotImage src={src} alt={label} />
                </div>
                <figcaption className="lp-shot__label">{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="requirements" className="lp-section lp-section--alt">
        <div className="lp-container">
          <div className="lp-section__head">
            <span className="lp-section__eyebrow">System requirements</span>
            <h2 className="lp-section__title">Ready for your reception PCs</h2>
            <p className="lp-section__sub">
              Install once per workstation. The app connects to your configured MVMS backend API.
            </p>
          </div>
          <div className="lp-req-grid">
            <div className="lp-req-card">
              <h3>
                <Icon name="download" size={20} />
                Minimum requirements
              </h3>
              <ul>
                <li>Windows 10 or Windows 11 (64-bit)</li>
                <li>4 GB RAM (8 GB recommended)</li>
                <li>500 MB free disk space for installation</li>
                <li>1280 × 720 display or higher</li>
                <li>Stable network connection to MVMS API server</li>
              </ul>
            </div>
            <div className="lp-req-card">
              <h3>
                <Icon name="roles" size={20} />
                Installation notes
              </h3>
              <ul>
                <li>Run the NSIS installer wizard — do not distribute the unpacked folder alone</li>
                <li>IT may need to allow the installer through Windows SmartScreen (unsigned builds)</li>
                <li>Login binds to workstation MAC — use the registered reception PC</li>
                <li>Backend API URL is configured at build time for your environment</li>
                <li>Desktop shortcuts are created for quick launch from the taskbar or Start menu</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="download" className="lp-download-band">
        <div className="lp-container">
          <h2 className="lp-download-band__title">Get started at reception today</h2>
          <p className="lp-download-band__sub">
            Download the latest MVMS installer and set up your front desk in minutes.
          </p>
          <DownloadButton>Download MedPlus MVMS v{APP_VERSION}</DownloadButton>
          <p className="lp-download-band__note">
            {INSTALLER_FILENAME} · Free for authorised MedPlus workstations
          </p>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container">
          <p>© {new Date().getFullYear()} MedPlus Health Services · Visitor Management System (MVMS)</p>
        </div>
      </footer>
    </div>
  );
}
