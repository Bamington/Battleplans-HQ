/**
 * PacksPlaceholder.tsx — temporary placeholder for the Packs routes
 *
 * Three routes currently resolve here until the real pages are built:
 *   - /app/packs                → mode='manage' — "Manage your packs"
 *   - /app/packs/new            → mode='create' — direct link to create
 *                                  (the in-app flow now uses a modal on
 *                                  /app instead, but the route remains so
 *                                  bookmarks / shared links don't 404)
 *   - /app/packs/:packId/edit   → mode='edit'   — pack editor — the user
 *                                  lands here right after creating a pack
 *
 * Replace each mode with its real page once the Figma is signed off.
 */

import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import Box from '../icons/Box';
import AltArrowLeft from '../icons/AltArrowLeft';

interface Props {
  mode: 'manage' | 'create' | 'edit';
}

const COPY: Record<Props['mode'], { title: string; body: string }> = {
  manage: {
    title: 'Manage your packs',
    body:
      "We're still building this view. It will let you see and edit packs " +
      "you've created or imported.",
  },
  create: {
    title: 'Create a pack',
    body:
      "We're still building this flow. It will let you bundle your " +
      'templates, addons, and keywords into a pack to share with others.',
  },
  edit: {
    title: 'Pack editor',
    body:
      "We're still building this view. Your pack has been created — you'll be " +
      'able to add cards, addons, and keywords to it here.',
  },
};

export default function PacksPlaceholder({ mode }: Props) {
  const navigate = useNavigate();
  // packId is only set for /app/packs/:packId/edit. Read it so the editor
  // placeholder can confirm which pack the user just created.
  const { packId } = useParams<{ packId?: string }>();
  const { title, body } = COPY[mode];

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">

      <Navbar fixed={false} />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">

          <Box className="size-12 text-blue-400" />

          <h1 className="font-heading text-2xl text-white">{title}</h1>

          <p className="font-body text-base text-gray-300">{body}</p>

          {/* Surface the packId when present (edit mode) so the user can
              verify the create flow worked end-to-end before the real
              editor exists. Remove once the editor renders the pack. */}
          {mode === 'edit' && packId && (
            <p className="font-body text-xs text-gray-500 break-all">
              Pack ID: {packId}
            </p>
          )}

          <p className="font-body text-sm text-gray-500">Coming soon.</p>

          <Button
            variant="outline"
            color="secondary"
            leftIcon={<AltArrowLeft className="size-4" />}
            onClick={() => navigate('/app')}
            className="mt-2"
          >
            Back to home
          </Button>

        </div>
      </div>

    </div>
  );
}
