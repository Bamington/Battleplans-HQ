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
  /** App version string, e.g. "0.16.0". Unused when `note` is given. */
  version?: string;
  /** Build date string, e.g. "06/07/2026". Unused when `note` is given. */
  buildDate?: string;
  /**
   * One line to show INSTEAD of the version and build date.
   *
   * For pages with an audience outside the team. BattlePack's public event page
   * is read by attendees, and a build date tells them nothing while quietly
   * saying they are looking at somebody's internal tool.
   */
  note?: string;
  /** Extra Tailwind classes merged onto the footer element. */
  className?: string;
}

const AppFooter = ({ appName, version, buildDate, note, className = '' }: AppFooterProps) => (
  <footer
    className={[
      'flex flex-col md:flex-row items-center justify-center',
      'gap-1 md:gap-3 py-1.5 text-center whitespace-nowrap',
      'font-body font-bold text-xs text-neutral-800 uppercase tracking-[1.2px]',
      className,
    ].join(' ').trim()}
  >
    {note ? <span>{note}</span> : (
      <>
        <span>{appName} version {version}</span>
        {/* Separator only makes sense on the single-line layout. */}
        <span className="hidden md:inline" aria-hidden="true">–</span>
        <span>Build date {buildDate}</span>
      </>
    )}
  </footer>
);

export default AppFooter;
