import { useState, useEffect, useRef, useMemo } from 'react';
import './LocationSelector.css';
import { IconMapPin, IconChevronDown, IconSearch, IconX } from '../Icons/Icons';
import { getActiveLocations } from '../../pages/LocationMaster/locationService';

/**
 * LocationSelector — searchable location filter dropdown.
 *
 * Behaviour:
 *  - Non-admin   → read-only badge showing the user's own location.
 *  - Admin       → interactive dropdown; fetches all active locations once
 *                  on first open, then filters client-side as the user types.
 *
 * Props:
 *   session   – { role, locationId, locationName }
 *   value     – currently selected locationId  (null = "All Locations")
 *   onChange  – (locationId: string | null) => void
 */
export default function LocationSelector({ session, value, onChange }) {
  const [open,      setOpen]      = useState(false);
  const [locations, setLocations] = useState([]);
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [fetched,   setFetched]   = useState(false);

  const wrapRef   = useRef(null);
  const searchRef = useRef(null);

  const isAdmin = session?.role === 'PRIMARY_ADMIN' || session?.role === 'REGIONAL_ADMIN';

  // Fetch all active locations once when admin first opens the dropdown
  useEffect(() => {
    if (!open || !isAdmin || fetched) return;
    setLoading(true);
    getActiveLocations()
      .then((list) => {
        setLocations(Array.isArray(list) ? list : []);
        setFetched(true);
      })
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, [open, isAdmin, fetched]);

  // Auto-focus the search input when dropdown opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Client-side filtering based on the search query
  const filtered = useMemo(() => {
    if (!query.trim()) return locations;
    const q = query.trim().toLowerCase();
    return locations.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.code?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q),
    );
  }, [locations, query]);

  // ── Non-admin: read-only badge ────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="loc-badge">
        <IconMapPin size={12} />
        <span>{session?.locationName ?? 'My Location'}</span>
      </div>
    );
  }

  // ── Derive trigger label ──────────────────────────────────────────────────
  const selectedName = value
    ? (locations.find((l) => l.code === value)?.name ?? value)
    : 'All Locations';

  function select(id) {
    onChange?.(id);
    setOpen(false);
  }

  function clearSelection(e) {
    e.stopPropagation();
    onChange?.(null);
  }

  return (
    <div className="loc-wrap" ref={wrapRef}>
      {/* Trigger button */}
      <button
        className={`loc-trigger${open ? ' loc-trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <IconMapPin size={13} />
        <span className="loc-label">{selectedName}</span>
        {value ? (
          <span
            className="loc-clear"
            role="button"
            tabIndex={0}
            onClick={clearSelection}
            onKeyDown={(e) => e.key === 'Enter' && clearSelection(e)}
            title="Clear filter"
          >
            <IconX size={11} />
          </span>
        ) : (
          <IconChevronDown
            size={12}
            className={`loc-chevron${open ? ' loc-chevron--up' : ''}`}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="loc-popup" role="listbox">
          {/* Search input */}
          <div className="loc-search-wrap">
            <IconSearch size={13} className="loc-search-icon" />
            <input
              ref={searchRef}
              className="loc-search-input"
              type="text"
              placeholder="Search location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="loc-search-clear" onClick={() => setQuery('')} tabIndex={-1}>
                <IconX size={11} />
              </button>
            )}
          </div>

          {/* "All Locations" option */}
          {!query && (
            <button
              className={`loc-opt${!value ? ' loc-opt--active' : ''}`}
              role="option"
              aria-selected={!value}
              onClick={() => select(null)}
            >
              <span className="loc-opt__name">All Locations</span>
            </button>
          )}

          {/* Loading state */}
          {loading && (
            <div className="loc-empty">Loading locations…</div>
          )}

          {/* No results */}
          {!loading && filtered.length === 0 && (
            <div className="loc-empty">No locations found</div>
          )}

          {/* Location options */}
          {!loading &&
            filtered.map((loc) => (
              <button
                key={loc.code}
                className={`loc-opt${value === loc.code ? ' loc-opt--active' : ''}`}
                role="option"
                aria-selected={value === loc.code}
                onClick={() => select(loc.code)}
              >
                <span className="loc-opt__name">{loc.name}</span>
                {loc.city && <span className="loc-opt__city">{loc.city}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
