/**
 * PlaceholderForm.tsx — the right-panel form every category points at until it
 * has one of its own.
 *
 * The registry declares a `Form` per category so the editor can be built and
 * navigated before any of the forms exist. Each real form replaces one of these
 * references and nothing else changes: Event Basics proves the `core` write
 * path, Rounds & Breaks the schedule table, FAQ the `section` jsonb.
 *
 * It renders the category's storage path rather than a generic "coming soon",
 * because which of the three a category uses is the thing worth knowing while
 * the editor is being wired up.
 */

import { Callout } from '@battleplans/ui';
import type { CategoryFormProps } from '../../registry/categories';
import { CATEGORY_BY_KEY } from '../../registry/categories';

const STORAGE_BLURB: Record<string, string> = {
  core:     'writes to columns on the pack row',
  schedule: 'writes to the schedule items table',
  section:  'writes to the category content jsonb',
};

const PlaceholderForm = ({ categoryKey }: CategoryFormProps) => {
  const definition = CATEGORY_BY_KEY[categoryKey];

  return (
    <Callout flavour="default">
      <span className="font-body text-sm">
        {definition
          ? <>The <strong>{definition.label}</strong> form is not built yet. It {STORAGE_BLURB[definition.storage]}.</>
          : <>This form is not built yet.</>}
      </span>
    </Callout>
  );
};

export default PlaceholderForm;
