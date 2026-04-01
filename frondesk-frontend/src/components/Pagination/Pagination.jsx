import './Pagination.css';

/**
 * Generic pagination bar.
 * Props:
 *   currentPage  – 1-based current page number
 *   totalPages   – total number of pages
 *   onPageChange – (page: number) => void
 */
export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  /**
   * Build the list of page tokens to render.
   * Always shows: first page, last page, current page ±1
   * Inserts '…' where there are gaps.
   */
  const buildPages = () => {
    const visible = new Set([1, totalPages]);
    for (let d = -1; d <= 1; d++) {
      const p = currentPage + d;
      if (p >= 1 && p <= totalPages) visible.add(p);
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

  return (
    <nav className="pgn" aria-label="Pagination">
      {/* Previous */}
      <button
        className="pgn__btn pgn__btn--arrow"
        onClick={() => onPageChange(currentPage - 1)}
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
            onClick={() => !isActive && onPageChange(token)}
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
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
