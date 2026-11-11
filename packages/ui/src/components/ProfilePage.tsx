/**
 * ProfilePage.tsx — the full profile page at /@username, in every app.
 *
 * Open to anyone. Signed out, it shows the public profile (avatar, @username)
 * from get_public_profile with "Sign in to add as a friend". Signed in, it
 * works out the relationship like the modal does — so a friend sees their
 * name and Favourite Games, and anyone else gets the friend-request buttons.
 * The body is the modal's own ProfileView, so the two never drift apart.
 *
 * Mounted on the route "/:profile": React Router can't match "/@:handle" (a
 * dynamic segment must be the whole segment), so a path that doesn't start
 * with @ is sent home rather than treated as a username.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { avatarUrl as toAvatarUrl } from '../lib/avatars';
import { useFriends } from '../hooks/useFriends';
import { ProfileView, profilePath, type FriendProfileState } from './FriendProfileModal';

interface PublicProfile { id: string; handle: string; avatar_path: string | null }

export interface ProfilePageProps {
  /** Shown in the header, e.g. "BattleBench". */
  appName: string;
  /** Resolve a game slug to an icon URL, for Favourite Games. */
  resolveGameIcon?: (slug: string) => string | undefined;
}

/** Signed in: the relationship, and the actions on it, from useFriends. */
function SignedInProfile({ profile, myId, resolveGameIcon }: { profile: PublicProfile; myId: string; resolveGameIcon?: ProfilePageProps['resolveGameIcon'] }) {
  const { friends, incoming, outgoing, busy, error, sendRequest, respond, remove } = useFriends();
  const state = useMemo<FriendProfileState>(() => {
    if (profile.id === myId) return { kind: 'self' };
    const f = friends.find(x => x.id === profile.id);
    if (f) return { kind: 'friends', friendshipId: f.friendshipId, username: f.username };
    const inc = incoming.find(x => x.id === profile.id);
    if (inc) return { kind: 'incoming', friendshipId: inc.friendshipId };
    const out = outgoing.find(x => x.id === profile.id);
    if (out) return { kind: 'outgoing', friendshipId: out.friendshipId };
    return { kind: 'none' };
  }, [profile.id, myId, friends, incoming, outgoing]);
  const friendshipId = 'friendshipId' in state ? state.friendshipId : null;

  return (
    <ProfileView
      size="page"
      userId={profile.id}
      handle={profile.handle}
      avatarUrl={toAvatarUrl(profile.avatar_path)}
      state={state}
      resolveGameIcon={resolveGameIcon}
      busy={busy}
      error={error}
      onSendRequest={() => sendRequest(profile.handle)}
      onRespond={accept => { if (friendshipId) respond(friendshipId, accept); }}
      onWithdraw={() => { if (friendshipId) remove(friendshipId); }}
    />
  );
}

export default function ProfilePage({ appName, resolveGameIcon }: ProfilePageProps) {
  const { profile: segment = '' } = useParams();
  const navigate = useNavigate();
  const isProfile = segment.startsWith('@') && segment.length > 1;
  const handle = segment.slice(1);

  // undefined = loading, null = no such user
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [myId, setMyId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isProfile) return;
    let cancelled = false;
    setProfile(undefined);
    supabase.rpc('get_public_profile', { p_handle: handle })
      .then(({ data }) => { if (!cancelled) setProfile((data as PublicProfile | null) ?? null); });
    supabase.auth.getSession()
      .then(({ data }) => { if (!cancelled) setMyId(data.session?.user?.id ?? null); });
    return () => { cancelled = true; };
  }, [isProfile, handle]);

  useEffect(() => {
    document.title = profile ? `@${profile.handle} — ${appName}` : appName;
    return () => { document.title = appName; };
  }, [profile, appName]);

  // A changed-case address (/@Bam) settles on the stored spelling.
  useEffect(() => {
    if (profile && profile.handle !== handle) navigate(profilePath(profile.handle), { replace: true });
  }, [profile, handle, navigate]);

  if (!isProfile) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh bg-neutral-950 flex flex-col">
      <header className="h-14 px-4 border-b border-neutral-800 flex items-center justify-between">
        <Link to="/" className="font-heading text-white text-base tracking-wide">{appName}</Link>
        {myId !== undefined && (
          <Link to={myId ? '/app' : '/login'} className="font-body text-sm text-primary-400 hover:text-primary-300">
            {myId ? `Open ${appName}` : 'Sign in'}
          </Link>
        )}
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-8">
        {profile === undefined || myId === undefined ? (
          <p className="py-16 text-center font-body text-sm text-neutral-400">Loading…</p>
        ) : profile === null ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <h1 className="font-heading text-2xl text-white">No one goes by @{handle}</h1>
            <p className="font-body text-sm text-neutral-400 max-w-sm">
              They may have changed their username, or the link has a typo.
            </p>
          </div>
        ) : (
          <article className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
            {myId ? (
              <SignedInProfile profile={profile} myId={myId} resolveGameIcon={resolveGameIcon} />
            ) : (
              <ProfileView
                size="page"
                handle={profile.handle}
                avatarUrl={toAvatarUrl(profile.avatar_path)}
                state={{ kind: 'signedOut' }}
                onSignIn={() => navigate(`/login?next=${encodeURIComponent(profilePath(profile.handle))}`)}
              />
            )}
          </article>
        )}
      </main>
    </div>
  );
}
