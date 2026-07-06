import './LottieLoader.css';

const SIZES = { sm: 20, md: 32, lg: 44, xl: 56 };

/**
 * Standard loading spinner for tables, modals, and buttons.
 * @param {'sm'|'md'|'lg'|'xl'|number} [size='md']
 * @param {'brand'|'muted'|'light'} [tone='brand'] — light = white ring (e.g. primary buttons)
 */
export default function LottieLoader({
  size = 'md',
  className = '',
  ariaLabel,
  tone = 'brand',
}) {
  const px = typeof size === 'number' ? size : (SIZES[size] ?? SIZES.md);
  const sizeClass = typeof size === 'string' && SIZES[size] ? ` app-spinner--${size}` : '';

  return (
    <div
      className={`app-spinner${sizeClass} app-spinner--${tone}${className ? ` ${className}` : ''}`}
      style={typeof size === 'number' ? { width: px, height: px } : undefined}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    >
      <span className="app-spinner__ring" />
    </div>
  );
}
