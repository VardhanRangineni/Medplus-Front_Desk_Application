import { useState, useRef, useEffect, useCallback } from 'react';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function SearchableDropdown({
  value, onChange, onSearch,
  placeholder = 'Type to search…',
  label, required = false, disabled = false, error,
}) {
  const [inputVal, setInputVal] = useState(value?.name ?? '');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const [focused,  setFocused]  = useState(false);
  const containerRef            = useRef(null);

  useEffect(() => {
    if (!focused) setInputVal(value?.name ?? '');
  }, [value, focused]);

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await onSearch(q);
      setResults(data ?? []); setOpen(true);
    } catch { setResults([]); }
    finally  { setLoading(false); }
  }, [onSearch]);

  const debouncedSearch = useDebounce(doSearch, 300);

  function handleInputChange(e) {
    const q = e.target.value;
    setInputVal(q);
    if (!q) { onChange(null); setResults([]); setOpen(false); return; }
    debouncedSearch(q);
  }

  function handleSelect(item) {
    onChange(item); setInputVal(item.name);
    setResults([]); setOpen(false); setFocused(false);
  }

  function handleClear() {
    onChange(null); setInputVal(''); setResults([]); setOpen(false);
  }

  useEffect(() => {
    function outside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setFocused(false);
        setInputVal(value?.name ?? '');
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [value]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label className="form-label fw-medium">
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </label>
      )}

      <div className="position-relative">
        <input
          type="text" value={inputVal}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox" aria-autocomplete="list" aria-expanded={open}
          className={`form-control pe-5 ${error ? 'is-invalid' : ''}`}
        />
        {/* Icon */}
        <span className="position-absolute top-50 end-0 translate-middle-y pe-3 text-muted"
          style={{ pointerEvents: value ? 'auto' : 'none' }}>
          {loading ? (
            <span className="spinner-border spinner-border-sm" />
          ) : value ? (
            <button type="button" onClick={handleClear}
              className="btn btn-sm p-0 text-muted" aria-label="Clear" style={{ pointerEvents: 'auto' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          )}
        </span>
      </div>

      {/* Dropdown list */}
      {open && results.length > 0 && (
        <ul role="listbox" className="search-dropdown-list list-unstyled mb-0">
          {results.map((item) => (
            <li key={item.id} role="option" aria-selected={value?.id === item.id}
              onClick={() => handleSelect(item)}
              className="search-dropdown-item">
              <div className="fw-medium small">{item.name}</div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                {item.department}{item.designation ? ` · ${item.designation}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && inputVal.trim().length >= 2 && (
        <div className="search-dropdown-list p-3 small text-muted">
          No results found for "{inputVal}"
        </div>
      )}

      {error && <div className="invalid-feedback d-block">{error}</div>}
    </div>
  );
}
