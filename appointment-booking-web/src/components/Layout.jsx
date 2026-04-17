export default function Layout({ children }) {
  return (
    <div className="d-flex flex-column min-vh-100">

      {/* ── Navbar ── */}
      <nav className="navbar bg-white border-bottom shadow-sm">
        <div className="container">
          <span className="navbar-brand d-flex align-items-center gap-2 mb-0">
            <span className="d-flex align-items-center justify-content-center bg-primary rounded-3"
              style={{ width: '2.2rem', height: '2.2rem' }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <span>
              <span className="fw-bold text-dark">Medplus</span>
              <span className="text-muted small ms-2 d-none d-sm-inline">Appointment Booking</span>
            </span>
          </span>

          <a href="tel:+1800123456"
            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Need help?
          </a>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-grow-1 py-4 py-sm-5">
        <div className="container" style={{ maxWidth: '680px' }}>
          {children}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-top py-3 text-center">
        <p className="text-muted small mb-0">
          &copy; {new Date().getFullYear()} Medplus Health Services &nbsp;&middot;&nbsp; All rights reserved
        </p>
      </footer>
    </div>
  );
}
