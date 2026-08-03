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
          ? <img src={src} alt={alt} className="w-full h-full object-cover" />
          : <AppMock variant={mock} />}
      </div>
    </div>
  );
}

/* ── Placeholder ───────────────────────────────────────────────────────── */

export type MockVariant = 'columns' | 'booking' | 'battles' | 'stats' | 'store' | 'update';

/** The app's real background. Not a marketing token on purpose — this is
 *  standing in for a screenshot, and a screenshot is app-coloured. */
const APP_BG = '#030712';
const APP_PANEL = '#111827';
const APP_LINE = '#1f2937';
const APP_ACCENT = '#8b5cf6';

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
        background: accent ? 'rgba(139,92,246,0.14)' : '#0b1220',
        borderRadius: 8,
        border: `1px solid ${accent ? 'rgba(139,92,246,0.35)' : APP_LINE}`,
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
              background: i === 1 ? 'rgba(139,92,246,0.25)' : '#0b1220',
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
              background: [3, 6, 9, 10, 14].includes(i) ? 'rgba(139,92,246,0.5)' : '#16203a',
            }} />
          ))}
        </div>
        <Bar w="60%" h={7} c="#374151" />
      </Panel>
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
