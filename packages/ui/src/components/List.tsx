/**
 * List.tsx — List component
 *
 * Renders ordered, unordered, and description lists with consistent
 * typography using the Space Grotesk body font.
 *
 * USAGE EXAMPLES:
 *   <List variant="unordered" items={['Swords', 'Shields', 'Spears']} />
 *   <List variant="ordered"   items={['Deploy', 'Attack', 'Retreat']} />
 *   <List variant="unstyled"  items={['No bullets here']} />
 *   <List variant="horizontal" items={['Fast', 'Ranged', 'Heavy']} />
 *   <List
 *     variant="description"
 *     descriptionItems={[{ term: 'Attack', detail: 'Number of dice rolled' }]}
 *   />
 */


// ── Type definitions ─────────────────────────────────────────────────────────

/** All available list style variants */
export type ListVariant =
  | 'unordered'    // Bullet list
  | 'ordered'      // Numbered list
  | 'unstyled'     // No bullets or numbers
  | 'horizontal'   // Inline / horizontal list
  | 'description'; // Term + detail pairs (dl/dt/dd)

/** A single item for description lists */
export interface DescriptionItem {
  /** The term being defined */
  term: string;
  /** The definition or detail */
  detail: string;
}

export interface ListProps {
  /** Controls the list style and HTML element rendered */
  variant?: ListVariant;
  /**
   * Text items for unordered, ordered, unstyled, and horizontal lists.
   * Not used when variant='description' — use descriptionItems instead.
   */
  items?: string[];
  /**
   * Term/detail pairs for description lists.
   * Only used when variant='description'.
   */
  descriptionItems?: DescriptionItem[];
  /** Extra Tailwind classes to merge onto the list wrapper */
  className?: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

/** Applied to every <li> in standard lists */
const LI_BASE = 'font-body text-gray-700 dark:text-gray-300';

// ── Component ─────────────────────────────────────────────────────────────────

const List = ({
  variant = 'unordered',
  items = [],
  descriptionItems = [],
  className = '',
}: ListProps) => {

  // ── Description list ───────────────────────────────────────────────────────
  // Renders <dl> with alternating <dt> (term) and <dd> (detail) pairs,
  // separated by a subtle divider.
  if (variant === 'description') {
    return (
      <dl className={`font-body divide-y divide-gray-200 dark:divide-gray-700 ${className}`.trim()}>
        {descriptionItems.map(({ term, detail }, index) => (
          <div key={index} className="flex flex-col py-3 sm:flex-row sm:gap-6">
            {/* Term — rendered bold */}
            <dt className="text-sm font-semibold text-gray-900 dark:text-white min-w-32">
              {term}
            </dt>
            {/* Detail — rendered in body colour */}
            <dd className="text-sm text-gray-700 dark:text-gray-300">
              {detail}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  // ── Horizontal list ────────────────────────────────────────────────────────
  // Renders items inline in a row, separated by a subtle divider.
  if (variant === 'horizontal') {
    return (
      <ul className={`font-body flex flex-wrap items-center gap-x-6 gap-y-2 ${className}`.trim()}>
        {items.map((item, index) => (
          <li key={index} className={`${LI_BASE} text-sm`}>
            {item}
          </li>
        ))}
      </ul>
    );
  }

  // ── Standard lists (unordered, ordered, unstyled) ─────────────────────────

  // Map variant to the correct HTML element and bullet/number style
  const listConfig: Record<
    'unordered' | 'ordered' | 'unstyled',
    { tag: 'ul' | 'ol'; listClass: string }
  > = {
    unordered: { tag: 'ul', listClass: 'list-disc   list-inside space-y-1' },
    ordered:   { tag: 'ol', listClass: 'list-decimal list-inside space-y-1' },
    unstyled:  { tag: 'ul', listClass: 'list-none    list-inside space-y-1' },
  };

  const { tag: Tag, listClass } = listConfig[variant as 'unordered' | 'ordered' | 'unstyled'];

  return (
    <Tag className={`font-body ${listClass} ${className}`.trim()}>
      {items.map((item, index) => (
        <li key={index} className={LI_BASE}>
          {item}
        </li>
      ))}
    </Tag>
  );
};

export default List;
