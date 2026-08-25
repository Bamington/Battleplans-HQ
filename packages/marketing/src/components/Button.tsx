/**
 * Button.tsx — Marketing call to action
 *
 * Not the app's <Button>. This one is a pill, uses the marketing accent, and
 * renders dark ink on a bright fill rather than the app's white-on-violet —
 * white on the accent fails contrast at 3.5:1, dark ink passes at 5.7:1.
 *
 * Always an anchor or a router link: nothing on these pages submits anything.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '../icons';

type Variant = 'primary' | 'ghost';

interface Props {
  to: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}

/** True for anything that leaves the SPA — those need a real <a>. */
function isExternal(to: string) {
  return to.startsWith('http') || to.startsWith('#') || to.startsWith('mailto:');
}

export function CTAButton({ to, variant = 'primary', className = '', children }: Props) {
  const classes = `mk-btn mk-btn-${variant} ${className}`;

  if (isExternal(to)) {
    return <a href={to} className={classes}>{children}</a>;
  }
  return <Link to={to} className={classes}>{children}</Link>;
}

/** The quiet secondary action — accent text with a trailing arrow. */
export function ArrowLink({ to, className = '', children }: Omit<Props, 'variant'>) {
  const content = (
    <>
      {children}
      <ArrowRight className="w-4 h-4" />
    </>
  );

  if (isExternal(to)) {
    return <a href={to} className={`mk-link ${className}`}>{content}</a>;
  }
  return <Link to={to} className={`mk-link ${className}`}>{content}</Link>;
}
