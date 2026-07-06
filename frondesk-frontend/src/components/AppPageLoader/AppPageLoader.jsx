import LottieLoader from '../LottieLoader/LottieLoader';
import './AppPageLoader.css';

export default function AppPageLoader({ label = 'Loading…', fullScreen = false, size = 'lg' }) {
  return (
    <div
      className={`app-page-loader${fullScreen ? ' app-page-loader--fullscreen' : ''}`}
      role="status"
      aria-live="polite"
    >
      <LottieLoader size={size} ariaLabel={label} />
      {label ? <span className="app-page-loader__label">{label}</span> : null}
    </div>
  );
}
