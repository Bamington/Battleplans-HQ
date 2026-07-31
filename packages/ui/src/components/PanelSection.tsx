/**
 * PanelSection.tsx — a titled group inside an editor panel.
 *
 * The second level of the panel's heading hierarchy. <EditorPanel> owns the
 * first: its title sits above a divider that runs the full width of the panel.
 * This one sits inside the panel body, so its divider is inset by the body's
 * padding — and that difference in width is the whole signal for "this is a
 * group within the panel" rather than "this is the panel".
 *
 * It exists because that heading-and-divider pair was copied into seven places,
 * which meant seven edits every time the design moved and seven chances to miss
 * one. There is now one.
 *
 * `action` is the right-hand side of the heading row — a save-state hint, a
 * status badge, a small button. It is baseline-aligned with the title, so a
 * line of text sits on the same line rather than floating optically high.
 *
 * A STRING action gets the house hint styling, because "Saving…" is what most
 * of them are and every caller styling it themselves is how the last set of
 * copies started. Anything else is rendered untouched — a Badge brings its own
 * colours and must not inherit a muted grey.
 *
 * `children` is optional. Omit it and you get just the heading and its rule,
 * with whatever follows as ordinary siblings — which is what a panel wants when
 * a section's contents are several unrelated blocks rather than one group.
 *
 * USAGE:
 *   <PanelSection title="Basic Details">
 *     <Input label="Event Name" … />
 *   </PanelSection>
 *
 *   <PanelSection title="Prizes" action={saving ? 'Saving…' : ''}>
 *     …
 *   </PanelSection>
 *
 *   <PanelSection title="Status" action={<Badge color="success">Published</Badge>} />
 */

import type { ReactNode } from 'react';
import HR from './HR';

export interface PanelSectionProps {
  /** Section title, e.g. "Basic Details". Sentence case, not uppercase. */
  title: string;
  /** Right-aligned node in the heading row — save state, a badge, an action. */
  action?: ReactNode;
  /** The section's contents. Omit for a bare heading with siblings after it. */
  children?: ReactNode;
}

const PanelSection = ({ title, action, children }: PanelSectionProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        {/* 16px bold against the panel's 18px Tanker above and 14px field
            labels below — the middle step of three. */}
        <h3 className="font-body text-base font-bold text-white">{title}</h3>
        {action != null && action !== '' && (
          typeof action === 'string'
            ? <span className="shrink-0 font-body text-xs text-gray-500">{action}</span>
            : <span className="shrink-0">{action}</span>
        )}
      </div>
      <HR />
    </div>
    {children}
  </div>
);

export default PanelSection;
