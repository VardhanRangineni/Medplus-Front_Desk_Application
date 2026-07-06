import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Pagination.css';
import { IconChevronDown } from '../Icons/Icons';

/**
 * Rows-per-page picker styled to match the pagination bar.
 * Menu portals to document.body so it is not clipped by table card overflow.
 */
export default function PageSizeSelect({ value, options, onChange, ariaLabel = 'Rows per page' }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const close = () => setOpen(false);

  const pick = (size) => {
    close();
    if (size !== value) onChange(size);
  };

  useLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }

    function updatePosition() {
      const rect = rootRef.current?.getBoundingClientRect();
      const menuEl = menuRef.current;
      if (!rect) return;

      const menuW = Math.max(rect.width, 96);
      const menuH = menuEl?.offsetHeight || options.length * 34 + 8;
      const margin = 8;
      let left = rect.right - menuW;
      left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));
      let top = rect.top - menuH - 4;
      if (top < margin) top = rect.bottom + 4;

      setMenuStyle({ top, left, width: menuW });
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
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const inRoot = rootRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inRoot && !inMenu) close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menuPortal = open && createPortal(
    <ul
      ref={menuRef}
      className={`pgn-size__menu${ready ? '' : ' pgn-size__menu--measuring'}`}
      style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
      role="listbox"
      aria-label={ariaLabel}
    >
      {options.map((n) => {
        const active = n === value;
        return (
          <li key={n} role="none">
            <button
              type="button"
              role="option"
              aria-selected={active}
              className={`pgn-size__option${active ? ' pgn-size__option--active' : ''}`}
              onClick={() => pick(n)}
            >
              {n} / page
            </button>
          </li>
        );
      })}
    </ul>,
    document.body,
  );

  return (
    <>
      <div className="pgn-size" ref={rootRef}>
        <button
          type="button"
          className={`pgn-size__trigger${open ? ' pgn-size__trigger--open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="pgn-size__label">{value} / page</span>
          <IconChevronDown size={14} className="pgn-size__chev" aria-hidden />
        </button>
      </div>
      {menuPortal}
    </>
  );
}
