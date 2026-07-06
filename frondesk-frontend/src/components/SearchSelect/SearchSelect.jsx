import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import './SearchSelect.css';
import { IconChevronDown, IconMapPin, IconX } from '../Icons/Icons';

/**
 * Searchable dropdown select — menu portals to document.body for correct alignment
 * inside tables, modals, and scroll containers.
 *
 * @param {string|string[]} value — selected option value(s) ('' / [] = none)
 * @param {(value: string|string[]) => void} onChange
 * @param {{ value: string, label: string }[]} options
 * @param {string} [placeholder]
 * @param {boolean} [searchable]
 * @param {string} [searchPlaceholder]
 * @param {string} [emptyMessage]
 * @param {boolean} [compact] — table column filter sizing
 * @param {boolean} [searchInField] — type to filter in the trigger field (no search box in menu)
 * @param {boolean} [multiple] — multi-select with chips + type-to-search
 * @param {number} [maxVisibleChips] — chips shown before "+N more" (multiple only)
 * @param {string} [ariaLabel]
 * @param {number} [minMenuWidth]
 * @param {string} [clearValue] — option value treated as "clear / All" (default '')
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchable = false,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results found',
  compact = false,
  searchInField = false,
  multiple = false,
  maxVisibleChips = 2,
  ariaLabel,
  minMenuWidth = 220,
  clearValue = '',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const searchRef = useRef(null);

  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    }
    return value != null && value !== '' ? [String(value)] : [];
  }, [value, multiple]);

  const useInlineSearch = (searchable && searchInField) || multiple;

  const normalizedOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const opt of options) {
      const val = opt?.value ?? '';
      const label = String(opt?.label ?? val).trim();
      const dedupeKey = val === clearValue ? `__clear__:${label}` : val.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ value: val, label: label || (val === clearValue ? placeholder : val) });
    }
    return out;
  }, [options, clearValue, placeholder]);

  const selected = !multiple
    ? normalizedOptions.find((o) => o.value === value)
    : null;

  const selectedOptions = useMemo(() => {
    if (!multiple) return [];
    const byValue = new Map(normalizedOptions.map((o) => [o.value, o]));
    return selectedValues
      .map((v) => byValue.get(v) || { value: v, label: v })
      .filter(Boolean);
  }, [multiple, normalizedOptions, selectedValues]);

  const filteredOptions = useMemo(() => {
    const clearOpt = !multiple
      ? normalizedOptions.find((o) => o.value === clearValue)
      : null;
    const rest = normalizedOptions.filter((o) => o.value !== clearValue);
    const q = query.trim().toLowerCase();

    if (!searchable || !q) {
      return clearOpt ? [clearOpt, ...rest] : rest;
    }

    return rest.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [normalizedOptions, query, searchable, clearValue, multiple]);

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  const openMenu = () => {
    setOpen(true);
    if (useInlineSearch) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (searchable) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

  const toggleMultiValue = (optValue) => {
    const next = selectedValues.includes(optValue)
      ? selectedValues.filter((v) => v !== optValue)
      : [...selectedValues, optValue];
    onChange(next);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeMultiValue = (optValue) => {
    onChange(selectedValues.filter((v) => v !== optValue));
  };

  useEffect(() => {
    if (!open || useInlineSearch) return;
    setQuery('');
    if (searchable) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, searchable, useInlineSearch]);

  useLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }
    function updatePosition() {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuW = Math.max(rect.width, minMenuWidth);
      let left = rect.left;
      const margin = 12;
      if (left + menuW > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - menuW - margin);
      }
      setMenuStyle({
        top: rect.bottom + 4,
        left,
        width: menuW,
      });
      setReady(true);
    }
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, minMenuWidth, selectedValues.length, query]);

  useEffect(() => {
    if (!open) return undefined;
    function onMouseDown(e) {
      const inWrap = wrapRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inWrap && !inMenu) closeMenu();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const rootClass = [
    'search-select',
    compact ? 'search-select--compact' : '',
    useInlineSearch ? 'search-select--inline' : '',
    multiple ? 'search-select--multi' : '',
    disabled ? 'search-select--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  const inputDisplay = open || multiple
    ? query
    : (selected?.label ?? '');

  const handleOptionClick = (opt) => {
    if (multiple) {
      if (opt.value === clearValue) return;
      toggleMultiValue(opt.value);
      return;
    }
    onChange(opt.value);
    closeMenu();
  };

  const menuPortal = open && createPortal(
    <div
      ref={menuRef}
      className={`search-select__menu${ready ? '' : ' search-select__menu--measuring'}`}
      style={menuStyle}
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={multiple || undefined}
    >
      {!useInlineSearch && searchable && (
        <div className="search-select__search-wrap">
          <input
            ref={searchRef}
            className="search-select__search-input"
            type="text"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {query && (
            <button
              type="button"
              className="search-select__search-clear"
              onClick={() => setQuery('')}
              tabIndex={-1}
              aria-label="Clear search"
            >
              <IconX size={11} />
            </button>
          )}
        </div>
      )}
      <div className="search-select__list">
        {filteredOptions.length === 0 ? (
          <div className="search-select__empty">{emptyMessage}</div>
        ) : (
          filteredOptions.map((opt, index) => {
            const isActive = selectedValues.includes(opt.value);
            return (
              <button
                key={`${opt.value}::${opt.label}::${index}`}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`search-select__option${isActive ? ' search-select__option--active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleOptionClick(opt)}
              >
                {multiple && (
                  <span className={`search-select__check${isActive ? ' search-select__check--on' : ''}`} aria-hidden>
                    {isActive ? '✓' : ''}
                  </span>
                )}
                <span className="search-select__option-label">{opt.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );

  if (multiple) {
    const hasSelection = selectedOptions.length > 0;
    const visibleLimit = Math.max(1, maxVisibleChips);
    const visibleChips = selectedOptions.slice(0, visibleLimit);
    const hiddenCount = Math.max(0, selectedOptions.length - visibleLimit);

    return (
      <div className={rootClass} ref={wrapRef}>
        <div
          className={`search-select__field search-select__field--multi${open ? ' search-select__field--open' : ''}${!hasSelection && !query ? ' search-select__field--empty' : ''}`}
          onClick={() => { if (!disabled) openMenu(); }}
        >
          <div className="search-select__chips">
            {visibleChips.map((opt) => (
              <span key={opt.value} className="search-select__chip">
                <IconMapPin size={12} className="search-select__chip-pin" />
                <span className="search-select__chip-label" title={opt.label}>{opt.label}</span>
                <button
                  type="button"
                  className="search-select__chip-remove"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMultiValue(opt.value);
                  }}
                  tabIndex={-1}
                  aria-label={`Remove ${opt.label}`}
                >
                  <IconX size={11} />
                </button>
              </span>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                className="search-select__chip-more"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  openMenu();
                }}
                aria-label={`${hiddenCount} more selected`}
              >
                +{hiddenCount} more
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              className="search-select__field-input search-select__field-input--multi"
              placeholder={hasSelection ? searchPlaceholder : placeholder}
              value={query}
              onChange={(e) => {
                if (disabled) return;
                setQuery(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => { if (!disabled) openMenu(); }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !query && selectedValues.length > 0) {
                  removeMultiValue(selectedValues[selectedValues.length - 1]);
                } else if (e.key === 'Escape') {
                  closeMenu();
                }
              }}
              aria-label={ariaLabel}
              aria-expanded={open}
              aria-haspopup="listbox"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            className="search-select__field-chev-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (open) closeMenu();
              else openMenu();
            }}
            aria-label={open ? 'Close list' : 'Open list'}
            tabIndex={-1}
          >
            <IconChevronDown size={compact ? 12 : 14} className={`search-select__chev${open ? ' search-select__chev--up' : ''}`} />
          </button>
        </div>
        {menuPortal}
      </div>
    );
  }

  if (useInlineSearch) {
    return (
      <div className={rootClass} ref={wrapRef}>
        <div
          className={`search-select__field${open ? ' search-select__field--open' : ''}${!value ? ' search-select__field--empty' : ''}`}
        >
          <input
            ref={inputRef}
            type="text"
            className="search-select__field-input"
            placeholder={open ? searchPlaceholder : placeholder}
            value={inputDisplay}
            onChange={(e) => {
              if (disabled) return;
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => { if (!disabled) openMenu(); }}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="listbox"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
          />
          {value && !open && (
            <button
              type="button"
              className="search-select__field-clear"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(clearValue);
              }}
              tabIndex={-1}
              aria-label="Clear selection"
            >
              <IconX size={11} />
            </button>
          )}
          <button
            type="button"
            className="search-select__field-chev-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (open ? closeMenu() : openMenu())}
            aria-label={open ? 'Close list' : 'Open list'}
            tabIndex={-1}
          >
            <IconChevronDown size={compact ? 12 : 14} className={`search-select__chev${open ? ' search-select__chev--up' : ''}`} />
          </button>
        </div>
        {menuPortal}
      </div>
    );
  }

  return (
    <div className={rootClass} ref={wrapRef}>
      <button
        type="button"
        className={`search-select__trigger${open ? ' search-select__trigger--open' : ''}${!value ? ' search-select__trigger--empty' : ''}`}
        onClick={() => { if (!disabled) (open ? closeMenu() : openMenu()); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="search-select__label">{selected?.label ?? placeholder}</span>
        <IconChevronDown size={compact ? 12 : 14} className={`search-select__chev${open ? ' search-select__chev--up' : ''}`} />
      </button>
      {menuPortal}
    </div>
  );
}
