/**
 * Shared icon components (inline SVG, zero external dependencies).
 *
 * All icons accept an optional `className` and `size` prop (defaults to 16).
 * They inherit `color` via `stroke="currentColor"` so they respond to CSS color.
 *
 * Usage:
 *   import { IconUser, IconLock } from '../../components/Icons';
 */

const iconProps = (size) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.8',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: size,
  height: size,
  'aria-hidden': true,
});

export const IconUser = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const IconLock = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const IconEye = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconEyeOff = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const IconAlertCircle = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export const IconShield = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconInfo = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="8.01" strokeWidth="2.5" />
    <line x1="12" y1="12" x2="12" y2="16" />
  </svg>
);

export const IconMonitor = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export const IconChevronRight = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const IconCheck = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const IconX = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconSearch = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const IconCalendar = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const IconLogOut = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
