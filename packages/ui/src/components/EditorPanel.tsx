/**
 * EditorPanel.tsx — Right-aside chrome for the builder shell.
 *
 * The right-side editor panel is structurally identical across every builder:
 *   - Sticky header with a heading (e.g. "Edit Card", "Event Basics").
 *   - Vertically scrollable body.
 *
 * What's *inside* the body — form fields, sections, modals — is entirely
 * page-specific and stays with the page. This component only owns the chrome.
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
  /** Form contents — page-specific. */
  children?: ReactNode;
}

const EditorPanel = ({ title, headerAction, children }: EditorPanelProps) => {
  return (
    <>
      {/* The divider is on the padded header itself, so it runs the full width
          of the panel. Second-level dividers live inside the body's px-3 and
          are therefore inset — that difference is what separates "this is the
          panel" from "this is a group within it". */}
      {/* 16px above, 17px below — the design's, and not a typo: Tanker sits
          high in its box, so an even split reads bottom-heavy. */}
      <div className="px-4 pt-4 pb-[17px] border-b border-gray-700 shrink-0 flex items-center gap-2">
        {/* Tanker 18/18. On a 24px line the descenders push the rule down and
            the header stops matching the design's height. */}
        <h2 className="flex-1 min-w-0 font-heading text-lg leading-[18px] text-white uppercase tracking-wide truncate">
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
