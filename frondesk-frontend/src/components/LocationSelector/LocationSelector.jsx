import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './LocationSelector.css';
import LottieLoader from '../LottieLoader/LottieLoader';
import { IconMapPin, IconChevronDown, IconSearch, IconX } from '../Icons/Icons';
import { getActiveLocations } from '../../services/locationService';
import { resolveLocationId } from '../../services/locationScope';

/**
 * LocationSelector — searchable location filter dropdown (primary admin only).
 *
 * Behaviour:
 *  - Non-primary-admin → read-only badge showing the user's own location.
 *  - Primary admin     → interactive dropdown; fetches all active locations once
 *                        on first open, then filters client-side as the user types.
 *
 * Props:
 *   session   – { role, roles, locationId, locationName }
 *   value     – currently selected locationId  (null = "All Locations")
 *   onChange  – (locationId: string | null) => void
 */
export default function LocationSelector({
  session,
  value,
  onChange,
  menuAlign = 'right',
  compact = false,
  /** When set, only these location codes appear (supervisor multi-site). */
  allowedLocationIds = null,
  /** Show "All Locations" option (primary admin only). */
  allowAll = true,
}) {
  const [open,      setOpen]      = useState(false);
  const [locations, setLocations] = useState([]);
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [fetched,   setFetched]   = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });
  const [ready,     setReady]     = useState(false);

  const wrapRef   = useRef(null);
  const menuRef   = useRef(null);
  const searchRef = useRef(null);

  const roles = Array.isArray(session?.roles) && session.roles.length > 0
    ? session.roles
    : (session?.role ? [session.role] : []);
  const isPrimaryAdmin = roles.includes('PRIMARY_ADMIN');
  const restrictedKey = Array.isArray(allowedLocationIds)
    ? allowedLocationIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean).sort().join('|')
    : '';
  const restrictedIds = restrictedKey ? restrictedKey.split('|') : null;
  const canPick = isPrimaryAdmin || allowAll || (restrictedIds && restrictedIds.length > 0);
  const showAllOption = allowAll && !restrictedIds;

  // Fetch locations when dropdown opens
  useEffect(() => {
    if (!open || !canPick || fetched) return;
    setLoading(true);
    getActiveLocations()
      .then((list) => {
        const all = Array.isArray(list) ? list : [];
        if (restrictedIds) {
          setLocations(all.filter((l) => restrictedIds.includes(String(l.code || '').toLowerCase())));
        } else {
          setLocations(all);
        }
        setFetched(true);
      })
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, [open, canPick, fetched, restrictedKey]);

  // Auto-focus the search input when dropdown opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }
    function updatePosition() {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuW = Math.max(rect.width, 240);
      const margin = 12;
      let left;
      if (menuAlign === 'left') {
        left = rect.left;
      } else {
        left = rect.right - menuW;
      }
      if (left < margin) left = margin;
      if (left + menuW > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - menuW - margin);
      }
      setMenuStyle({
        top: rect.bottom + 6,
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
  }, [open, menuAlign]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      const inWrap = wrapRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inWrap && !inMenu) setOpen(false);
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

  // ── No picker: read-only badge ────────────────────────────────────────────
  if (!canPick) {
    return (
      <div className="loc-badge">
        <IconMapPin size={12} />
        <span>{session?.locationName ?? 'My Location'}</span>
      </div>
    );
  }

  const resolvedValue = value ? resolveLocationId(value) : value;

  // ── Derive trigger label ──────────────────────────────────────────────────
  const selectedName = resolvedValue
    ? (locations.find((l) => l.code === resolvedValue)?.name ?? session?.locationName ?? resolvedValue)
    : (showAllOption ? 'All Locations' : (session?.locationName ?? 'Select location'));

  function select(id) {
    onChange?.(id);
    setOpen(false);
  }

  function clearSelection(e) {
    e.stopPropagation();
    if (!showAllOption) return;
    onChange?.(null);
  }

  const menuPortal = open && createPortal(
    <div
      ref={menuRef}
      className={`loc-popup${ready ? '' : ' loc-popup--measuring'}`}
      style={menuStyle}
      role="listbox"
    >
      <div className="loc-search-wrap">
        <IconSearch size={13} className="loc-search-icon" />
        <input
          ref={searchRef}
          className="loc-search-input"
          type="text"
          placeholder="Search location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        {query && (
          <button type="button" className="loc-search-clear" onClick={() => setQuery('')} tabIndex={-1}>
            <IconX size={11} />
          </button>
        )}
      </div>

      {!query && showAllOption && (
        <button
          type="button"
          className={`loc-opt${!value ? ' loc-opt--active' : ''}`}
          role="option"
          aria-selected={!value}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => select(null)}
        >
          <span className="loc-opt__name">All Locations</span>
        </button>
      )}

      {loading && (
        <div className="loc-empty loc-empty--loading">
          <LottieLoader size="sm" ariaLabel="Loading locations" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="loc-empty">No locations found</div>
      )}

      {!loading &&
        filtered.map((loc) => (
          <button
            key={loc.code}
            type="button"
            className={`loc-opt${resolvedValue === loc.code ? ' loc-opt--active' : ''}`}
            role="option"
            aria-selected={resolvedValue === loc.code}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(loc.code)}
          >
            <span className="loc-opt__name">{loc.name}</span>
            {loc.city && <span className="loc-opt__city">{loc.city}</span>}
          </button>
        ))}
    </div>,
    document.body,
  );

  return (
    <div className={`loc-wrap${compact ? ' loc-wrap--header' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`loc-trigger${open ? ' loc-trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <IconMapPin size={13} />
        <span className="loc-label">{selectedName}</span>
        {value && showAllOption ? (
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
      {menuPortal}
    </div>
  );
}
