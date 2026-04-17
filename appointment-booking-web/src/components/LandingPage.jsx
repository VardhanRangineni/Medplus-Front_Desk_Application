import { useBooking } from '../context/BookingContext';

const USER_TYPES = [
  {
    id: 'employee',
    title: 'Organization Employee',
    subtitle: "I work here",
    description: 'Book an internal appointment using your Employee ID.',
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    id: 'visitor',
    title: 'Visitor',
    subtitle: "I'm from outside",
    description: 'Book an appointment with a staff member using your mobile number.',
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];


export default function LandingPage() {
  const { selectUserType } = useBooking();

  return (
    <div>
      {/* ── Hero ── */}
      <div className="text-center mb-4">
        <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 mb-3 d-inline-flex align-items-center gap-2">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Online Appointment Booking
        </span>
        <h1 className="fw-bold display-6 mb-2">Book Your Appointment</h1>
        <p className="text-muted mx-auto" style={{ maxWidth: '400px' }}>
          Schedule a visit with our staff in just a few steps — quick, easy, and secure.
        </p>
      </div>

      {/* ── Selection cards ── */}
      <div className="row g-3 mb-4">
        {USER_TYPES.map((type) => (
          <div key={type.id} className="col-12 col-sm-6">
            <button
              onClick={() => selectUserType(type.id)}
              className="card selection-card w-100 h-100 p-4 rounded-3 shadow-sm border"
            >
              <div className="card-icon bg-primary bg-opacity-10 text-primary mb-3">
                {type.icon}
              </div>
              <p className="text-muted small fw-semibold text-uppercase mb-1" style={{ letterSpacing: '.06em' }}>
                {type.subtitle}
              </p>
              <h2 className="fw-bold fs-5 mb-1">{type.title}</h2>
              <p className="text-muted small mb-3">{type.description}</p>
              <div className="d-flex align-items-center gap-1 text-primary fw-semibold small mt-auto">
                Get started
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
