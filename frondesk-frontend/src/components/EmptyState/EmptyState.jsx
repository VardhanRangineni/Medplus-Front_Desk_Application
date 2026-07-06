import './EmptyState.css';

/**
 * Reusable empty / zero-data state.
 * @param {React.ReactNode} [icon]
 * @param {React.ReactNode} [illustration] — replaces icon when set (e.g. custom art)
 * @param {string} title
 * @param {string} [description]
 * @param {{ label: string, onClick: () => void, variant?: 'primary'|'scan' }} [action]
 * @param {Array<{ label: string, onClick: () => void, variant?: 'primary'|'scan', icon?: React.ReactNode }>} [actions]
 * @param {boolean} [compact] — tighter layout for table cells
 */
export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  actions,
  compact = false,
}) {
  const actionList = actions ?? (action ? [action] : []);

  return (
    <div className={`fd-empty${compact ? ' fd-empty--compact' : ''}`} role="status">
      {illustration && (
        <div className="fd-empty__illustration" aria-hidden="true">{illustration}</div>
      )}
      {!illustration && icon && (
        <div className="fd-empty__icon" aria-hidden="true">{icon}</div>
      )}
      {title && <p className="fd-empty__title">{title}</p>}
      {description && <p className="fd-empty__desc">{description}</p>}
      {actionList.length > 0 && (
        <div className="fd-empty__actions">
          {actionList.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`fd-empty__btn${item.variant === 'scan' ? ' fd-empty__btn--scan' : ''}`}
              onClick={item.onClick}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
