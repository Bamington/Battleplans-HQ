/**
 * ProfilePage.tsx — the full profile page at /@username, in every app.
 *
 * Open to anyone. Signed out, it shows the public profile (avatar, @username)
 * from get_public_profile with "Sign in to add as a friend". Signed in, it
 * works out the relationship like the modal does — so a friend sees their
 * name and Favourite Games, and anyone else gets the friend-request buttons.
 * The body is the modal's own ProfileView, so the two never drift apart.
 *
 * The same /@name can instead belong to a venue or club (locations.slug shares
 * the namespace with user handles), in which case the page shows
 * LocationProfileView. Both lookups run together; a user would win, though the
 * database never lets the two collide.
 *
 * Mounted on the route "/:profile": React Router can't match "/@:handle" (a
 * dynamic segment must be the whole segment), so a path that doesn't start
 * with @ is sent home rather than treated as a username.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase, appendSessionToUrl } from '../lib/supabase';
import { avatarUrl as toAvatarUrl } from '../lib/avatars';
import { useFriends } from '../hooks/useFriends';
import { useCurrentApp } from '../lib/currentApp';
import { ProfileView, profilePath, type FriendProfileState } from './FriendProfileModal';
import LocationProfileView, { type LocationProfile } from './LocationProfileView';
import ProfileSections from '../bench/ProfileSections';
import Button from './Button';

/** Where the other apps live, for links out of one that isn't them. */
const BATTLEPLAN_URL = 'https://battleplan.app';
const BATTLEPACK_URL = 'https://battlepack.app';

interface PublicProfile { id: string; handle: string; avatar_path: string | null }

export interface ProfilePageProps {
  /** Shown in the header, e.g. "BattleBench". */
  appName: string;
  /** Resolve a game slug to an icon URL, for Favourite Games. */
  resolveGameIcon?: (slug: string) => string | undefined;
  /** The route param holding "@handle". Default "profile"; BattlePack shares
   *  its root with pack slugs, so it mounts this under "/:slug". */
  param?: string;
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

export default function ProfilePage({ appName, resolveGameIcon, param = 'profile' }: ProfilePageProps) {
  const segment = useParams()[param] ?? '';
  const navigate = useNavigate();
  // React Router numbers its own history entries; idx 0 means this page was
  // the first thing opened in the tab.
  const closeProfile = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/app');
  };
  const isProfile = segment.startsWith('@') && segment.length > 1;
  const handle = segment.slice(1);

  // undefined = loading, null = no such user / location
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [place, setPlace] = useState<LocationProfile | null | undefined>(undefined);
  const [myId, setMyId] = useState<string | null | undefined>(undefined);
  const app = useCurrentApp();

  useEffect(() => {
    if (!isProfile) return;
    let cancelled = false;
    setProfile(undefined);
    setPlace(undefined);
    supabase.rpc('get_public_profile', { p_handle: handle })
      .then(({ data }) => { if (!cancelled) setProfile((data as PublicProfile | null) ?? null); });
    // An error (the function not deployed yet, say) reads as "no such place".
    supabase.rpc('get_location_profile', { p_handle: handle })
      .then(({ data }) => { if (!cancelled) setPlace((data as LocationProfile | null) ?? null); });
    supabase.auth.getSession()
      .then(({ data }) => { if (!cancelled) setMyId(data.session?.user?.id ?? null); });
    return () => { cancelled = true; };
  }, [isProfile, handle]);

  useEffect(() => {
    document.title = profile ? `@${profile.handle} — ${appName}`
      : place ? `${place.location.name} — ${appName}`
      : appName;
    return () => { document.title = appName; };
  }, [profile, place, appName]);

  // A changed-case address (/@Bam) settles on the stored spelling.
  useEffect(() => {
    if (profile && profile.handle !== handle) navigate(profilePath(profile.handle), { replace: true });
    else if (!profile && place && place.location.slug !== handle) navigate(profilePath(place.location.slug), { replace: true });
  }, [profile, place, handle, navigate]);

  /** A BattlePlan path: in-app when this is BattlePlan, otherwise across to it
   *  with a sign-in hand-off. Signed out, by way of its login page. */
  const openInBattleplan = async (path: string) => {
    const target = myId ? path : `/login?next=${encodeURIComponent(path)}`;
    if (app === 'battleplan') { navigate(target); return; }
    window.location.href = await appendSessionToUrl(`${BATTLEPLAN_URL}${target}`);
  };
  const eventHref = (slug: string) => app === 'battlepack' ? `/${slug}` : `${BATTLEPACK_URL}/${slug}`;

  // Still settling which of the two this name is.
  const loading = profile === undefined || myId === undefined || (profile === null && place === undefined);

  if (!isProfile) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh bg-neutral-950 flex flex-col">
      <header className="h-14 px-4 border-b border-neutral-800 flex items-center justify-between">
        <Link to="/" className="font-heading text-white text-base tracking-wide">{appName}</Link>
        {myId ? (
          // Signed in, a profile is somewhere you visited from the app (the user
          // menu, a booking, a friend), so close it back to where you were.
          // Arriving cold — a shared link, a refresh — there is nowhere to go
          // back to, so it closes to the app's home instead.
          <Button size="xs" variant="outline" color="secondary" onClick={closeProfile}>
            Close Profile
          </Button>
        ) : myId === null && (
          <Link to="/login" className="font-body text-sm text-primary-400 hover:text-primary-300">
            Sign in
          </Link>
        )}
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
        {loading ? (
          <p className="py-16 text-center font-body text-sm text-neutral-400">Loading…</p>
        ) : !profile && place ? (
          <LocationProfileView
            profile={place}
            eventHref={eventHref}
            placeHref={slug => `/@${slug}`}
            onBook={() => openInBattleplan(`/app?book=${place.location.id}`)}
            onBookDate={myId ? date => openInBattleplan(`/app?book=${place.location.id}&date=${date}`) : undefined}
            onManage={() => openInBattleplan(`/app/manage-store?venue=${place.location.id}`)}
          />
        ) : !profile ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <h1 className="font-heading text-2xl text-white">No one goes by @{handle}</h1>
            <p className="font-body text-sm text-neutral-400 max-w-sm">
              They may have changed their username, or the link has a typo.
            </p>
          </div>
        ) : (
          <>
          <article className="w-full max-w-md mx-auto bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
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
          {/* Painting and gameplay sections — whichever this viewer may see. */}
          <ProfileSections userId={profile.id} />
          </>
        )}
      </main>
    </div>
  );
}
