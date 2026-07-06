/**
 * AppFooter.tsx — App version / build-date footer
 *
 * The dim strip shown at the bottom of each app's home screen, reporting
 * the running app version and its build date.
 *
 * Responsive behaviour:
 *   Tablet / Desktop (≥ md, 768 px+)
 *     A single centred line: "{app} version x  –  Build date y".
 *   Mobile (< md)
 *     Stacks onto two centred lines and drops the "–" separator:
 *       {app} version x
 *       Build date y
 *
 * `version` and `buildDate` are injected per-app at build time (the
 * __APP_VERSION__ / __APP_BUILD_DATE__ globals), so they're passed in
 * as props rather than read here.
 *
 * USAGE:
 *   <AppFooter appName="BattleCards" version={__APP_VERSION__} buildDate={__APP_BUILD_DATE__} />
 */

export interface AppFooterProps {
  /** Product name shown before "version" (e.g. "BattleCards"). */
  appName: string;
  /** App version string, e.g. "0.16.0". */
  version: string;
  /** Build date string, e.g. "06/07/2026". */
  buildDate: string;
  /** Extra Tailwind classes merged onto the footer element. */
  className?: string;
}

const AppFooter = ({ appName, version, buildDate, className = '' }: AppFooterProps) => (
  <footer
    className={[
      'flex flex-col md:flex-row items-center justify-center',
      'gap-1 md:gap-3 py-1.5 text-center whitespace-nowrap',
      'font-body font-bold text-xs text-neutral-800 uppercase tracking-[1.2px]',
      className,
    ].join(' ').trim()}
  >
    <span>{appName} version {version}</span>
    {/* Separator only makes sense on the single-line layout. */}
    <span className="hidden md:inline" aria-hidden="true">–</span>
    <span>Build date {buildDate}</span>
  </footer>
);

export default AppFooter;
