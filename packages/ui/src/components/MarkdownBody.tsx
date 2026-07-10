/**
 * MarkdownBody.tsx — Renders a markdown string with the app's prose styling.
 *
 * Used for release-note bodies: full-size in UpdateModal, and clamped inside the
 * "News & Updates" preview cards.
 *
 * USAGE:
 *   <MarkdownBody className="text-base leading-6 text-gray-300">{update.body}</MarkdownBody>
 *   <MarkdownBody className="text-sm leading-5 text-white line-clamp-5">{update.body}</MarkdownBody>
 *
 * NOTES:
 *   - Spacing uses `space-y-*` rather than `flex flex-col gap-*` on purpose:
 *     Tailwind's `line-clamp-*` sets `display: -webkit-box`, which would fight a
 *     `display: flex` wrapper and break truncation in the preview cards.
 *   - Colours are deliberately NOT baked in — each app themes it via className
 *     (battlecards uses the gray palette, battleplan the neutral one).
 */

import Markdown from 'react-markdown';

export interface MarkdownBodyProps {
  /** The markdown source to render. */
  children: string;
  /** Extra classes on the wrapper — set the text colour/size here. */
  className?: string;
}

/** Structural prose rules. Colour, size and leading are left to the caller. */
const PROSE = [
  'font-body space-y-3',
  '[&_strong]:font-semibold',
  '[&_ul]:list-disc [&_ul]:ps-5 [&_ul]:space-y-1',
  '[&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:space-y-1',
  '[&_h1]:font-heading [&_h1]:text-lg',
  '[&_h2]:font-heading [&_h2]:text-base',
  '[&_h3]:font-heading [&_h3]:text-base',
  '[&_a]:underline',
  '[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm',
].join(' ');

export default function MarkdownBody({ children, className = '' }: MarkdownBodyProps) {
  return (
    <div className={[PROSE, className].filter(Boolean).join(' ')}>
      <Markdown>{children}</Markdown>
    </div>
  );
}
