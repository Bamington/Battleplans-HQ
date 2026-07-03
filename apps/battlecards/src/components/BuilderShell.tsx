/**
 * BuilderShell.tsx — Outer 3-column layout for every card-builder page.
 *
 * Owns the chrome shared by Halo / Starcraft / Blood Bowl (and future games):
 *   - Full-height column wrapper with the gray-950 page background.
 *   - Slot for the Navbar (always rendered).
 *   - Slot for an optional sub-bar directly below the navbar (EditSubnav,
 *     PlaySubnav, etc.).
 *   - A flex-row body containing optional left/right `<aside>` panels and a
 *     centre `<main>`-like region. The asides apply the responsive
 *     show/hide + ordering classes that all three current builders use.
 *   - Slot at the end for modal portals.
 *
 * The shell is intentionally a slot-based component — game-specific concerns
 * (Navbar children, which subnav to render, what's in each panel, which
 * modals are mounted) stay with the page. The shell only owns the layout.
 *
 * USAGE (composed with the other shells + useCardBuilder):
 *   const builder = useCardBuilder({ deckId });
 *   return (
 *     <BuilderShell
 *       navbar={<Navbar>{...}</Navbar>}
 *       topBar={<EditSubnav className="lg:hidden" {...} />}
 *       leftPanel={<CardListPanel {...}>{cardListBody}</CardListPanel>}
 *       leftPanelOpen={builder.cardListOpen}
 *       center={<CenterViewport logo={<img .../>} {...}>{carousel}</CenterViewport>}
 *       rightPanel={<EditorPanel title="Edit Card">{editorBody}</EditorPanel>}
 *       rightPanelOpen={builder.editorOpen}
 *       modals={<>{photoModal}{deleteConfirmModal}{...}</>}
 *     />
 *   );
 */

import type { ReactNode } from 'react';

export interface BuilderShellProps {
  /** Top navbar — always rendered. Pass an already-configured <Navbar> element. */
  navbar: ReactNode;
  /** Optional sub-bar below the navbar (EditSubnav, PlaySubnav, etc.). */
  topBar?: ReactNode;

  /** Content of the left aside (typically a <CardListPanel>). Omit to hide. */
  leftPanel?: ReactNode;
  /** Mobile slide-in state for the left aside. Ignored at lg+ where the aside is always visible. */
  leftPanelOpen?: boolean;

  /** Centre region content (typically a <CenterViewport>). */
  center: ReactNode;

  /** Content of the right aside (typically an <EditorPanel>). Omit to hide. */
  rightPanel?: ReactNode;
  /** Mobile slide-in state for the right aside. Ignored at lg+ where the aside is always visible. */
  rightPanelOpen?: boolean;

  /** Modal portals — rendered as the last child of the page wrapper. */
  modals?: ReactNode;
}

const ASIDE_BASE =
  'w-full md:w-64 shrink-0 max-md:flex-1 max-md:min-h-0 ' +
  'flex-col bg-gray-900 overflow-hidden';

const LEFT_ASIDE  = `${ASIDE_BASE} order-2 md:order-1 border-r border-gray-700 max-md:border-r-0 max-md:border-t`;
const RIGHT_ASIDE = `${ASIDE_BASE} order-2 md:order-3 border-l border-gray-700 max-md:border-l-0 max-md:border-t`;

const BuilderShell = ({
  navbar,
  topBar,
  leftPanel,
  leftPanelOpen = false,
  center,
  rightPanel,
  rightPanelOpen = false,
  modals,
}: BuilderShellProps) => {
  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {navbar}
      {topBar}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {leftPanel != null && (
          <aside className={`${LEFT_ASIDE} ${leftPanelOpen ? 'flex' : 'hidden'} lg:flex`}>
            {leftPanel}
          </aside>
        )}

        {center}

        {rightPanel != null && (
          <aside className={`${RIGHT_ASIDE} ${rightPanelOpen ? 'flex' : 'hidden'} lg:flex`}>
            {rightPanel}
          </aside>
        )}
      </div>

      {modals}
    </div>
  );
};

export default BuilderShell;
