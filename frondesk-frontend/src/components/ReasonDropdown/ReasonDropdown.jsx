import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ReasonDropdown.css';
import { getActiveVisitReasons, ApiError } from '../../pages/VisitReasons/visitReasonsService';
import { PRESET_REASONS } from '../../constants/visitReasons';
import { IconChevronDown, IconX } from '../Icons/Icons';

/**
 * Custom styled dropdown for "Reason for Visit".
 * Replaces the native <select> so styling is fully controllable.
 * Uses React Portal so the dropdown panel renders above modals.
 *
 * Props:
 *   type      - 'VISITOR' | 'EMPLOYEE'
 *   value     - current reason string
 *   onChange  - (stringValue) => void
 *   disabled  - optional boolean
 *   className - optional extra class on the root div
 */

// Module-level cache so repeated mounts don't refetch
let reasonCache = { VISITOR: null, EMPLOYEE: null };

export function clearCache(type) {
  if (type === 'VISITOR' || type === 'EMPLOYEE') {
    reasonCache[type] = null;
  }
}

const OTHER_KEY = '__other__';
const OTHER_LABEL = 'Other';

export default function ReasonDropdown({ type = 'VISITOR', value = '', onChange, disabled, className }) {
  const [options, setOptions] = useState(PRESET_REASONS.map((r) => ({ key: r.label, label: r.label, text: r.text })));
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedText, setSelectedText] = useState(value || '');
  const [otherText, setOtherText] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const containerRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const debounceRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Panel position state for portal rendering
  const [panelRect, setPanelRect] = useState(null);
  const [flipUp, setFlipUp] = useState(false);

  const isShowingOther = options.find((o) => o.key === OTHER_KEY);

  // Fetch reasons from API on mount
  useEffect(() => {
    if (reasonCache[type]) {
      setOptions(reasonCache[type]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getActiveVisitReasons(type)
      .then((data) => {
        if (cancelled) return;
        const formatted = (Array.isArray(data) ? data : []).map((r) => ({
          key: String(r.id ?? r.reasonName),
          label: r.reasonName,
          text: r.reasonName,
        }));
        if (formatted.length > 0) {
          reasonCache[type] = formatted;
          setOptions(formatted);
        }
      })
      .catch(() => {
        if (cancelled) return;
        const formatted = PRESET_REASONS.map((r) => ({
          key: r.label,
          label: r.label,
          text: r.text,
        }));
        reasonCache[type] = formatted;
        setOptions(formatted);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [type]);

  // Sync external value changes
  useEffect(() => {
    const current = valueRef.current;
    if (!current) {
      setSelectedText('');
      setOtherText('');
      return;
    }
    const match = options.find((o) => o.text === current);
    if (match) {
      setSelectedText(current);
      setOtherText('');
    } else {
      // Custom / "Other" value
      setSelectedText(current);
      setOtherText(current);
    }
  }, [value, options]);

  // Compute panel position when dropdown opens / closes
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const panelMaxHeight = 220; // max-height of the list + padding
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < panelMaxHeight && (rect.top - panelMaxHeight) > 0) {
        // Not enough space below, flip upward
        setFlipUp(true);
        setPanelRect({
          top: rect.top - panelMaxHeight - 4,
          left: rect.left,
          width: rect.width,
        });
      } else {
        setFlipUp(false);
        setPanelRect({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    } else {
      setPanelRect(null);
      setFlipUp(false);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inContainer = containerRef.current && containerRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inContainer && !inPanel) {
        setOpen(false);
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggleOpen() {
    if (disabled || loading) return;
    setOpen((prev) => {
      if (!prev) setHighlightIdx(-1);
      return !prev;
    });
  }

  function close() {
    setOpen(false);
    setHighlightIdx(-1);
  }

  function selectOption(opt) {
    if (opt.key === OTHER_KEY) {
      setSelectedText('');
      setOtherText('');
      onChange?.('');
      close();
      setTimeout(() => {
        const el = containerRef.current?.querySelector('.reason-dropdown__other');
        el?.focus();
      }, 50);
      return;
    }
    setSelectedText(opt.text);
    setOtherText('');
    onChange?.(opt.text);
    close();
  }

  function handleOtherChange(e) {
    const text = e.target.value;
    setOtherText(text);
    setSelectedText(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange?.(text);
    }, 200);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        toggleOpen();
      }
      return;
    }
    const allOpts = [...options, { key: OTHER_KEY, label: OTHER_LABEL, text: OTHER_LABEL }];
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, allOpts.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < allOpts.length) {
          selectOption(allOpts[highlightIdx]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  }

  // Sync highlight scroll
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const allOpts = [...options, { key: OTHER_KEY, label: OTHER_LABEL, text: OTHER_LABEL }];
  const currentOther = !options.some((o) => o.text === selectedText) && selectedText;
  const hasValue = !!selectedText;

  // Dropdown panel rendered via portal so it sits above modals
  const panelContent = open && panelRect ? (
    createPortal(
      <div
        ref={panelRef}
        className="reason-dropdown__panel"
        role="listbox"
        style={{
          top: panelRect.top,
          left: panelRect.left,
          width: panelRect.width,
        }}
      >
        <div ref={listRef} className="reason-dropdown__list">
          {allOpts.map((opt, idx) => {
            const isSelected = opt.key === OTHER_KEY
              ? currentOther
              : opt.text === selectedText;
            return (
              <div
                key={opt.key}
                role="option"
                aria-selected={isSelected}
                className={`reason-dropdown__item${idx === highlightIdx ? ' reason-dropdown__item--highlighted' : ''}${isSelected ? ' reason-dropdown__item--selected' : ''}`}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlightIdx(idx)}
              >
                <span className="reason-dropdown__item-label">{opt.label}</span>
                {isSelected && (
                  <span className="reason-dropdown__item-check">✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div
      ref={containerRef}
      className={`reason-dropdown${className ? ' ' + className : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        className={`reason-dropdown__trigger${open ? ' reason-dropdown__trigger--open' : ''}`}
        onClick={toggleOpen}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Reason for visit"
      >
        <span className={`reason-dropdown__value${!hasValue ? ' reason-dropdown__value--placeholder' : ''}`}>
          {loading ? 'Loading...' : (selectedText || 'Select a reason...')}
        </span>
        <IconChevronDown size={14} className="reason-dropdown__chevron" />
      </button>

      {/* Dropdown panel (rendered via portal above) */}
      {panelContent}

      {/* "Other" free-text area */}
      {currentOther && (
        <textarea
          className="reason-dropdown__other"
          placeholder="Type your reason..."
          rows={3}
          value={otherText}
          onChange={handleOtherChange}
          disabled={disabled}
          aria-label="Custom reason"
        />
      )}
    </div>
  );
}
