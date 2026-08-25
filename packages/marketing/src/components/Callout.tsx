/**
 * Callout.tsx — A feature that deserves more than a bullet
 *
 * For the one thing on a page that would disappear in a list — BattlePlan uses
 * it for Suggested Battles, BattlePack for the emails a moved date sends. It
 * gets an accent-edged panel of its own inside a deep dive.
 *
 * Used sparingly on purpose. Two of these on a page and neither is special.
 */

export function Callout({ quote, body }: { quote: string; body: string }) {
  return (
    <div className="mk-callout mt-10 p-6">
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
