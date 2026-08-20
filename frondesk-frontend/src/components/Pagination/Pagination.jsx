import './Pagination.css';

/**
 * Find nearest scrollable ancestor (table wrap / page content).
 * Fall back to window if none found.
 */
function findScrollParent(el) {
  let node = el?.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
      && node.scrollHeight > node.clientHeight + 1;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function scrollListToTop(fromEl) {
  const target = findScrollParent(fromEl);
  if (!target) return;
  if (typeof target.scrollTo === 'function') {
    target.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    target.scrollTop = 0;
  }
  // Sticky headers / nested scroll: also nudge page shell if present
  const pageShell = fromEl?.closest?.('.ci-page, .db-content, .app-page-shell');
  if (pageShell && pageShell !== target && pageShell.scrollHeight > pageShell.clientHeight) {
    if (typeof pageShell.scrollTo === 'function') {
      pageShell.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      pageShell.scrollTop = 0;
    }
  }
}

/**
 * Generic pagination bar.
 * Props:
 *   currentPage  – 1-based current page number
 *   totalPages   – total number of pages
 *   onPageChange – (page: number) => void
 */
export default function Pagination({ currentPage, totalPages, onPageChange, alwaysShow = false }) {
  const safeTotal = Math.max(1, totalPages);
  if (!alwaysShow && totalPages <= 1) return null;

  /**
   * Build the list of page tokens to render.
   * Always shows: first page, last page, current page ±1
   * Inserts '…' where there are gaps.
   */
  const buildPages = () => {
    const visible = new Set([1, safeTotal]);
    for (let d = -1; d <= 1; d++) {
      const p = currentPage + d;
      if (p >= 1 && p <= safeTotal) visible.add(p);
    }

    const sorted = [...visible].sort((a, b) => a - b);
    const tokens = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        tokens.push('ellipsis-' + sorted[i]);
      }
      tokens.push(sorted[i]);
    }
    return tokens;
  };

  function goTo(page, event) {
    if (page === currentPage) return;
    onPageChange(page);
    scrollListToTop(event?.currentTarget);
  }

  return (
    <nav className="pgn" aria-label="Pagination">
      {/* Previous */}
      <button
        className="pgn__btn pgn__btn--arrow"
        onClick={(e) => goTo(currentPage - 1, e)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        ‹
      </button>

      {buildPages().map((token) => {
        if (typeof token === 'string') {
          return (
            <span key={token} className="pgn__ellipsis" aria-hidden="true">
              …
            </span>
          );
        }
        const isActive = token === currentPage;
        return (
          <button
            key={token}
            className={`pgn__btn${isActive ? ' pgn__btn--active' : ''}`}
            onClick={(e) => !isActive && goTo(token, e)}
            aria-label={`Page ${token}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {token}
          </button>
        );
      })}

      {/* Next */}
      <button
        className="pgn__btn pgn__btn--arrow"
        onClick={(e) => goTo(currentPage + 1, e)}
        disabled={currentPage >= safeTotal}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
