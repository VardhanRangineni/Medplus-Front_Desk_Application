import { IconX } from '../../components/Icons/Icons';

export default function CardReturnModal({ entry, onAnswer, onCancel }) {
  if (!entry) return null;

  const cardLabel = entry.card != null && entry.card !== '' ? String(entry.card) : '—';

  return (
    <div className="crm-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="crm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="crm-header">
          <div>
            <h3 className="crm-title">Return visitor card?</h3>
            <p className="crm-sub">{entry.name}</p>
          </div>
          <button type="button" className="crm-close" onClick={onCancel} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>
        <div className="crm-body">
          <p className="crm-question">Has the visitor returned this card?</p>
          <div className="crm-card-number" aria-label={`Card number ${cardLabel}`}>
            {cardLabel}
          </div>
          <div className="crm-actions">
            <button type="button" className="crm-btn crm-btn--yes" onClick={() => onAnswer(true)}>
              Yes, returned
            </button>
            <button type="button" className="crm-btn crm-btn--no" onClick={() => onAnswer(false)}>
              Not yet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
