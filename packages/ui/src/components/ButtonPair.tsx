/**
 * ButtonPair.tsx — Two actions that stack on desktop, sit side-by-side on mobile
 *
 * Two full-width stacked buttons eat a lot of vertical space on small screens.
 * This wrapper lays a pair of buttons out side-by-side below `md` and stacked
 * from `md` up, so mobile reclaims the height. Wrap exactly two <Button>s; each
 * is stretched to share the row on mobile and fill the column on desktop.
 *
 * Pair it with responsive labels for the tightest mobile fit, e.g.:
 *   <ButtonPair>
 *     <Button>…<span className="md:hidden">Add</span>
 *              <span className="hidden md:inline">Add to Collection</span></Button>
 *     …
 *   </ButtonPair>
 */

import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode, ReactElement } from 'react';

export interface ButtonPairProps {
  /** Exactly two <Button> elements. */
  children: ReactNode;
  /** Extra Tailwind classes on the wrapper. */
  className?: string;
}

export default function ButtonPair({ children, className = '' }: ButtonPairProps) {
  return (
    <div className={`flex flex-row md:flex-col gap-2 w-full ${className}`.trim()}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{ className?: string }>;
        // flex-1 → equal share in the mobile row; md:flex-none + md:w-full →
        // normal-height full-width buttons once stacked.
        const merged = `flex-1 md:flex-none md:w-full ${el.props.className ?? ''}`.trim();
        return cloneElement(el, { className: merged });
      })}
    </div>
  );
}
