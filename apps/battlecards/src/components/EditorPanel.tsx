/**
 * EditorPanel.tsx — Right-aside chrome for the card-builder shell.
 *
 * The right-side editor panel is structurally identical across every builder:
 *   - Sticky header with a heading (e.g. "Edit Card", "Edit Rule").
 *   - Vertically scrollable body.
 *
 * What's *inside* the body — form fields, sections, modals — is entirely
 * game-specific and stays with the page. This component only owns the
 * chrome.
 *
 * Designed to be rendered as the `rightPanel` slot of <BuilderShell>, which
 * supplies the surrounding `<aside>` and its responsive classes.
 *
 * USAGE:
 *   <EditorPanel title={activeRule ? 'Edit Rule' : 'Edit Card'}>
 *     {activeRule ? <RuleForm ... /> : <UnitForm ... />}
 *   </EditorPanel>
 */

import type { ReactNode } from 'react';

export interface EditorPanelProps {
  /** Heading text shown in the panel header (e.g. "Edit Card"). */
  title: string;
  /** Optional right-aligned action node in the header (e.g. close button). */
  headerAction?: ReactNode;
  /** Form contents — game-specific. */
  children?: ReactNode;
}

const EditorPanel = ({ title, headerAction, children }: EditorPanelProps) => {
  return (
    <>
      <div className="px-4 py-4 border-b border-gray-700 shrink-0 flex items-center gap-2">
        <h2 className="flex-1 min-w-0 font-heading text-sm font-bold text-white uppercase tracking-wide truncate">
          {title}
        </h2>
        {headerAction != null && (
          <div className="shrink-0">{headerAction}</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {children}
      </div>
    </>
  );
};

export default EditorPanel;
