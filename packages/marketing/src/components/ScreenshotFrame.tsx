/**
 * ScreenshotFrame.tsx — The well a product shot sits in
 *
 * Screenshots carry every section on this page, so the frame is doing real
 * design work rather than decoration. Three layers (see .mk-frame):
 * an inset rim light to separate it from the page, a wide accent glow beneath
 * so the dark image doesn't read as a hole, and a contact shadow to ground it.
 *
 * Until real captures exist, `<AppMock>` stands in — and it deliberately paints
 * itself #030712, the app's actual background. That means the placeholder tests
 * the exact thing the design depends on: whether a near-black app screenshot
 * separates from a lifted near-black page. Swap in `src` when the real shots
 * are ready and the surrounding design needs no changes.
 */

import React from 'react';

interface FrameProps {
  /** Real screenshot. Falls back to the mock when absent. */
  src?: string;
  /** Phone-width capture, used below md. */
  srcMobile?: string;
  alt?: string;
  /** Hero frames get a wider, stronger underglow. */
  hero?: boolean;
  /** Tailwind aspect ratio class, e.g. "aspect-[16/10]". */
  aspect?: string;
  /** What the finished shot should show — also the mock's layout hint. */
  mock?: MockVariant;
  className?: string;
}

export function ScreenshotFrame({
  src,
  srcMobile,
  alt = '',
  hero = false,
  aspect = 'aspect-[16/10]',
  mock = 'columns',
  className = '',
}: FrameProps) {
  return (
    <div className={`mk-frame ${hero ? 'mk-frame-hero' : ''} ${className}`}>
      <div className={`mk-frame-inner ${aspect}`}>
        {src
          ? (
            /*
             * <picture> rather than one <img>, so a phone gets a capture taken
             * at phone width. The desktop hero is a four-column screen; at
             * 324px across it reads as grey mush and communicates nothing.
             * The breakpoint matches Tailwind's md, which is where the frame's
             * own aspect changes too.
             */
            <picture className="block w-full h-full">
              {srcMobile && <source media="(max-width: 767px)" srcSet={srcMobile} />}
              <img
                src={src}
                alt={alt}
                className="w-full h-full object-cover"
                /* The hero is the largest thing above the fold and shouldn't be
                   deferred; everything below it can wait until it's near. */
                loading={hero ? 'eager' : 'lazy'}
                decoding="async"
              />
            </picture>
          )
          : <AppMock variant={mock} />}
      </div>
    </div>
  );
}

/* ── Placeholder ───────────────────────────────────────────────────────── */

/*
 * The shapes a placeholder can take. Each one is a LAYOUT, not an app: 'columns'
 * is any multi-column screen and 'document' is any nav-plus-document editor, so
 * a new app usually finds its screens already here rather than adding to this
 * list. Add a variant when a screen's shape genuinely isn't in it — a mock that
 *'s the wrong shape is worse than a generic one, because it tells the reader
 * something false about the product.
 */
export type MockVariant =
  | 'columns' | 'booking' | 'battles' | 'stats' | 'store' | 'update'
  | 'document' | 'page' | 'list';

/** The apps' real background. Not marketing tokens on purpose — this is
 *  standing in for a screenshot, and a screenshot is app-coloured. The greys
 *  are the same in every app; only the accent differs, so that one reads
 *  through --mk-app-accent, which each brand block in marketing.css sets. */
const APP_BG = '#030712';
const APP_PANEL = '#111827';
const APP_LINE = '#1f2937';
const APP_ACCENT = 'var(--mk-app-accent)';
/** The same accent where an alpha is needed. See the brand blocks. */
const APP_ACCENT_A = (a: number) => `rgb(var(--mk-app-accent-rgb) / ${a})`;

function Bar({ w, h = 8, c = APP_LINE, r = 4 }: { w: string; h?: number; c?: string; r?: number }) {
  return <div style={{ width: w, height: h, background: c, borderRadius: r }} />;
}

function Panel({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      className={`p-3 flex flex-col gap-2.5 ${className}`}
      style={{ background: APP_PANEL, borderRadius: 10, border: `1px solid ${APP_LINE}` }}
    >
      {children}
    </div>
  );
}

function Card({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className="p-2.5 flex flex-col gap-2"
      style={{
        background: accent ? APP_ACCENT_A(0.14) : '#0b1220',
        borderRadius: 8,
        border: `1px solid ${accent ? APP_ACCENT_A(0.35) : APP_LINE}`,
      }}
    >
      <Bar w="70%" h={7} c={accent ? APP_ACCENT : '#374151'} />
      <Bar w="45%" h={6} c="#293244" />
    </div>
  );
}

export function AppMock({ variant = 'columns' }: { variant?: MockVariant }) {
  return (
    <div className="w-full h-full p-3 md:p-4" style={{ background: APP_BG }}>
      {/* App chrome — a single slim bar, no browser furniture. */}
      <div className="flex items-center justify-between mb-3 px-1">
        <Bar w="72px" h={9} c="#4b5563" />
        <div className="flex items-center gap-2">
          <Bar w="40px" h={7} />
          <div style={{ width: 18, height: 18, borderRadius: 999, background: APP_ACCENT, opacity: 0.8 }} />
        </div>
      </div>
      {variant === 'columns' && <MockColumns />}
      {variant === 'booking' && <MockBooking />}
      {variant === 'battles' && <MockBattles />}
      {variant === 'stats' && <MockStats />}
      {variant === 'store' && <MockStore />}
      {variant === 'update' && <MockUpdate />}
      {variant === 'document' && <MockDocument />}
      {variant === 'page' && <MockPage />}
      {variant === 'list' && <MockList />}
    </div>
  );
}

function MockColumns() {
  return (
    <div className="grid grid-cols-3 gap-3 h-[calc(100%-2rem)]">
      <Panel><Bar w="55%" h={9} c="#4b5563" /><Card accent /><Card /><Card /></Panel>
      <Panel><Bar w="50%" h={9} c="#4b5563" />
        <div className="grid grid-cols-2 gap-2">
          <PhotoCard /><PhotoCard /><PhotoCard /><PhotoCard />
        </div>
      </Panel>
      <Panel><Bar w="60%" h={9} c="#4b5563" /><Card /><Card /><Card /></Panel>
    </div>
  );
}

function PhotoCard() {
  return (
    <div
      className="aspect-[4/3] flex items-end p-1.5"
      style={{
        borderRadius: 8,
        background: 'linear-gradient(150deg, #2a2440 0%, #16213a 55%, #0b1220 100%)',
        border: `1px solid ${APP_LINE}`,
      }}
    >
      <Bar w="65%" h={6} c="#6b7280" />
    </div>
  );
}

function MockBooking() {
  return (
    <div className="grid grid-cols-5 gap-3 h-[calc(100%-2rem)]">
      <Panel className="col-span-3">
        <Bar w="45%" h={10} c="#4b5563" />
        {['80%', '65%', '72%'].map((w, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Bar w="28%" h={6} c="#374151" />
            <div style={{ height: 24, borderRadius: 8, background: '#0b1220', border: `1px solid ${APP_LINE}`, width: w }} />
          </div>
        ))}
        <div className="flex gap-1.5 mt-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex-1" style={{
              height: 22, borderRadius: 6,
              background: i === 1 ? APP_ACCENT_A(0.25) : '#0b1220',
              border: `1px solid ${i === 1 ? APP_ACCENT : APP_LINE}`,
            }} />
          ))}
        </div>
        <div style={{ height: 26, borderRadius: 999, background: APP_ACCENT, marginTop: 4 }} />
      </Panel>
      <Panel className="col-span-2"><Bar w="60%" h={9} c="#4b5563" /><Card accent /><Card /><Card /></Panel>
    </div>
  );
}

function MockBattles() {
  return (
    <div className="grid grid-cols-3 gap-2.5 h-[calc(100%-2rem)]">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex flex-col justify-end p-2" style={{
          borderRadius: 10,
          background: [
            'linear-gradient(155deg, #3a2b52 0%, #1b2340 60%, #0a0f1c 100%)',
            'linear-gradient(155deg, #24354a 0%, #16233a 60%, #0a0f1c 100%)',
            'linear-gradient(155deg, #452c3a 0%, #2a1c2e 60%, #0a0f1c 100%)',
          ][i % 3],
          border: `1px solid ${APP_LINE}`,
        }}>
          <Bar w="72%" h={7} c="#9ca3af" />
          <div className="mt-1.5 flex items-center gap-1.5">
            <div style={{
              width: 26, height: 11, borderRadius: 3,
              background: i % 3 === 1 ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)',
            }} />
            <Bar w="35%" h={6} c="#4b5563" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MockStats() {
  return (
    <div className="grid grid-cols-3 gap-3 h-[calc(100%-2rem)]">
      <Panel>
        <Bar w="50%" h={9} c="#4b5563" />
        <div className="flex items-end gap-1 flex-1 pt-2">
          {[40, 65, 30, 80, 55, 90, 45, 70].map((h, i) => (
            <div key={i} className="flex-1" style={{
              height: `${h}%`, borderRadius: 3,
              background: i === 5 ? APP_ACCENT : '#2a3547',
            }} />
          ))}
        </div>
      </Panel>
      <Panel>
        <Bar w="42%" h={9} c="#4b5563" />
        <div className="flex-1 flex items-center justify-center">
          <div style={{
            width: 84, height: 84, borderRadius: 999,
            background: `conic-gradient(${APP_ACCENT} 0 68%, #253046 68% 100%)`,
          }} />
        </div>
        <Bar w="55%" h={7} c="#374151" />
      </Panel>
      <Panel>
        <Bar w="58%" h={9} c="#4b5563" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ width: 16, height: 16, borderRadius: 4, background: '#2a3547' }} />
            <Bar w={`${70 - i * 10}%`} h={7} c="#374151" />
          </div>
        ))}
      </Panel>
    </div>
  );
}

function MockStore() {
  return (
    <div className="grid grid-cols-2 gap-3 h-[calc(100%-2rem)]">
      <Panel>
        <Bar w="38%" h={9} c="#4b5563" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center justify-between px-2.5" style={{
            height: 30, borderRadius: 8, background: '#0b1220', border: `1px solid ${APP_LINE}`,
          }}>
            <Bar w="90px" h={7} c="#374151" />
            <Bar w="34px" h={7} c="#293244" />
          </div>
        ))}
      </Panel>
      <Panel>
        <Bar w="46%" h={9} c="#4b5563" />
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 5,
              background: [3, 6, 9, 10, 14].includes(i) ? APP_ACCENT_A(0.5) : '#16203a',
            }} />
          ))}
        </div>
        <Bar w="60%" h={7} c="#374151" />
      </Panel>
    </div>
  );
}

/*
 * A nav, a document and a form — BattlePack's editor, and the shape of any
 * three-column builder. The centre column is deliberately the widest and the
 * only one carrying paragraphs: it's the thing being written.
 */
function MockDocument() {
  return (
    <div className="grid grid-cols-[1fr_2fr_1.4fr] gap-3 h-[calc(100%-2rem)]">
      <Panel>
        <Bar w="60%" h={9} c="#4b5563" />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-2" style={{ opacity: i === 1 ? 1 : 0.65 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 4,
              background: i === 1 ? APP_ACCENT : '#2a3547',
            }} />
            <Bar w={`${72 - (i % 3) * 12}%`} h={7} c={i === 1 ? '#6b7280' : '#374151'} />
          </div>
        ))}
      </Panel>

      <Panel>
        {/* The banner the document opens on. */}
        <div style={{
          height: 34, borderRadius: 6,
          background: `linear-gradient(160deg, ${APP_ACCENT_A(0.4)} 0%, #16203a 60%, #0a0f1c 100%)`,
        }} />
        <Bar w="72%" h={11} c="#6b7280" />
        <Bar w="40%" h={7} c="#374151" />
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-1.5 mt-1">
            <Bar w="34%" h={8} c="#4b5563" />
            <Bar w="96%" h={6} c="#293244" />
            <Bar w="88%" h={6} c="#293244" />
            <Bar w={`${60 + i * 8}%`} h={6} c="#293244" />
          </div>
        ))}
      </Panel>

      <Panel>
        <Bar w="52%" h={9} c="#4b5563" />
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-1.5">
            <Bar w="30%" h={6} c="#374151" />
            <div style={{ height: 22, borderRadius: 8, background: '#0b1220', border: `1px solid ${APP_LINE}` }} />
          </div>
        ))}
        <div className="flex-1" style={{ borderRadius: 8, background: '#0b1220', border: `1px solid ${APP_LINE}` }} />
        <div style={{ height: 24, borderRadius: 999, background: APP_ACCENT, width: '55%' }} />
      </Panel>
    </div>
  );
}

/*
 * A published page as a reader gets it: one centred column under a banner, with
 * a boxed card of facts beside the prose. Narrower than the screen on purpose —
 * a public page that ran the full width would be indistinguishable from the
 * editor above.
 */
function MockPage() {
  return (
    <div className="h-[calc(100%-2rem)] flex justify-center">
      <div className="w-[76%] flex flex-col gap-3">
        <div style={{
          height: 60, borderRadius: 10,
          background: `linear-gradient(160deg, ${APP_ACCENT_A(0.45)} 0%, #16203a 55%, #0a0f1c 100%)`,
          border: `1px solid ${APP_LINE}`,
        }} />
        <Bar w="58%" h={13} c="#6b7280" />
        <Bar w="34%" h={7} c="#374151" />

        <div className="grid grid-cols-[1.6fr_1fr] gap-3 flex-1 min-h-0">
          <Panel>
            <Bar w="30%" h={8} c="#4b5563" />
            {['94%', '88%', '96%', '62%'].map((w, i) => <Bar key={i} w={w} h={6} c="#293244" />)}
            <Bar w="34%" h={8} c="#4b5563" />
            {['90%', '80%'].map((w, i) => <Bar key={i} w={w} h={6} c="#293244" />)}
          </Panel>

          <Panel>
            <Bar w="52%" h={8} c="#4b5563" />
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between gap-2">
                <Bar w="38%" h={6} c="#374151" />
                <Bar w="44%" h={6} c="#293244" />
              </div>
            ))}
            {/* The calendar button, the card's last row. */}
            <div style={{
              height: 22, borderRadius: 999, marginTop: 2,
              border: `1px solid ${APP_ACCENT_A(0.45)}`, background: APP_ACCENT_A(0.12),
            }} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/*
 * One centred column of rows, each with a status. The shape of every "my
 * things" screen in the suite — a venue's events, an organiser's packs — and
 * the one shape the rest of this set was missing: everything else here is two
 * or three columns, so a single-column screen had nothing to stand in for it.
 *
 * The rows vary in how much they carry on purpose. A column of identical rows
 * reads as a table; the point of these screens is that the things in them are
 * different sizes.
 */
function MockList() {
  const ROWS = [
    { w: '64%', sub: '38%', badge: APP_ACCENT_A(0.5) },
    { w: '78%', sub: '44%', badge: APP_ACCENT_A(0.5) },
    { w: '52%', sub: '30%', badge: APP_ACCENT_A(0.5) },
    { w: '70%', sub: '36%', badge: '#2a3547' },
    { w: '58%', sub: '42%', badge: '#2a3547' },
  ];
  return (
    <div className="h-[calc(100%-2rem)] flex justify-center">
      <div className="w-[62%] min-w-0">
        <Panel className="h-full">
          <Bar w="46%" h={10} c="#4b5563" />
          {/* The filter row. */}
          <div className="flex gap-1.5">
            {['46px', '30px', '24px'].map((w, i) => (
              <div key={i} style={{
                width: w, height: 16, borderRadius: 999,
                background: i === 0 ? APP_ACCENT_A(0.16) : '#0b1220',
                border: `1px solid ${i === 0 ? APP_ACCENT_A(0.45) : APP_LINE}`,
              }} />
            ))}
          </div>
          {ROWS.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-2.5" style={{
              height: 40, borderRadius: 8, background: '#0b1220', border: `1px solid ${APP_LINE}`,
            }}>
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <Bar w={row.w} h={7} c="#4b5563" />
                <Bar w={row.sub} h={6} c="#293244" />
              </div>
              <div style={{ width: 34, height: 10, borderRadius: 999, background: row.badge, flexShrink: 0 }} />
            </div>
          ))}
          <div className="mt-auto" style={{
            height: 24, borderRadius: 999,
            border: `1px solid ${APP_ACCENT_A(0.45)}`, background: APP_ACCENT_A(0.1),
          }} />
        </Panel>
      </div>
    </div>
  );
}

function MockUpdate() {
  return (
    <div className="grid grid-cols-2 gap-3 h-[calc(100%-2rem)]">
      <Panel>
        <Bar w="52%" h={9} c="#4b5563" />
        <div style={{ height: 20, borderRadius: 6, background: '#0b1220', border: `1px solid ${APP_LINE}` }} />
        <div className="flex-1" style={{ borderRadius: 8, background: '#0b1220', border: `1px solid ${APP_LINE}` }} />
        <div style={{ height: 24, borderRadius: 999, background: APP_ACCENT, width: '45%' }} />
      </Panel>
      <Panel>
        <Bar w="44%" h={9} c="#4b5563" />
        <Card accent />
        <Card />
      </Panel>
    </div>
  );
}
