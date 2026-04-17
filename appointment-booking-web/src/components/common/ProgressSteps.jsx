export default function ProgressSteps({ steps, current }) {
  return (
    <div className="d-flex align-items-start justify-content-center mb-4 select-none">
      {steps.map((label, idx) => {
        const stepNum  = idx + 1;
        const isDone   = stepNum < current;
        const isActive = stepNum === current;

        return (
          <div key={label} className="d-flex align-items-start">
            {/* Circle + label */}
            <div className="d-flex flex-column align-items-center gap-1">
              <div className={`step-circle ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                {isDone ? (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </div>
              <span className={`d-none d-sm-block small fw-medium ${isActive ? 'text-primary' : isDone ? 'text-primary' : 'text-muted'}`}
                style={{ fontSize: '0.7rem' }}>
                {label}
              </span>
            </div>

            {/* Connector */}
            {idx < steps.length - 1 && (
              <div className={`step-connector ${isDone ? 'bg-primary' : 'bg-light border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
