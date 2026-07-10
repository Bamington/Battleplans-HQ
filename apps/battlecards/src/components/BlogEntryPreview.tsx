/**
 * BlogEntryPreview.tsx — Blog / release-note preview card
 *
 * A compact card showing a post title, a short body excerpt clamped to
 * 5 lines, and a right-aligned "Read Update" link button.
 *
 * Matches the Figma "Card / Blog Entry Preview" component (node 270:2330).
 *
 * USAGE EXAMPLES:
 *   <BlogEntryPreview
 *     title="v1.2 — New Card Builder"
 *     body="This release ships the updated Blood Bowl card builder with..."
 *   />
 *
 *   <BlogEntryPreview
 *     title="Maintenance Notice"
 *     body="Scheduled maintenance on Sunday at 2 am UTC."
 *     onRead={() => navigate('/blog/maintenance-apr-2026')}
 *   />
 *
 * PROPS:
 *   title     — Post / note heading (Tanker heading font, 18 px).
 *   body      — Preview body content, truncated to 5 lines automatically.
 *   onRead    — Called when "Read Update" is clicked. Omit to hide the button.
 *   className — Extra Tailwind classes on the outer element.
 */

import type { ReactNode } from 'react';
import { ArrowRight } from '@battleplans/ui';

// ── Type definitions ──────────────────────────────────────────────────────────

export interface BlogEntryPreviewProps {
  /** Post / note title */
  title: string;
  /**
   * Body content — automatically clamped to 5 lines. Accepts a plain string, or
   * rendered markdown (e.g. <MarkdownBody>), which emits block elements.
   */
  body: ReactNode;
  /** Called when the "Read Update" button is clicked */
  onRead?: () => void;
  /** Extra Tailwind classes on the outer element */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const BlogEntryPreview = ({
  title,
  body,
  onRead,
  className = '',
}: BlogEntryPreviewProps) => {
  return (
    <div
      className={[
        'flex flex-col gap-1.5 w-full overflow-hidden p-[13px]',
        'bg-gray-800 border border-gray-700 rounded-lg shadow-sm',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <p className="font-heading text-[18px] leading-6 text-white">
        {title}
      </p>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="h-px w-full bg-gray-700 shrink-0" />

      {/* ── Body — SM Regular, clamped to 5 lines ────────────────────────────
           A <div>, not a <p>: `body` may be rendered markdown containing block
           elements (<p>, <ul>), which are invalid inside a paragraph. */}
      <div className="font-body text-sm leading-5 text-white line-clamp-5">
        {body}
      </div>

      {/* ── "Read Update" button — right-aligned, ghost blue ──────────────── */}
      {onRead && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRead}
            className={[
              'flex items-center gap-2 px-4 py-2.5 rounded-lg',
              'font-body text-sm font-medium',
              'text-blue-500 hover:text-blue-400 transition-colors',
            ].join(' ')}
          >
            Read Update
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BlogEntryPreview;
