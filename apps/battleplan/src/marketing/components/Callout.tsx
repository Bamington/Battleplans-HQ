/**
 * Callout.tsx — A feature that deserves more than a bullet
 *
 * Used once, for Suggested Battles. It's the most distinctive thing BattlePlan
 * does and it would disappear in a list, so it gets an accent-edged panel of
 * its own inside the battle-log deep dive.
 */

export function Callout({ quote, body }: { quote: string; body: string }) {
  return (
    <div
      className="mt-10 p-6"
      style={{
        background: 'rgba(155, 107, 255, 0.07)',
        border: '1px solid rgba(155, 107, 255, 0.28)',
        borderRadius: 'var(--mk-radius-card)',
      }}
    >
      <p
        className="mk-display-3"
        style={{ fontFamily: 'var(--mk-font-ui)', fontWeight: 500, letterSpacing: '-0.005em' }}
      >
        “{quote}”
      </p>
      <p className="mk-body-sm mt-3">{body}</p>
    </div>
  );
}
