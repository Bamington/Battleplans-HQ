/**
 * Card3DWrapper.tsx — 3D perspective hover effect container
 *
 * Wraps card content with a mouse-tracking 3D tilt effect.
 * On hover the card tilts toward the cursor using CSS perspective and
 * rotateX/rotateY transforms driven by CSS custom properties, then
 * smoothly springs back on mouse leave.
 *
 * Implementation based on the JS + CSS custom property approach described at
 * https://www.frontend.fyi/tutorials/css-3d-perspective-animations
 *
 * Only use non-interactive content inside (no buttons, inputs, etc.).
 *
 * Usage:
 *   <Card3DWrapper style={{ width: 400, height: 560, position: 'relative' }}>
 *     <MyCard />
 *   </Card3DWrapper>
 */

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface Card3DWrapperProps {
  children: ReactNode;
  /**
   * Applied directly to the outer perspective container. Use this to set
   * width, height, position, filter (drop-shadow), and size transitions.
   */
  className?: string;
  style?: CSSProperties;
  /** Maximum tilt angle in degrees on either axis. Default: 5 */
  maxRotation?: number;
  /** CSS perspective depth in px. Smaller = more dramatic. Default: 800 */
  perspective?: number;
}

const Card3DWrapper = ({
  children,
  className,
  style,
  maxRotation = 5,
  perspective = 800,
}: Card3DWrapperProps) => {
  const [isTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches,
  );

  if (isTouch) {
    return (
      <div className={className} style={style}>
        <div style={{ width: '100%', height: '100%' }}>{children}</div>
      </div>
    );
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - left) / width;
    const yPct = (e.clientY - top) / height;
    // xRot: positive → top edge tilts toward viewer
    // yRot: positive → right edge tilts toward viewer
    const xRot = (0.5 - yPct) * maxRotation;
    const yRot = (xPct - 0.5) * maxRotation;
    e.currentTarget.style.setProperty('--x-rotation', `${xRot}deg`);
    e.currentTarget.style.setProperty('--y-rotation', `${yRot}deg`);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--x-rotation', '0deg');
    e.currentTarget.style.setProperty('--y-rotation', '0deg');
  };

  return (
    <div
      className={className}
      style={{ perspective: `${perspective}px`, ...style }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          width:          '100%',
          height:         '100%',
          transform:      'rotateX(var(--x-rotation, 0deg)) rotateY(var(--y-rotation, 0deg))',
          transition:     'transform 0.15s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Card3DWrapper;
