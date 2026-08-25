/**
 * icons.tsx — Marketing icon set
 *
 * Local rather than imported from packages/ui, because the marketing system
 * shares no components with the app. They're also drawn to a different brief:
 * 1.5px strokes and round caps, which sit better beside Tanker at display
 * sizes than the app's tighter icons do.
 *
 * Every icon is currentColor and 24x24, so colour comes from the parent.
 */

import React from 'react';

type IconProps = { className?: string };

function Icon({ className = 'w-6 h-6', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
);

export const Calendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const Dice = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);

export const Chart = (p: IconProps) => (
  <Icon {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>
);

export const Users = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.4A6.5 6.5 0 0 1 21.5 20" />
  </Icon>
);

export const Store = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9.5 4.6 4h14.8L21 9.5M3 9.5h18M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8" />
  </Icon>
);

export const Clock = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Icon>
);

export const Megaphone = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11v2a2 2 0 0 0 2 2h2l8 4.5V5.5L7 10H5a2 2 0 0 0-2 1ZM19 9.5a3.5 3.5 0 0 1 0 5M7 15v4" />
  </Icon>
);

export const Sliders = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
    <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="16" cy="18" r="2" />
  </Icon>
);

export const Plus = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);

export const Quote = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6.5C6.2 7.6 4.5 10 4.5 13v4.5h6V11H7.8c.2-1.4 1-2.4 2.4-3ZM19.5 6.5c-2.8 1.1-4.5 3.5-4.5 6.5v4.5h6V11h-2.7c.2-1.4 1-2.4 2.4-3Z" />
  </Icon>
);

/* ── Tiles ─────────────────────────────────────────────────────────────── */

export const Bell = (p: IconProps) => (
  <Icon {...p}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9ZM10 18.5a2 2 0 0 0 4 0" /></Icon>
);

export const User = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></Icon>
);

export const Phone = (p: IconProps) => (
  <Icon {...p}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18.5h3" /></Icon>
);

export const Tag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12.5V4.5a1.5 1.5 0 0 1 1.5-1.5h8l8.5 8.5a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0Z" />
    <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);

export const Pin = (p: IconProps) => (
  <Icon {...p}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Icon>
);

export const Moon = (p: IconProps) => (
  <Icon {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></Icon>
);

export const Grid = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </Icon>
);

export const Layers = (p: IconProps) => (
  <Icon {...p}><path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5" /></Icon>
);

export const Server = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </Icon>
);

export const Plug = (p: IconProps) => (
  <Icon {...p}><path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0ZM12 18v3" /></Icon>
);

export const Wallet = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18" />
    <circle cx="17" cy="15" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const Mail = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></Icon>
);

export const Buildings = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 21V8l6-3v16M9 21h12V11l-6-3M13 12h.01M17 12h.01M13 16h.01M17 16h.01M5.5 12h.01M5.5 16h.01" />
  </Icon>
);

export const Shield = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l7.5 3v6c0 4.5-3 7.8-7.5 9.5C7.5 19.8 4.5 16.5 4.5 12V6Z" /></Icon>
);

export const Bolt = (p: IconProps) => (
  <Icon {...p}><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12Z" /></Icon>
);

/* ── Documents and links ───────────────────────────────────────────────── */

export const Document = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h7l5 5v13H6ZM13 3v5h5" />
    <path d="M9 13h6M9 16.5h4" />
  </Icon>
);

export const Link = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" />
    <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" />
  </Icon>
);

export const Repeat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9a4 4 0 0 1 4-4h9M17 5l-2.5-2.5M17 5l-2.5 2.5" />
    <path d="M20 15a4 4 0 0 1-4 4H7M7 19l2.5 2.5M7 19l2.5-2.5" />
  </Icon>
);

export const Trophy = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 3h9v5a4.5 4.5 0 0 1-9 0Z" />
    <path d="M7.5 4.5H5a2.5 2.5 0 0 0 2.5 5M16.5 4.5H19a2.5 2.5 0 0 1-2.5 5" />
    <path d="M12 12.5V16M8.5 21h7l-.7-2.5h-5.6Z" />
  </Icon>
);
