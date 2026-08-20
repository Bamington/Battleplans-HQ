/**
 * SharedSections.tsx — Gallery demos for every component in @battleplans/ui
 *
 * These are the components all three apps share, so their demos live here
 * rather than in any one app's gallery. Each app's /gallery renders
 * <SharedGallerySections /> and then appends its own local sections.
 *
 * ADDING A COMPONENT: when you add a component to packages/ui, add a
 * <GallerySection> for it here showing every meaningful variant and state, and
 * add a matching entry to SHARED_GALLERY_NAV so it appears in the sidebar.
 *
 * Demos are self-contained: anything that would normally fetch is either driven
 * by local state or stubbed, and noted as such, so the gallery renders without a
 * session wherever that is possible.
 *
 * DELIBERATELY NOT DEMOED HERE — everything else in components/ is:
 *   • AdminRoute, AppAccessRoute, ProtectedRoute — route guards. They render
 *     their children or redirect; there is no visual to review.
 *   • AuthCallback, ResetPassword — whole-page auth screens that own a route
 *     each, closer to a page than a component. Review them at /auth/*.
 *   • Navbar — every app wraps it (AppNavbar) to supply its own breadcrumbs and
 *     accent, so each app's gallery demos its own wrapper instead. Demoing the
 *     bare Navbar here would show a configuration no app actually ships.
 *   • ProfileModal — self-fetches the signed-in user, so it cannot render
 *     truthfully without a session. Its presentational half, ProfileFields, is
 *     demoed under "Profile Modal" instead.
 */

import React, { useState } from 'react';
import { GallerySection, GalleryNote, type GalleryNavItem } from './GalleryShell';
import { RAW_PALETTE, SEMANTIC_PALETTE, type ColorFamily } from './colors';
import { setImpersonatedRole } from '../lib/impersonation';
import heroImage from '../assets/hero.png';
import logoBloodBowl from '../assets/games/logos/logo-blood-bowl.png';
import logoHaloFlashpoint from '../assets/games/logos/logo-halo-flashpoint.png';
import AddFriendModal from '../components/AddFriendModal';
import AppFooter from '../components/AppFooter';
import Avatar, { AvatarGroup } from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';
import BannerPicker from '../components/BannerPicker';
import PanelSection from '../components/PanelSection';
import EditableListItem from '../components/EditableListItem';
import type { PendingBanner } from '../components/BannerPicker';
import Badge from '../components/Badge';
import Banner from '../components/Banner';
import BuilderShell from '../components/BuilderShell';
import Button from '../components/Button';
import ButtonPair from '../components/ButtonPair';
import Callout from '../components/Callout';
import Card, { CardBody, CardImage } from '../components/Card';
import Checkbox from '../components/Checkbox';
import { ColumnShell, PaginatedColumn, ScrollColumn } from '../components/Column';
import ColumnHeader from '../components/ColumnHeader';
import Counter from '../components/Counter';
import Dropdown, { DropdownDivider, DropdownHeader, DropdownItem } from '../components/Dropdown';
import EditorPanel from '../components/EditorPanel';
import FriendProfileModal from '../components/FriendProfileModal';
import type { FriendProfileState } from '../components/FriendProfileModal';
import FriendsColumn from '../components/FriendsColumn';
import HR from '../components/HR';
import ImpersonationBanner from '../components/ImpersonationBanner';
import Input from '../components/Input';
import Lightbox from '../components/Lightbox';
import List from '../components/List';
import ListPanel from '../components/ListPanel';
import MarkdownBody from '../components/MarkdownBody';
import Modal from '../components/Modal';
import ModeToggle from '../components/ModeToggle';
import type { Mode } from '../components/ModeToggle';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import Notebook from '../icons/Notebook';
import Pagination from '../components/Pagination';
import PickerTile from '../components/PickerTile';
import { HandleLink, ProfileModalProvider } from '../components/ProfileModalProvider';
import RichTextEditor from '../components/RichTextEditor';
import SearchSelect from '../components/SearchSelect';
import type { SearchSelectOption } from '../components/SearchSelect';
import Select from '../components/Select';
import SelectableListItem from '../components/SelectableListItem';
import Sheet from '../components/Sheet';
import Sidebar from '../components/Sidebar';
import StarRating from '../components/StarRating';
import StepProgress from '../components/StepProgress';
import Tabs from '../components/Tabs';
import Text from '../components/Text';
import TextLink from '../components/TextLink';
import UpdateModal from '../components/UpdateModal';
import VR from '../components/VR';
import { ProfileFields, WelcomeModalView } from '../components/WelcomeModal';
import AddCircle from '../icons/AddCircle';
import AltArrowDown from '../icons/AltArrowDown';
import AltArrowLeft from '../icons/AltArrowLeft';
import AltArrowRight from '../icons/AltArrowRight';
import AltArrowUp from '../icons/AltArrowUp';
import ArrowDown from '../icons/ArrowDown';
import ArrowLeft from '../icons/ArrowLeft';
import ArrowRight from '../icons/ArrowRight';
import ArrowUp from '../icons/ArrowUp';
import Bell from '../icons/Bell';
import BellBing from '../icons/BellBing';
import Bookmark from '../icons/Bookmark';
import CheckCircle from '../icons/CheckCircle';
import Clipboard from '../icons/Clipboard';
import CloseCircle from '../icons/CloseCircle';
import DangerCircle from '../icons/DangerCircle';
import Diskette from '../icons/Diskette';
import DownloadMinimalistic from '../icons/DownloadMinimalistic';
import ExternalLink from '../icons/ExternalLink';
import Eye from '../icons/Eye';
import EyeClosed from '../icons/EyeClosed';
import FileText from '../icons/FileText';
import Filter from '../icons/Filter';
import Flag from '../icons/Flag';
import Folder from '../icons/Folder';
import Gallery from '../icons/Gallery';
import Heart from '../icons/Heart';
import Home from '../icons/Home';
import Inbox from '../icons/Inbox';
import InfoCircle from '../icons/InfoCircle';
import Letter from '../icons/Letter';
import ListCheck from '../icons/ListCheck';
import Lock from '../icons/Lock';
import LockUnlocked from '../icons/LockUnlocked';
import Magnifer from '../icons/Magnifer';
import MenuDots from '../icons/MenuDots';
import Microphone from '../icons/Microphone';
import MinusCircle from '../icons/MinusCircle';
import Moon from '../icons/Moon';
import Pause from '../icons/Pause';
import Pen2 from '../icons/Pen2';
import Play from '../icons/Play';
import QuestionCircle from '../icons/QuestionCircle';
import Rocket from '../icons/Rocket';
import Settings from '../icons/Settings';
import Share from '../icons/Share';
import Shield from '../icons/Shield';
import Star from '../icons/Star';
import Stop from '../icons/Stop';
import Sun from '../icons/Sun';
import TrashBinMinimalistic from '../icons/TrashBinMinimalistic';
import UploadMinimalistic from '../icons/UploadMinimalistic';
import UserCircle from '../icons/UserCircle';
import UserPlusRounded from '../icons/UserPlusRounded';
import UserRounded from '../icons/UserRounded';
import UsersGroupRounded from '../icons/UsersGroupRounded';
import Videocamera from '../icons/Videocamera';
import Widget2 from '../icons/Widget2';
import AddCircleBold from '../icons/bold/AddCircle';
import BellBold from '../icons/bold/Bell';
import BellBingBold from '../icons/bold/BellBing';
import BookmarkBold from '../icons/bold/Bookmark';
import CheckCircleBold from '../icons/bold/CheckCircle';
import ClipboardBold from '../icons/bold/Clipboard';
import CloseCircleBold from '../icons/bold/CloseCircle';
import DangerCircleBold from '../icons/bold/DangerCircle';
import DisketteBold from '../icons/bold/Diskette';
import DownloadMinimalisticBold from '../icons/bold/DownloadMinimalistic';
import ExternalLinkBold from '../icons/bold/ExternalLink';
import EyeBold from '../icons/bold/Eye';
import EyeClosedBold from '../icons/bold/EyeClosed';
import FileTextBold from '../icons/bold/FileText';
import FilterBold from '../icons/bold/Filter';
import FlagBold from '../icons/bold/Flag';
import FolderBold from '../icons/bold/Folder';
import GalleryBold from '../icons/bold/Gallery';
import HeartBold from '../icons/bold/Heart';
import HomeBold from '../icons/bold/Home';
import InboxBold from '../icons/bold/Inbox';
import InfoCircleBold from '../icons/bold/InfoCircle';
import LetterBold from '../icons/bold/Letter';
import ListCheckBold from '../icons/bold/ListCheck';
import LockBold from '../icons/bold/Lock';
import LockUnlockedBold from '../icons/bold/LockUnlocked';
import MagniferBold from '../icons/bold/Magnifer';
import MenuDotsBold from '../icons/bold/MenuDots';
import MicrophoneBold from '../icons/bold/Microphone';
import MinusCircleBold from '../icons/bold/MinusCircle';
import MoonBold from '../icons/bold/Moon';
import PauseBold from '../icons/bold/Pause';
import Pen2Bold from '../icons/bold/Pen2';
import PlayBold from '../icons/bold/Play';
import QuestionCircleBold from '../icons/bold/QuestionCircle';
import RocketBold from '../icons/bold/Rocket';
import SettingsBold from '../icons/bold/Settings';
import ShareBold from '../icons/bold/Share';
import ShieldBold from '../icons/bold/Shield';
import StarBold from '../icons/bold/Star';
import StopBold from '../icons/bold/Stop';
import SunBold from '../icons/bold/Sun';
import TrashBinMinimalisticBold from '../icons/bold/TrashBinMinimalistic';
import UploadMinimalisticBold from '../icons/bold/UploadMinimalistic';
import UserCircleBold from '../icons/bold/UserCircle';
import UserPlusRoundedBold from '../icons/bold/UserPlusRounded';
import UserRoundedBold from '../icons/bold/UserRounded';
import UsersGroupRoundedBold from '../icons/bold/UsersGroupRounded';
import VideocameraBold from '../icons/bold/Videocamera';
import Widget2Bold from '../icons/bold/Widget2';

/** A real release note, used to demo markdown rendering + clamping. */
const MARKDOWN_SAMPLE = [
  '**Features**',
  '- You can now display the model images in a collection as their cover.',
  '- Sort models alphabetically, by painted status, or by date added.',
  '',
  '**Bug Fixes**',
  '- Fixed an issue where only 10 collections would show.',
].join('\n');

const MULTI_OPTIONS = ['Agility', 'General', 'Mutations', 'Passing', 'Strength', 'Devious'];

// ── InteractiveStarDemo ───────────────────────────────────────────────────────

const InteractiveStarDemo = () => {
  const [rating, setRating] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <StarRating rating={rating} interactive onChange={setRating} size="lg" />
      <span className="font-body text-sm text-gray-500 dark:text-gray-400">
        {rating > 0 ? `${rating} / 5` : 'Click to rate'}
      </span>
      {rating > 0 && (
        <button
          onClick={() => setRating(0)}
          className="font-body text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
        >
          Reset
        </button>
      )}
    </div>
  );
};

// ── DismissibleBadgeDemo ──────────────────────────────────────────────────────

const DISMISSIBLE_BADGES: { id: number; color: React.ComponentProps<typeof Badge>['color']; label: string }[] = [
  { id: 1, color: 'primary', label: 'Frontend' },
  { id: 2, color: 'success', label: 'Ready' },
  { id: 3, color: 'danger',  label: 'Blocker' },
  { id: 4, color: 'warning', label: 'Review' },
  { id: 5, color: 'purple',  label: 'Legendary' },
];

const DismissibleBadgeDemo = () => {
  const [visible, setVisible] = useState<number[]>(DISMISSIBLE_BADGES.map((b) => b.id));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DISMISSIBLE_BADGES.filter((b) => visible.includes(b.id)).map((b) => (
        <Badge
          key={b.id}
          color={b.color}
          onDismiss={() => setVisible((v) => v.filter((id) => id !== b.id))}
        >
          {b.label}
        </Badge>
      ))}
      {visible.length < DISMISSIBLE_BADGES.length && (
        <button
          onClick={() => setVisible(DISMISSIBLE_BADGES.map((b) => b.id))}
          className="font-body text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 underline"
        >
          Reset
        </button>
      )}
    </div>
  );
};

// ── FriendsModalsGalleryDemo ─────────────────────────────────────────────────

/** The two presentational friends dialogs. Both take explicit props, so they
 *  demo without a session — unlike FriendsColumn, which fetches its own data
 *  and is therefore only meaningful inside a signed-in app.
 *
 *  Note the profile modal shows the real name ONLY in the "friends" state: a
 *  name is private until the request is accepted. */
const FriendsModalsGalleryDemo = () => {
  const [addOpen, setAddOpen] = useState(false);
  const [profile, setProfile] = useState<null | FriendProfileState>(null);

  const STATES: { label: string; state: FriendProfileState }[] = [
    { label: 'Not connected',   state: { kind: 'none' } },
    { label: 'Request sent',    state: { kind: 'outgoing', friendshipId: 'demo' } },
    { label: 'Request received', state: { kind: 'incoming', friendshipId: 'demo' } },
    { label: 'Friends',         state: { kind: 'friends', friendshipId: 'demo', username: 'Bam Harrison' } },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => setAddOpen(true)}>Add Friend modal</Button>
      {STATES.map(s => (
        <Button key={s.label} variant="outline" color="secondary" onClick={() => setProfile(s.state)}>
          Profile — {s.label}
        </Button>
      ))}
      <GalleryNote>
        The Add Friend CTA enables on a valid username format only — it never checks
        whether the user exists, which would leak who has an account. The Friends
        state loads a friend’s top games, which appear only in a signed-in app with
        an accepted friend.
      </GalleryNote>

      <AddFriendModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSend={async () => { setAddOpen(false); return true; }}
      />

      <FriendProfileModal
        open={profile !== null}
        onClose={() => setProfile(null)}
        handle="bamington"
        state={profile ?? { kind: 'none' }}
        onSendRequest={() => setProfile(null)}
        onRespond={() => setProfile(null)}
        onWithdraw={() => setProfile(null)}
      />
    </div>
  );
};

// ── WelcomeModalGalleryDemo ──────────────────────────────────────────────────

/** Presentational preview of the onboarding WelcomeModalView. The real
 *  WelcomeModal self-fetches the signed-in user's profile and blocks until the
 *  required fields are saved; here we drive it with local state and mock
 *  locations, and "Continue" just closes it. Toggles between the BattleCards
 *  (name only) and BattlePlan (name + preferred location) field sets.
 *
 *  Note "Your Name" is the `username` column and "Username" is the `handle`
 *  column — the two cross over between code and interface. */
const WelcomeModalGalleryDemo = () => {
  const [variant,    setVariant]    = useState<null | 'cards' | 'plan'>(null);
  const [username,   setUsername]   = useState('Chris');
  const [locationId, setLocationId] = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [avatar,     setAvatar]     = useState<Blob | null | undefined>(undefined);
  const [handle,     setHandle]     = useState('');

  const MOCK_LOCATIONS = [
    { id: 'loc-1', name: 'Battleground North' },
    { id: 'loc-2', name: 'Battleground South' },
  ];

  function handleSave() {
    if (!username.trim()) { setError('Please enter your name.'); return; }
    if (variant === 'plan' && !locationId) { setError('Please select a preferred location.'); return; }
    setError(null);
    setVariant(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => { setError(null); setVariant('cards'); }}>
        BattleCards variant
      </Button>
      <Button variant="outline" color="secondary" onClick={() => { setError(null); setVariant('plan'); }}>
        BattlePlan variant
      </Button>
      <GalleryNote>
        Blocking in-app; here "Continue" closes it. The picture is optional and
        never blocks Continue.
        {avatar instanceof Blob && ` Picked: ${Math.round(avatar.size / 1024)} KB.`}
      </GalleryNote>
      {variant && (
        <WelcomeModalView
          appName={variant === 'plan' ? 'BattlePlan' : 'BattleCards'}
          showAvatar
          avatarInitials="CH"
          onAvatarChange={setAvatar}
          showUsername
          showPreferredLocation={variant === 'plan'}
          showBookingEmailNote={variant === 'plan'}
          showHandle
          handle={handle}
          onHandleChange={setHandle}
          username={username}
          onUsernameChange={setUsername}
          preferredLocationId={locationId}
          onPreferredLocationChange={setLocationId}
          locations={MOCK_LOCATIONS}
          saving={false}
          error={error}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

// ── ProfileModalGalleryDemo ──────────────────────────────────────────────────

/** Presentational preview of the "Your Profile" modal (opened from the navbar
 *  avatar menu). The real ProfileModal self-fetches the signed-in user's
 *  profile; here we drive it with local state and mock locations. Toggles
 *  between the username-only view and the username + preferred-location view
 *  (the location field only appears for users who have ever picked one). */
const ProfileModalGalleryDemo = () => {
  const [variant,    setVariant]    = useState<null | 'username' | 'full'>(null);
  const [username,   setUsername]   = useState('Chris');
  const [handle,     setHandle]     = useState('chris-h');
  const [locationId, setLocationId] = useState('loc-1');
  const [error,      setError]      = useState<string | null>(null);

  const MOCK_LOCATIONS = [
    { id: 'loc-1', name: 'Battleground North' },
    { id: 'loc-2', name: 'Battleground South' },
  ];

  function handleSave() {
    if (!username.trim()) { setError('Please enter your name.'); return; }
    if (variant === 'full' && !locationId) { setError('Please select a preferred location.'); return; }
    setError(null);
    setVariant(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => { setError(null); setVariant('username'); }}>Name only</Button>
      <Button variant="outline" color="secondary" onClick={() => { setError(null); setVariant('full'); }}>
        With preferred location
      </Button>
      {variant && (
        <Modal open onClose={() => setVariant(null)} className="max-w-md">
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-heading text-white text-[19.8px] leading-7 tracking-[-0.5px]">Your profile</h1>
              <p className="font-body text-base text-gray-300 leading-6">Update your account details.</p>
            </div>
            <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
              <ProfileFields
                showUsername
                showPreferredLocation={variant === 'full'}
                username={username}
                onUsernameChange={setUsername}
                showHandle
                handle={handle}
                onHandleChange={setHandle}
                preferredLocationId={locationId}
                onPreferredLocationChange={setLocationId}
                locations={MOCK_LOCATIONS}
                error={error}
              />
              <div className="flex gap-3">
                <Button type="button" variant="outline" color="secondary" className="flex-1" onClick={() => setVariant(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">Save</Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── UpdateModalGalleryDemo ───────────────────────────────────────────────────

/** Live UpdateModal preview — the full release note opened from the
 *  "News & Updates" panel. The body is markdown, rendered with react-markdown;
 *  the metadata line combines version, publish date and the snapshotted author. */
const UpdateModalGalleryDemo = () => {
  const [open, setOpen] = useState(false);

  const MOCK_UPDATE = {
    id: 'demo',
    title: 'Collection Covers',
    version: '1.09.0',
    published_by_name: 'Chris Harrison',
    published_at: '2025-09-22T12:56:41.455Z',
    body: MARKDOWN_SAMPLE,
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => setOpen(true)}>Open Update Modal</Button>
      <GalleryNote>
        Markdown body (bold headings + bullets) rendered with react-markdown.
      </GalleryNote>
      <UpdateModal open={open} onClose={() => setOpen(false)} update={MOCK_UPDATE} />
    </div>
  );
};

// ── PaginationGalleryDemo ────────────────────────────────────────────────────

/** Pager used at the bottom of the home-screen columns. Pages are 0-based and
 *  the component renders nothing at one page. Page counts come from the space
 *  available (useAutoPageSize), so beyond 5 pages the numbered buttons become a
 *  window that slides around the current page rather than overflowing. */
const PaginationGalleryDemo = () => {
  const [few,  setFew]  = useState(0);
  const [many, setMany] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-body text-xs text-gray-400 dark:text-gray-500">
          Few pages (≤ 5) — every page shown. Page {few + 1} of 3
        </p>
        <Pagination page={few} totalPages={3} onPage={setFew} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-body text-xs text-gray-400 dark:text-gray-500">
          Many pages (&gt; 5) — sliding window of 5. Page {many + 1} of 12
        </p>
        <Pagination page={many} totalPages={12} onPage={setMany} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-body text-xs text-gray-400 dark:text-gray-500">
          Single page — renders nothing
        </p>
        <Pagination page={0} totalPages={1} onPage={() => {}} />
      </div>
    </div>
  );
};

// ── IconGrid ──────────────────────────────────────────────────────────────────

/**
 * IconGrid — Displays a grid of icon previews.
 *
 * Each cell shows:
 * - The outline variant on the left
 * - The solid variant on the right (or a dash if no solid exists)
 * - The icon's import name below
 *
 * Used only in the gallery — not a reusable app component.
 *
 * The entries below are written as bare <Home /> etc. with no className. Every
 * icon renders an <svg> with a viewBox and no intrinsic width/height, so an
 * unsized one collapses to 0x0 and the whole grid reads as labels with nothing
 * above them. Rather than repeat a size on ~200 call sites, the cell sizes any
 * svg it is handed.
 */
interface IconEntry {
  name: string;
  outline: React.ReactNode;
  /** Pass null if no solid variant exists for this icon */
  solid: React.ReactNode | null;
}

/** Sizes whatever svg it wraps — see the note above. */
const ICON_SLOT = '[&>svg]:w-6 [&>svg]:h-6';

const IconGrid = ({ icons }: { icons: IconEntry[] }) => (
  <div className="w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
    {icons.map(({ name, outline, solid }) => (
      <div
        key={name}
        className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gray-100 dark:bg-gray-900"
      >
        {/* Outline + Solid side by side */}
        <div className="flex items-center gap-3 text-gray-900 dark:text-white">
          {/* Outline variant */}
          <div title="outline" className={ICON_SLOT}>{outline}</div>
          {/* Solid variant — greyed out dash if unavailable */}
          <div
            title={solid ? 'solid' : 'no solid variant'}
            className={`${ICON_SLOT} ${solid ? '' : 'text-gray-300 dark:text-gray-700'}`.trim()}
          >
            {solid ?? '—'}
          </div>
        </div>
        {/* Icon name */}
        <span className="font-body text-xs text-center text-gray-500 dark:text-gray-400 leading-tight break-all">
          {name}
        </span>
      </div>
    ))}
  </div>
);

// ── ColorRow ──────────────────────────────────────────────────────────────────

/**
 * ColorRow — Displays a single color family as a horizontal strip of swatches.
 *
 * Each swatch shows:
 * - The color as a filled block (via inline style)
 * - The shade number (50 → 900)
 * - The hex value
 *
 * Used only in the gallery — not a reusable app component.
 */
const ColorRow = ({ family }: { family: ColorFamily }) => (
  <div>
    {/* Family name + example class */}
    <div className="flex items-baseline gap-3 mb-2">
      <span className="font-body text-sm font-semibold text-gray-900 dark:text-white">
        {family.name}
      </span>
      <span className="font-body text-xs text-gray-400 dark:text-gray-500">
        bg-{family.prefix}-500
      </span>
    </div>

    {/* Swatch strip */}
    <div className="flex rounded-lg overflow-hidden">
      {family.shades.map(({ shade, hex, darkText }) => (
        <div
          key={shade}
          className="flex-1 flex flex-col items-center justify-end py-2 gap-0.5"
          style={{ backgroundColor: hex }}
        >
          {/* Shade number */}
          <span
            className={`font-body text-xs font-medium ${
              darkText ? 'text-gray-900' : 'text-white'
            }`}
          >
            {shade}
          </span>
          {/* Hex value */}
          <span
            className={`font-body text-xs ${
              darkText ? 'text-gray-600' : 'text-white/70'
            }`}
          >
            {hex}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ── Demo data for the column components ──────────────────────────────────────

/** Twenty rows, so PaginatedColumn actually pages and ScrollColumn scrolls. */
const DEMO_ROWS = Array.from({ length: 20 }, (_, i) => ({
  id: `row-${i + 1}`,
  name: `Battle ${i + 1}`,
  detail: i % 2 === 0 ? 'Blood Bowl · Battleground North' : 'Kill Team · Battleground South',
}));

const DemoRow = ({ name, detail }: { name: string; detail: string }) => (
  <div className="flex items-center gap-3 rounded-lg bg-gray-100 dark:bg-gray-900 px-3 py-2">
    <Shield className="w-5 h-5 text-primary-500 shrink-0" />
    <div className="min-w-0">
      <p className="font-body text-sm text-gray-900 dark:text-white truncate">{name}</p>
      <p className="font-body text-xs text-gray-500 dark:text-gray-400 truncate">{detail}</p>
    </div>
  </div>
);

// ── SearchSelectGalleryDemo ──────────────────────────────────────────────────

/** Searchable dropdown with per-option icons. Options carry an icon that is
 *  echoed in the closed trigger, and `separatorBefore` groups "recently used"
 *  above the rest — a grouping that is suppressed while searching, because it no
 *  longer describes what is on screen. `multiple` switches value/onChange to
 *  arrays; the two shapes are discriminated so they stay correctly typed. */
const SearchSelectGalleryDemo = () => {
  const [game,  setGame]  = useState('');
  const [games, setGames] = useState<string[]>(['bb', 'kt']);

  const OPTIONS: SearchSelectOption[] = [
    { value: 'bb',    label: 'Blood Bowl',        icon: <img src={logoBloodBowl} alt="" className="size-6 rounded object-contain" /> },
    { value: 'halo',  label: 'Halo: Flashpoint',  icon: <img src={logoHaloFlashpoint} alt="" className="size-6 rounded object-contain" /> },
    { value: 'kt',    label: 'Kill Team',         icon: <Shield className="size-6 text-primary-500" />, separatorBefore: true },
    { value: 'sc',    label: 'StarCraft',         icon: <Rocket className="size-6 text-primary-500" /> },
    { value: 'aos',   label: 'Age of Sigmar',     icon: <Flag className="size-6 text-primary-500" /> },
    { value: 'asoiaf', label: 'A Song of Ice and Fire', icon: <Flag className="size-6 text-primary-500" /> },
  ];

  return (
    <div className="w-full flex flex-wrap gap-6 items-start">
      <div className="w-64">
        <SearchSelect
          label="Game"
          placeholder="Choose Game"
          searchPlaceholder="Search games…"
          value={game}
          onChange={setGame}
          options={OPTIONS}
          helperText="Type to filter — the separator hides while searching."
        />
      </div>
      <div className="w-64">
        <SearchSelect
          label="Games"
          required
          multiple
          placeholder="Choose Games"
          searchPlaceholder="Search games…"
          value={games}
          onChange={setGames}
          options={OPTIONS}
          emptyLabel="No games match that search."
        />
      </div>
      <div className="w-64">
        <SearchSelect
          label="Game (disabled)"
          placeholder="Choose Game"
          value="bb"
          onChange={() => {}}
          options={OPTIONS}
          disabled
        />
      </div>
      <GalleryNote>
        Single: {game || '(none)'} · Multiple: {games.length ? games.join(', ') : '(none)'}.
        The panel floats above the trigger and flips upward when there is not enough
        room below.
      </GalleryNote>
    </div>
  );
};

// ── SheetGalleryDemo ─────────────────────────────────────────────────────────

/** Bottom action-sheet below lg, centred dialog at lg+. Resize across 1024px to
 *  see it switch. On mobile a downward swipe from the top of the content
 *  dismisses it; the grab handle is the affordance. */
const SheetGalleryDemo = () => {
  const [plain,  setPlain]  = useState(false);
  const [footer, setFooter] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => setPlain(true)}>Open Sheet</Button>
      <Button variant="outline" color="secondary" onClick={() => setFooter(true)}>
        Sheet with footer
      </Button>
      <GalleryNote>
        Below lg this slides up from the bottom with a grab handle and swipe-to-dismiss;
        at lg+ it is a centred dialog capped at 85vh, sized by the caller's max-w-* class.
      </GalleryNote>

      <Sheet open={plain} onClose={() => setPlain(false)} className="max-w-lg">
        <div className="p-5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <h2 className="font-heading text-xl text-gray-900 dark:text-white mb-2">Filter Models</h2>
          <p className="font-body text-sm text-gray-500 dark:text-gray-400 mb-4">
            Everything scrolls as one on mobile. This body is the "scroll everything
            on desktop too" layout described in Sheet.tsx.
          </p>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="py-2 border-b border-gray-200 dark:border-gray-800">
              <Checkbox label={`Option ${i + 1}`} checked={false} onChange={() => {}} />
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={footer}
        onClose={() => setFooter(false)}
        className="max-w-md"
        footer={
          <div className="p-4 flex gap-3">
            <Button variant="outline" color="secondary" className="flex-1" onClick={() => setFooter(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => setFooter(false)}>Apply</Button>
          </div>
        }
      >
        <div className="p-5 shrink-0">
          <h2 className="font-heading text-xl text-gray-900 dark:text-white mb-2">Pinned footer</h2>
          <p className="font-body text-sm text-gray-500 dark:text-gray-400">
            The footer sits outside the scrolling region, so the actions stay put.
          </p>
        </div>
      </Sheet>
    </div>
  );
};

// ── LightboxGalleryDemo ──────────────────────────────────────────────────────

/** Full-screen image viewer, portalled to <body>. Opens at startIndex and pages
 *  between images; pinch / double-tap / wheel zooms, and a downward drag
 *  dismisses. */
const LightboxGalleryDemo = () => {
  const [open,  setOpen]  = useState(false);
  const [start, setStart] = useState(0);

  const IMAGES = [heroImage, logoBloodBowl, logoHaloFlashpoint];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {IMAGES.map((src, i) => (
        <button
          key={i}
          onClick={() => { setStart(i); setOpen(true); }}
          className="w-28 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
        >
          <img src={src} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
      <GalleryNote>
        Click a thumbnail to open at that index. ← / → page, Esc closes, and on
        touch you can pinch to zoom or drag down to dismiss.
      </GalleryNote>
      <Lightbox
        open={open}
        onClose={() => setOpen(false)}
        images={IMAGES}
        startIndex={start}
        alt="Gallery demo image"
      />
    </div>
  );
};

// ── ImpersonationBannerGalleryDemo ───────────────────────────────────────────

/** The banner renders nothing unless an admin is previewing a lower access
 *  level, and it pins itself to the bottom of the viewport rather than sitting
 *  inline — so this demo drives the real impersonation state instead of faking
 *  a copy. It only does anything when you are signed in as an admin. */
const ImpersonationBannerGalleryDemo = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button onClick={() => setImpersonatedRole('user')}>View as Regular User</Button>
    <Button variant="outline" color="secondary" onClick={() => setImpersonatedRole('beta_tester')}>
      View as Beta Tester
    </Button>
    <Button variant="ghost" color="secondary" onClick={() => setImpersonatedRole(null)}>
      Stop
    </Button>
    <GalleryNote>
      This drives the real impersonation state, so the banner appears pinned to the
      bottom of the viewport — where it lives in production. Nothing happens unless
      you are signed in as an admin, since the banner keys off your effective role.
      "Stop" here and on the banner both clear it.
    </GalleryNote>
    <ImpersonationBanner />
  </div>
);

// ── HandleLinkGalleryDemo ────────────────────────────────────────────────────

/** An @handle that opens that user's profile. It needs a ProfileModalProvider
 *  above it to have somewhere to open, so the demo supplies one. Without a
 *  userId it renders as plain, unclickable text — the state used wherever we
 *  only know the handle. */
const HandleLinkGalleryDemo = () => (
  <ProfileModalProvider>
    <div className="w-full flex flex-col gap-3">
      <p className="font-body text-sm text-gray-900 dark:text-white">
        Booked by <HandleLink userId="00000000-0000-0000-0000-000000000000" handle="bamington" /> at Battleground North.
      </p>
      <h3 className="font-heading text-xl text-gray-900 dark:text-white">
        Inside a heading: <HandleLink userId="00000000-0000-0000-0000-000000000000" handle="bamington" />
      </h3>
      <p className="font-body text-sm text-gray-900 dark:text-white">
        Unlinked (no userId): <HandleLink handle="someone" />
      </p>
      <GalleryNote>
        It inherits the surrounding font so it sits inside a heading cleanly, and
        stops click propagation so it works inside a clickable card. The stub id
        here opens the profile modal onto a user that does not exist.
      </GalleryNote>
    </div>
  </ProfileModalProvider>
);

// ── PickerTileGalleryDemo ────────────────────────────────────────────────────

/** Stateful, so selection actually moves — and one tile is disabled, which is
 *  the state worth checking since it has to stay readable while being inert. */
const PickerTileGalleryDemo = () => {
  const [choice, setChoice] = useState('one-day');

  const TILES = [
    { id: 'one-day',   title: 'One-Day Tournament',   description: 'Event starts and finishes on the same day.', enabled: true },
    { id: 'multi-day', title: 'Multi-Day Tournament', description: 'Multiple Rounds over Multiple Days.',        enabled: true },
    { id: 'league',    title: 'League',               description: 'Rounds happen across many days.',            enabled: false },
  ];

  return (
    <div className="w-full max-w-2xl flex flex-col gap-3">
      <div role="radiogroup" aria-label="Timeline" className="flex items-stretch gap-1.5">
        {TILES.map(t => (
          <PickerTile
            key={t.id}
            title={t.title}
            description={t.description}
            selected={choice === t.id}
            disabled={!t.enabled}
            disabledHint="Not available yet"
            onSelect={() => setChoice(t.id)}
          />
        ))}
      </div>

      <GalleryNote>
        A row of mutually exclusive choices where the explanation is the thing
        that decides the answer — "One-Day Tournament" says far less on its own
        than it does beside "Event starts and finishes on the same day", which is
        why this exists instead of a <code>&lt;Select&gt;</code>. Each tile is a
        radio rather than a button, so the row is one choice and arrow-key
        navigation comes free; wrap it in a <code>role="radiogroup"</code> with a
        name. Selected is primary-950 on primary-700, so it takes each app's
        accent. The third tile is disabled — dimmed and inert, but still legible,
        because a choice you cannot make yet is still worth knowing about.
      </GalleryNote>
    </div>
  );
};

// ── StepProgressGalleryDemo ──────────────────────────────────────────────────

/** Stateful so the bars can be watched filling, which is the whole point. */
const StepProgressGalleryDemo = () => {
  const STEPS = ['Event Basics', 'Schedule', 'Registration'];
  const [step, setStep] = useState(1);

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <StepProgress step={step} total={STEPS.length} label={STEPS[step - 1]} />

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
          Back
        </Button>
        <Button size="sm" onClick={() => setStep(s => Math.min(STEPS.length, s + 1))} disabled={step === STEPS.length}>
          Next
        </Button>
      </div>

      {/* Out-of-range values are clamped rather than rendering a broken bar. */}
      <StepProgress step={7} total={4} label="Clamped to the last step" />
      <StepProgress step={2} total={5} hideCaption />

      <GalleryNote>
        One bar per step, filled up to where you are. The caption names the step
        as well as counting it, because a bar alone says how far along you are
        but not what you are doing — pass <code>hideCaption</code> to drop it.
        Colours are primary-600 and primary-900, so it re-themes with each app's
        accent. Deliberately not a numbered stepper with circles and connecting
        lines: those spend a lot of width naming steps you cannot jump to.
      </GalleryNote>
    </div>
  );
};

// ── ControlledTabsGalleryDemo ────────────────────────────────────────────────

/** Tabs in controlled mode — the buttons above the bar select tabs too, which
 *  is the case uncontrolled tabs cannot serve. BattlePack needs it because its
 *  left-hand category nav is the sole source of truth for which section shows,
 *  and clicking a category has to switch the centre tab. */
const ControlledTabsGalleryDemo = () => {
  const [tab, setTab] = useState('format');

  const TABS = [
    { id: 'format',       label: 'Event Format' },
    { id: 'registration', label: 'Registration' },
    { id: 'faq',          label: 'FAQ' },
  ];

  return (
    <div className="w-full max-w-lg flex flex-col gap-3">
      <div className="flex gap-2">
        {TABS.map(t => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? 'filled' : 'outline'}
            onClick={() => setTab(t.id)}
          >
            Select {t.label}
          </Button>
        ))}
      </div>

      <Tabs
        variant="fullWidth"
        activeTab={tab}
        onTabChange={setTab}
        tabs={TABS.map(t => ({
          id: t.id,
          label: t.label,
          content: <Text variant="paragraph">This is the {t.label} panel.</Text>,
        }))}
      />

      <GalleryNote>
        Pass <code>activeTab</code> and <code>onTabChange</code> together and the
        component stops owning the selection. The buttons above and the tab bar
        itself both drive the same state, so they cannot disagree. Omit both
        props and it keeps its own state exactly as before.
      </GalleryNote>
    </div>
  );
};

// ── BuilderShellGalleryDemo ──────────────────────────────────────────────────

/** A builder list row. The panel body is a caller-owned slot — BattleCards puts
 *  <UnitListEntry> here, BattlePack its category rows — so the demo supplies a
 *  plain stand-in rather than pretending either belongs to the shell. */
const DemoListRow = ({ label, active = false }: { label: string; active?: boolean }) => (
  <button
    type="button"
    className={`w-full text-left px-3 py-2 rounded font-body text-sm truncate ${
      active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
    }`}
  >
    {label}
  </button>
);

/** <BuilderShell> + <ListPanel> + <EditorPanel> composed together. Stateful so
 *  the inline rename and the responsive panel toggles are both demonstrable —
 *  drop the preview below lg and the two asides become draggable bottom sheets. */
const BuilderShellGalleryDemo = () => {
  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [title,     setTitle]     = useState<string | null>('Season 6 League');
  const [editing,   setEditing]   = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const commit = (next: string) => {
    const trimmed = next.trim();
    setEditing(false);
    if (trimmed) setTitle(trimmed);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* The shell is a full-viewport layout (h-dvh); the override boxes it into
          the gallery so the section still scrolls normally. */}
      <div className="w-full h-[600px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 [&>div]:!h-full">
        <BuilderShell
          navbar={
            /* Stand-in for the app's <AppNavbar> — see the note below. */
            <div className="shrink-0 h-14 px-4 flex items-center bg-gray-900 border-b border-gray-700">
              <span className="font-heading text-sm text-white uppercase tracking-wide">App Navbar</span>
            </div>
          }
          topBar={
            <div className="lg:hidden shrink-0 px-3 py-2 flex gap-2 bg-gray-900 border-b border-gray-700">
              <Button size="sm" variant="outline" onClick={() => { setLeftOpen(o => !o); setRightOpen(false); }}>
                List
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setRightOpen(o => !o); setLeftOpen(false); }}>
                Editor
              </Button>
            </div>
          }
          leftPanelOpen={leftOpen}
          leftPanel={
            <ListPanel
              title={title}
              editingTitle={editing}
              inputRef={inputRef}
              onStartEdit={startEdit}
              onCommit={commit}
              onCancelEdit={() => setEditing(false)}
              footer={
                <Button leftIcon={<AddCircle className="w-4 h-4" />} variant="outline" size="sm" className="w-full">
                  Add Category
                </Button>
              }
            >
              <DemoListRow label="Event Basics" active />
              <DemoListRow label="Event Timeline" />
              <DemoListRow label="Rounds & Breaks" />
            </ListPanel>
          }
          center={
            <main className="flex-1 min-w-0 overflow-y-auto lg:order-2 flex items-center justify-center">
              <span className="font-body text-sm text-gray-500">Centre slot — the page supplies this</span>
            </main>
          }
          rightPanelOpen={rightOpen}
          rightPanel={
            <EditorPanel title="Event Basics">
              <Input label="Event Name" value="Season 6 League" onChange={() => {}} />
              <Counter label="Rounds" value={5} onChange={() => {}} />
            </EditorPanel>
          }
          onClosePanels={() => { setLeftOpen(false); setRightOpen(false); }}
        />
      </div>
      <GalleryNote>
        The three-column editor layout, shared by BattleCards' card builders and
        BattlePack's pack editor. Double-click the title to rename it. Below lg
        the two asides become draggable bottom sheets that snap between full,
        half and closed — narrow the window and use the List / Editor buttons.
        The navbar and centre are plain slots: the shell owns the layout only, so
        the demo stands in for both rather than shipping a navbar no app uses.
      </GalleryNote>
    </div>
  );
};

// ── SharedGallerySections ────────────────────────────────────────────────────

/**
 * Sidebar entries for the shared sections, in render order. Apps spread this
 * ahead of their own nav items:
 *
 *   nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]}
 */
export const SHARED_GALLERY_NAV: GalleryNavItem[] = [
  // Order matches the render order of the sections below.
  { href: '#nav-app-footer',           label: 'App Footer',           icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-sidebar',              label: 'Sidebar',              icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-icons',                label: 'Icons',                icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-colours',              label: 'Colours',              icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-text',                 label: 'Text',                 icon: <FileText className="w-5 h-5" /> },
  { href: '#nav-lists',                label: 'Lists',                icon: <Clipboard className="w-5 h-5" /> },
  { href: '#nav-links',                label: 'Links',                icon: <ArrowRight className="w-5 h-5" /> },
  { href: '#nav-buttons',              label: 'Buttons',              icon: <Rocket className="w-5 h-5" /> },
  { href: '#nav-counter',              label: 'Counter',              icon: <AddCircle className="w-5 h-5" /> },
  { href: '#nav-badges',               label: 'Badges',               icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-avatars',              label: 'Avatars',              icon: <UserRounded className="w-5 h-5" /> },
  { href: '#nav-friends-modals',       label: 'Friends Modals',       icon: <UserPlusRounded className="w-5 h-5" /> },
  { href: '#nav-avatar-picker',        label: 'Avatar Picker',        icon: <UserCircle className="w-5 h-5" /> },
  { href: '#nav-editable-list-item',   label: 'Editable List Item',   icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-panel-section',        label: 'Panel Section',        icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-banner-picker',        label: 'Banner Picker',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-cards',                label: 'Cards',                icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-dropdowns',            label: 'Dropdowns',            icon: <AltArrowDown className="w-5 h-5" /> },
  { href: '#nav-inputs',               label: 'Inputs',               icon: <Inbox className="w-5 h-5" /> },
  { href: '#nav-select',               label: 'Select',               icon: <AltArrowDown className="w-5 h-5" /> },
  { href: '#nav-checkboxes',           label: 'Checkboxes',           icon: <CheckCircle className="w-5 h-5" /> },
  { href: '#nav-stars',                label: 'Star Rating',          icon: <Star className="w-5 h-5" /> },
  { href: '#nav-tabs',                 label: 'Tabs',                 icon: <Filter className="w-5 h-5" /> },
  { href: '#nav-hr',                   label: 'HR',                   icon: <MinusCircle className="w-5 h-5" /> },
  { href: '#nav-column-header',        label: 'Column Header',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-rich-text-editor',     label: 'Rich Text Editor',     icon: <Pen2 className="w-5 h-5" /> },
  { href: '#nav-multi-select',         label: 'Multi-Select',         icon: <CheckCircle className="w-5 h-5" /> },
  { href: '#nav-vr',                   label: 'VR',                   icon: <MinusCircle className="w-5 h-5" /> },
  { href: '#nav-banner',               label: 'Banner',               icon: <Bell className="w-5 h-5" /> },
  { href: '#nav-callout',              label: 'Callout',              icon: <InfoCircle className="w-5 h-5" /> },
  { href: '#nav-game-logos',           label: 'Game Logos',           icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-selectable-list-item', label: 'Selectable List Item', icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-pagination',           label: 'Pagination',           icon: <AltArrowRight className="w-5 h-5" /> },
  { href: '#nav-markdown-body',        label: 'Markdown Body',        icon: <FileText className="w-5 h-5" /> },
  { href: '#nav-modal',                label: 'Modal',                icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-welcome-modal',        label: 'Welcome Modal',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-profile-modal',        label: 'Profile Modal',        icon: <UserCircle className="w-5 h-5" /> },
  { href: '#nav-update-modal',         label: 'Update Modal',         icon: <Bell className="w-5 h-5" /> },
  { href: '#nav-mode-toggle',          label: 'Mode Toggle',          icon: <Play className="w-5 h-5" /> },
  { href: '#nav-button-pair',          label: 'Button Pair',          icon: <Rocket className="w-5 h-5" /> },
  { href: '#nav-columns',              label: 'Columns',              icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-friends-column',       label: 'Friends Column',       icon: <UsersGroupRounded className="w-5 h-5" /> },
  { href: '#nav-search-select',        label: 'Search Select',        icon: <Magnifer className="w-5 h-5" /> },
  { href: '#nav-sheet',                label: 'Sheet',                icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-lightbox',             label: 'Lightbox',             icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-handle-link',          label: 'Handle Link',          icon: <UserCircle className="w-5 h-5" /> },
  { href: '#nav-impersonation-banner', label: 'Impersonation Banner', icon: <Eye className="w-5 h-5" /> },
  { href: '#nav-builder-shell',        label: 'Builder Shell',        icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-step-progress',        label: 'Step Progress',        icon: <ArrowRight className="w-5 h-5" /> },
  { href: '#nav-picker-tile',          label: 'Picker Tile',          icon: <CheckCircle className="w-5 h-5" /> },
];

export interface SharedGallerySectionsProps {
  /**
   * The app rendering this gallery. A few components take an app name as a prop
   * (AppFooter, Sidebar) — showing a hardcoded "BattleCards" inside BattlePlan's
   * gallery just reads as a bug, so pass the host app's name through.
   */
  appName?: string;
}

/**
 * Every demo for the components in @battleplans/ui. Render this inside a
 * <GalleryShell> before the app's own sections.
 */
const SharedGallerySections = ({ appName = 'BattleCards' }: SharedGallerySectionsProps) => {
  // Drives the ColumnHeader demo's view toggle.
  const [columnHeaderView, setColumnHeaderView] = useState('list');
  const [counterDefault, setCounterDefault] = useState(1);
  const [counterSuccess, setCounterSuccess] = useState(3);
  const [counterError,   setCounterError]   = useState(0);
  const [multiSelected,  setMultiSelected]  = useState<string[]>([]);
  const [multiSelected2, setMultiSelected2] = useState<string[]>([]);
  // AvatarPicker demo: undefined = untouched, Blob = cropped, null = removed.
  const [pickedAvatar,   setPickedAvatar]   = useState<Blob | null | undefined>(undefined);
  // BannerPicker demo: same three-state contract as the avatar one.
  const [pickedBanner,   setPickedBanner]   = useState<PendingBanner | null | undefined>(undefined);
  const [modalOpen,      setModalOpen]      = useState(false);

  return (
    <>
      <GallerySection id="nav-app-footer" title="App Footer / Default">
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          <AppFooter appName={appName} version="0.16.0" buildDate="06/07/2026" />
        </div>
        <p className="font-body text-xs text-gray-400 italic mt-2">
          Resize below 768px (md) to see it stack onto two lines.
        </p>
      </GallerySection>

      <GallerySection id="nav-sidebar" title="Sidebar / Default">

        {/* Preview wrapper — clips the sidebar to a fixed area */}
        <div className="w-full rounded-xl overflow-hidden border border-gray-200
                        dark:border-gray-700 flex" style={{ height: 320 }}>

          {/* Sidebar rendered statically (always open) for gallery preview */}
          <div className="relative shrink-0" style={{ width: 256 }}>
            <Sidebar
              isOpen={true}
              width="w-full"
              title={appName}
              className="relative h-full border-r-0"
            />
          </div>

          {/* Simulated page body to the right of the sidebar */}
          <div className="flex-1 bg-gray-50 dark:bg-gray-950 flex items-center
                          justify-center px-4">
            <p className="font-body text-xs text-gray-400 italic">
              Page content sits here
            </p>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-icons" title="Icons / Solar Linear">
        <IconGrid icons={[
          { name: 'Home',                   outline: <Home />,                   solid: <HomeBold /> },
          { name: 'Magnifer',               outline: <Magnifer />,               solid: <MagniferBold /> },
          { name: 'Bell',                   outline: <Bell />,                   solid: <BellBold /> },
          { name: 'BellBing',               outline: <BellBing />,               solid: <BellBingBold /> },
          { name: 'Settings',               outline: <Settings />,               solid: <SettingsBold /> },
          { name: 'Star',                   outline: <Star />,                   solid: <StarBold /> },
          { name: 'Bookmark',               outline: <Bookmark />,               solid: <BookmarkBold /> },
          { name: 'Heart',                  outline: <Heart />,                  solid: <HeartBold /> },
          { name: 'Rocket',                 outline: <Rocket />,                 solid: <RocketBold /> },
          { name: 'Shield',                 outline: <Shield />,                 solid: <ShieldBold /> },
          { name: 'Flag',                   outline: <Flag />,                   solid: <FlagBold /> },
          { name: 'AddCircle',              outline: <AddCircle />,              solid: <AddCircleBold /> },
          { name: 'MinusCircle',            outline: <MinusCircle />,            solid: <MinusCircleBold /> },
          { name: 'CheckCircle',            outline: <CheckCircle />,            solid: <CheckCircleBold /> },
          { name: 'CloseCircle',            outline: <CloseCircle />,            solid: <CloseCircleBold /> },
          { name: 'InfoCircle',             outline: <InfoCircle />,             solid: <InfoCircleBold /> },
          { name: 'DangerCircle',           outline: <DangerCircle />,           solid: <DangerCircleBold /> },
          { name: 'QuestionCircle',         outline: <QuestionCircle />,         solid: <QuestionCircleBold /> },
          { name: 'Pen2',                   outline: <Pen2 />,                   solid: <Pen2Bold /> },
          { name: 'TrashBinMinimalistic',   outline: <TrashBinMinimalistic />,   solid: <TrashBinMinimalisticBold /> },
          { name: 'DownloadMinimalistic',   outline: <DownloadMinimalistic />,   solid: <DownloadMinimalisticBold /> },
          { name: 'UploadMinimalistic',     outline: <UploadMinimalistic />,     solid: <UploadMinimalisticBold /> },
          { name: 'Diskette',               outline: <Diskette />,               solid: <DisketteBold /> },
          { name: 'Share',                  outline: <Share />,                  solid: <ShareBold /> },
          { name: 'ExternalLink',           outline: <ExternalLink />,           solid: <ExternalLinkBold /> },
          { name: 'Filter',                 outline: <Filter />,                 solid: <FilterBold /> },
          { name: 'MenuDots',               outline: <MenuDots />,               solid: <MenuDotsBold /> },
          { name: 'Eye',                    outline: <Eye />,                    solid: <EyeBold /> },
          { name: 'EyeClosed',              outline: <EyeClosed />,              solid: <EyeClosedBold /> },
          { name: 'Lock',                   outline: <Lock />,                   solid: <LockBold /> },
          { name: 'LockUnlocked',           outline: <LockUnlocked />,           solid: <LockUnlockedBold /> },
          { name: 'ArrowLeft',              outline: <ArrowLeft />,              solid: null },
          { name: 'ArrowRight',             outline: <ArrowRight />,             solid: null },
          { name: 'ArrowUp',               outline: <ArrowUp />,                solid: null },
          { name: 'ArrowDown',              outline: <ArrowDown />,              solid: null },
          { name: 'AltArrowLeft',           outline: <AltArrowLeft />,           solid: null },
          { name: 'AltArrowRight',          outline: <AltArrowRight />,          solid: null },
          { name: 'AltArrowUp',             outline: <AltArrowUp />,             solid: null },
          { name: 'AltArrowDown',           outline: <AltArrowDown />,           solid: null },
          { name: 'UserRounded',            outline: <UserRounded />,            solid: <UserRoundedBold /> },
          { name: 'UsersGroupRounded',      outline: <UsersGroupRounded />,      solid: <UsersGroupRoundedBold /> },
          { name: 'UserPlusRounded',        outline: <UserPlusRounded />,        solid: <UserPlusRoundedBold /> },
          { name: 'UserCircle',             outline: <UserCircle />,             solid: <UserCircleBold /> },
          { name: 'Widget2',                outline: <Widget2 />,                solid: <Widget2Bold /> },
          { name: 'ListCheck',              outline: <ListCheck />,              solid: <ListCheckBold /> },
          { name: 'Inbox',                  outline: <Inbox />,                  solid: <InboxBold /> },
          { name: 'Letter',                 outline: <Letter />,                 solid: <LetterBold /> },
          { name: 'Gallery',                outline: <Gallery />,                solid: <GalleryBold /> },
          { name: 'FileText',               outline: <FileText />,               solid: <FileTextBold /> },
          { name: 'Folder',                 outline: <Folder />,                 solid: <FolderBold /> },
          { name: 'Clipboard',              outline: <Clipboard />,              solid: <ClipboardBold /> },
          { name: 'Play',                   outline: <Play />,                   solid: <PlayBold /> },
          { name: 'Pause',                  outline: <Pause />,                  solid: <PauseBold /> },
          { name: 'Stop',                   outline: <Stop />,                   solid: <StopBold /> },
          { name: 'Microphone',             outline: <Microphone />,             solid: <MicrophoneBold /> },
          { name: 'Videocamera',            outline: <Videocamera />,            solid: <VideocameraBold /> },
          { name: 'Moon',                   outline: <Moon />,                   solid: <MoonBold /> },
          { name: 'Sun',                    outline: <Sun />,                    solid: <SunBold /> },
        ]} />
      </GallerySection>

      <GallerySection id="nav-colours" title="Colour Palette / Raw">
        <div className="w-full space-y-6">
          {RAW_PALETTE.map((family) => (
            <ColorRow key={family.name} family={family} />
          ))}
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          COLOUR PALETTE — Semantic Tokens
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Colour Palette / Semantic Tokens">
        <div className="w-full space-y-6">
          {SEMANTIC_PALETTE.map((family) => (
            <ColorRow key={family.name} family={family} />
          ))}
        </div>
      </GallerySection>

      <GallerySection id="nav-text" title="Text / Headings">
        <div className="w-full space-y-4">
          <Text variant="h1">H1 — The Battle Begins</Text>
          <Text variant="h2">H2 — Choose Your Forces</Text>
          <Text variant="h3">H3 — Deploy Your Units</Text>
          <Text variant="h4">H4 — Unit Statistics</Text>
          <Text variant="h5">H5 — Abilities &amp; Traits</Text>
          <Text variant="h6">H6 — Footnotes &amp; References</Text>
        </div>
      </GallerySection>

      {/* ── Heading composition patterns (partial text styling) ───── */}
      <GallerySection title="Text / Headings — Composition Patterns">
        <div className="w-full space-y-6">

          {/* Highlighted heading — wrap key words in a brand-coloured span */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">Highlighted</p>
            <Text variant="h2">
              Build your{' '}
              <span className="text-blue-600 dark:text-blue-400">perfect army</span>
            </Text>
          </div>

          {/* Gradient heading */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">Gradient</p>
            <Text variant="h2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
                Command the battlefield
              </span>
            </Text>
          </div>

          {/* Underlined heading */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">Underlined</p>
            <Text variant="h2">
              <span className="underline underline-offset-4 decoration-4 decoration-blue-500">
                Forge your legend
              </span>
            </Text>
          </div>

          {/* Mark / highlight heading */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">Mark</p>
            <Text variant="h2">
              Create{' '}
              <mark className="px-2 text-white bg-blue-600 rounded-sm">custom cards</mark>
            </Text>
          </div>

          {/* Heading with secondary text */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">With secondary text</p>
            <Text variant="h2">
              Heavy Infantry{' '}
              <small className="font-body ms-2 font-normal text-gray-500 dark:text-gray-400">
                Unit Card
              </small>
            </Text>
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TEXT — Paragraphs
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Text / Paragraphs">
        <div className="w-full space-y-6 max-w-2xl">

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">Default</p>
            <Text variant="paragraph">
              Heavy Infantry are the backbone of any great army. Clad in thick armour and wielding
              heavy weapons, they hold the line while lighter units flank the enemy.
            </Text>
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">Lead (intro paragraph)</p>
            <Text variant="paragraph-lead">
              Build and share custom unit cards for any tabletop wargame. Define stats,
              abilities, and lore — then take them to the battlefield.
            </Text>
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-1">Drop cap</p>
            <Text variant="paragraph-dropcap">
              Heavy infantry are the backbone of any great army. Clad in thick armour and wielding
              heavy weapons, they hold the line while lighter units flank the enemy and archers
              rain fire from above.
            </Text>
          </div>

        </div>
      </GallerySection>

      {/* ── Inline paragraph modifiers ─────────────────────────────── */}
      <GallerySection title="Text / Paragraph Modifiers">
        <div className="w-full space-y-3">
          <Text variant="paragraph" weight="bold">Bold paragraph text</Text>
          <Text variant="paragraph" italic>Italic paragraph text</Text>
          <Text variant="paragraph" underline>Underlined paragraph text</Text>
          <Text variant="paragraph" strikethrough>Strikethrough paragraph text</Text>
          <Text variant="paragraph" uppercase>Uppercase paragraph text</Text>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TEXT — Blockquotes
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Text / Blockquotes">
        <div className="w-full space-y-8 max-w-2xl">

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Default</p>
            <Text variant="blockquote">
              "An army marches on its stomach — but it wins on the strength of its cards."
            </Text>
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Solid (border + background)</p>
            <Text variant="blockquote-solid">
              "An army marches on its stomach — but it wins on the strength of its cards."
            </Text>
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Icon (with quotation mark)</p>
            <Text variant="blockquote-icon">
              "An army marches on its stomach — but it wins on the strength of its cards."
            </Text>
          </div>

          {/* Alignment variants */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Alignments</p>
            <div className="space-y-4">
              <Text variant="blockquote" align="left">"Left-aligned quote."</Text>
              <Text variant="blockquote" align="center">"Centred quote."</Text>
              <Text variant="blockquote" align="right">"Right-aligned quote."</Text>
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TEXT — Sizing scale
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Text / Sizing Scale">
        <div className="w-full space-y-2">
          {(
            ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'] as const
          ).map((size) => (
            <Text key={size} variant="paragraph" size={size}>
              {size} — The quick brown fox jumps over the lazy dog
            </Text>
          ))}
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TEXT — Font weights
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Text / Font Weights">
        <div className="w-full space-y-2">
          {(
            ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black'] as const
          ).map((weight) => (
            <Text key={weight} variant="paragraph" weight={weight}>
              {weight} — The quick brown fox jumps over the lazy dog
            </Text>
          ))}
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TEXT — Colour roles
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Text / Colour Roles">
        <div className="w-full space-y-2">
          <Text variant="paragraph" color="default">default — Standard body text</Text>
          <Text variant="paragraph" color="brand">brand — Blue accent text</Text>
          <Text variant="paragraph" color="success">success — Positive / confirmed</Text>
          <Text variant="paragraph" color="danger">danger — Error / destructive</Text>
          <Text variant="paragraph" color="purple">purple — Special / legendary</Text>
          <Text variant="paragraph" color="teal">teal — Informational / secondary</Text>
        </div>
      </GallerySection>

      <GallerySection id="nav-lists" title="Lists / Unordered">
        <List
          variant="unordered"
          items={['Heavy Infantry', 'Mounted Archers', 'Siege Engineers', 'Scout Raiders']}
        />
      </GallerySection>

      <GallerySection title="Lists / Ordered">
        <List
          variant="ordered"
          items={['Deploy units', 'Roll for initiative', 'Resolve attacks', 'Check morale']}
        />
      </GallerySection>

      <GallerySection title="Lists / Unstyled">
        <List
          variant="unstyled"
          items={['No bullets', 'No numbers', 'Just clean text']}
        />
      </GallerySection>

      <GallerySection title="Lists / Horizontal">
        <List
          variant="horizontal"
          items={['Infantry', 'Cavalry', 'Artillery', 'Support', 'Hero']}
        />
      </GallerySection>

      <GallerySection title="Lists / Description">
        <List
          variant="description"
          descriptionItems={[
            { term: 'Attack',   detail: 'Number of dice rolled when this unit attacks.' },
            { term: 'Defence',  detail: 'Damage absorbed before wounds are applied.' },
            { term: 'Movement', detail: 'Maximum distance in inches per turn.' },
            { term: 'Morale',   detail: 'Threshold at which the unit may flee.' },
          ]}
        />
      </GallerySection>

      <GallerySection id="nav-links" title="Links / Variants">
        <div className="w-full space-y-4">

          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-gray-400 dark:text-gray-500 w-24">Default</span>
            <TextLink href="https://example.com">Visit example.com</TextLink>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-gray-400 dark:text-gray-500 w-24">Paragraph</span>
            <Text variant="paragraph">
              Read more about{' '}
              <TextLink variant="paragraph" href="https://example.com">unit card rules</TextLink>
              {' '}in the handbook.
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-gray-400 dark:text-gray-500 w-24">Icon</span>
            <TextLink
              variant="icon"
              href="https://example.com"
              icon={
                // Simple arrow icon — replace with your icon library of choice
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              }
            >
              Learn more
            </TextLink>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-gray-400 dark:text-gray-500 w-24">CTA</span>
            <TextLink variant="cta" to="/">Go to home</TextLink>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-gray-400 dark:text-gray-500 w-24">Button</span>
            <TextLink variant="button" to="/">Create a card</TextLink>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-buttons" title="Button / Filled">
        <div className="flex flex-wrap gap-3">
          <Button color="primary">Primary</Button>
          <Button color="secondary">Secondary</Button>
          <Button color="success">Success</Button>
          <Button color="danger">Danger</Button>
          <Button color="warning">Warning</Button>
          <Button color="dark">Dark</Button>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BUTTON — Outlined
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Button / Outlined">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" color="primary">Primary</Button>
          <Button variant="outline" color="secondary">Secondary</Button>
          <Button variant="outline" color="success">Success</Button>
          <Button variant="outline" color="danger">Danger</Button>
          <Button variant="outline" color="warning">Warning</Button>
          <Button variant="outline" color="dark">Dark</Button>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BUTTON — Ghost
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Button / Ghost">
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" color="primary">Primary</Button>
          <Button variant="ghost" color="secondary">Secondary</Button>
          <Button variant="ghost" color="success">Success</Button>
          <Button variant="ghost" color="danger">Danger</Button>
          <Button variant="ghost" color="warning">Warning</Button>
          <Button variant="ghost" color="dark">Dark</Button>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BUTTON — Sizes & Shapes
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Button / Sizes & Shapes">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Button size="xs">Extra Small</Button>
          <Button size="sm">Small</Button>
          <Button size="base">Base</Button>
          <Button size="lg">Large</Button>
          <Button size="xl">Extra Large</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button shape="rounded">Rounded</Button>
          <Button shape="pill">Pill</Button>
          <Button variant="outline" shape="rounded">Rounded outlined</Button>
          <Button variant="outline" shape="pill">Pill outlined</Button>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BUTTON — Icons
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Button / With Icons">
        <div className="flex flex-wrap items-center gap-3">
          <Button leftIcon={<AddCircle className="w-4 h-4" />}>Add Unit</Button>
          <Button rightIcon={<ArrowRight className="w-4 h-4" />} variant="outline">
            View Details
          </Button>
          <Button leftIcon={<DownloadMinimalistic className="w-4 h-4" />} color="success">
            Export
          </Button>
          <Button leftIcon={<TrashBinMinimalistic className="w-4 h-4" />} color="danger" variant="outline">
            Delete
          </Button>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BUTTON — States
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Button / States">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button variant="outline" loading>Loading outline</Button>
          <Button variant="outline" disabled>Disabled outline</Button>
        </div>
      </GallerySection>

      <GallerySection id="nav-counter" title="Counter">
        <div className="space-y-6">

          {/* Base stepper — no label */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-3">Base stepper</p>
            <div className="flex flex-wrap items-start gap-6">
              <Counter value={counterDefault} onChange={setCounterDefault} />
              <Counter value={counterDefault} onChange={setCounterDefault} min={counterDefault} />
              <Counter value={counterDefault} onChange={setCounterDefault} max={counterDefault} />
            </div>
          </div>

          {/* With label, required, and helper text — all states */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-3">With label &amp; states</p>
            <div className="flex flex-wrap items-start gap-6">
              <Counter
                label="Counter Label"
                required
                helperText="This is a helper message."
                value={counterDefault}
                onChange={setCounterDefault}
              />
              <Counter
                label="Counter Label"
                required
                state="success"
                helperText="This is a helper message."
                value={counterSuccess}
                onChange={setCounterSuccess}
              />
              <Counter
                label="Counter Label"
                required
                state="error"
                helperText="This is a helper message."
                value={counterError}
                onChange={setCounterError}
                min={1}
              />
            </div>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-badges" title="Badge / Solid">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="primary">Primary</Badge>
          <Badge color="gray">Gray</Badge>
          <Badge color="success">Success</Badge>
          <Badge color="danger">Danger</Badge>
          <Badge color="warning">Warning</Badge>
          <Badge color="purple">Purple</Badge>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BADGE — Outline
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Badge / Outline">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" color="primary">Primary</Badge>
          <Badge variant="outline" color="gray">Gray</Badge>
          <Badge variant="outline" color="success">Success</Badge>
          <Badge variant="outline" color="danger">Danger</Badge>
          <Badge variant="outline" color="warning">Warning</Badge>
          <Badge variant="outline" color="purple">Purple</Badge>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BADGE — Sizes & Shapes
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Badge / Sizes & Shapes">
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="sm">Small rounded</Badge>
          <Badge size="lg">Large rounded</Badge>
          <Badge size="sm" shape="pill">Small pill</Badge>
          <Badge size="lg" shape="pill">Large pill</Badge>
          <Badge size="lg" variant="outline" shape="pill">Large outline pill</Badge>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BADGE — Dot & Icon
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Badge / Dot & Icon">
        <div className="flex flex-wrap items-center gap-2">
          <Badge dot color="success">Online</Badge>
          <Badge dot color="danger">Busy</Badge>
          <Badge dot color="warning">Away</Badge>
          <Badge dot color="gray">Offline</Badge>
          <Badge icon={<Star className="w-3 h-3" />} color="warning" size="lg">Legendary</Badge>
          <Badge icon={<Shield className="w-3 h-3" />} color="primary" size="lg">Verified</Badge>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BADGE — Dismissible
          Uses local state to demonstrate removing a badge.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Badge / Dismissible">
        <DismissibleBadgeDemo />
      </GallerySection>

      <GallerySection id="nav-avatars" title="Avatar / Sizes">
        <div className="flex flex-wrap items-end gap-3">
          <Avatar size="xs"  initials="XS" />
          <Avatar size="sm"  initials="SM" />
          <Avatar size="base" initials="BS" />
          <Avatar size="lg"  initials="LG" />
          <Avatar size="xl"  initials="XL" />
          <Avatar size="2xl" initials="2X" />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          AVATAR — Shapes & Colours
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Avatar / Shapes & Colours">
        <div className="flex flex-wrap items-center gap-3">
          {/* Circle (default) with each color */}
          <Avatar initials="PR" color="primary" />
          <Avatar initials="GR" color="gray" />
          <Avatar initials="OK" color="success" />
          <Avatar initials="NO" color="danger" />
          <Avatar initials="AW" color="warning" />
          <Avatar initials="LG" color="purple" />
          {/* Rounded shape */}
          <Avatar initials="RD" shape="rounded" color="primary" />
          {/* Placeholder icon (no initials) */}
          <Avatar color="gray" />
          <Avatar color="primary" shape="rounded" />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          AVATAR — Bordered & Status
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Avatar / Bordered & Status">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar initials="BD" bordered />
          <Avatar initials="ON" status="online" />
          <Avatar initials="BS" status="busy" color="danger" />
          <Avatar initials="AW" status="away" color="warning" />
          <Avatar initials="OF" status="offline" color="gray" />
          <Avatar initials="AL" bordered status="online" size="lg" />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          AVATAR — Stacked Group
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Avatar / Stacked Group">
        <div className="flex flex-col gap-4">

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">No overflow</p>
            <AvatarGroup>
              <Avatar initials="JL" color="primary"  bordered />
              <Avatar initials="AM" color="success"  bordered />
              <Avatar initials="RK" color="purple"   bordered />
              <Avatar initials="TB" color="warning"  bordered />
            </AvatarGroup>
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">With overflow (max=3)</p>
            <AvatarGroup max={3}>
              <Avatar initials="JL" color="primary"  bordered />
              <Avatar initials="AM" color="success"  bordered />
              <Avatar initials="RK" color="purple"   bordered />
              <Avatar initials="TB" color="warning"  bordered />
              <Avatar initials="CM" color="danger"   bordered />
            </AvatarGroup>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-friends-modals" title="Friends / Modals">
        <FriendsModalsGalleryDemo />
      </GallerySection>

      <GallerySection id="nav-avatar-picker" title="AvatarPicker">
        <div className="flex flex-col gap-6">

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              Empty — falls back to initials. Picking a file opens the crop dialog.
            </p>
            <AvatarPicker
              initials="JL"
              onChange={blob => setPickedAvatar(blob)}
            />
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              With an existing picture — gains a Remove action
            </p>
            <AvatarPicker
              currentUrl={heroImage}
              initials="JL"
              onChange={blob => setPickedAvatar(blob)}
            />
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              Disabled (parent form is saving)
            </p>
            <AvatarPicker initials="JL" onChange={() => {}} disabled />
          </div>

          <Text variant="paragraph" size="sm">
            Last onChange: {pickedAvatar === undefined
              ? 'untouched'
              : pickedAvatar === null
                ? 'removed'
                : `${Math.round(pickedAvatar.size / 1024)} KB JPEG`}
          </Text>

        </div>
      </GallerySection>

      <GallerySection id="nav-editable-list-item" title="EditableListItem">
        <GalleryNote>
          One row of an editable list. `header` is a slot rather than a
          numbering scheme, because the lists disagree about what belongs
          there — the schedule wants an ordinal and a kind picker, an FAQ wants
          "QUESTION 2", a checklist wants its text field so the controls sit on
          the same line as the thing they act on. Reorder is arrows rather than
          dragging: keyboard operable, and no gesture library on touch. The
          arrows disable themselves at the ends of the list.
        </GalleryNote>
        <div className="w-80 bg-gray-900 rounded-xl border border-gray-700 p-3 flex flex-col gap-2">
          {['Dice and a tape measure', 'The Core Rules', 'Three objective markers'].map((text, i, all) => (
            <EditableListItem
              key={i}
              index={i}
              count={all.length}
              removeLabel={`Remove item ${i + 1}`}
              onMove={() => {}}
              onRemove={() => {}}
              header={<Input size="sm" defaultValue={text} />}
            >
              <Input size="sm" placeholder="https://… (optional)" />
            </EditableListItem>
          ))}

          <EditableListItem
            index={0}
            count={1}
            header={
              <span className="font-body text-xs font-bold uppercase tracking-[1.2px] text-gray-500">
                Question 1
              </span>
            }
            onMove={() => {}}
            onRemove={() => {}}
          >
            <Input size="sm" defaultValue="Can I proxy models?" />
          </EditableListItem>

          <EditableListItem index={0} count={1} disabled header={<Input size="sm" defaultValue="Disabled row" />} onMove={() => {}} onRemove={() => {}} />
        </div>
      </GallerySection>

      <GallerySection id="nav-panel-section" title="PanelSection">
        <GalleryNote>
          The second level of an editor panel's heading hierarchy. EditorPanel
          owns the first — its title sits above a divider running the full width
          of the panel. This one lives inside the body, so its divider is inset
          by the body padding, and that difference in width is the entire signal
          for "group within the panel" rather than "the panel".
        </GalleryNote>
        <div className="w-80 bg-gray-900 rounded-xl border border-gray-700 p-3 flex flex-col gap-6">
          <PanelSection title="Basic Details">
            <Input label="Event Name" placeholder="July RTT" />
          </PanelSection>

          <PanelSection title="Prizes" action="Saving…">
            <Text variant="paragraph" size="sm">
              A string action gets the house hint styling.
            </Text>
          </PanelSection>

          <PanelSection title="Status" action={<Badge color="success">Published</Badge>} />
          <Text variant="paragraph" size="sm">
            No children — a bare heading with siblings after it. A node action is
            rendered untouched, so the badge keeps its own colours.
          </Text>
        </div>
      </GallerySection>

      <GallerySection id="nav-banner-picker" title="BannerPicker">
        <GalleryNote>
          A banner keeps its own shape. `minAspect` is the TALLEST it may be
          (width ÷ height, so 3:2 is 1.5) — anything that wide or wider is taken
          whole with no crop step, and only a taller image opens the cropper.
          Upload a wide picture and a square one to see both paths.
        </GalleryNote>
        <div className="flex flex-col gap-6">

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              Empty — the frame shows the tallest a banner may be, 3:2
            </p>
            <BannerPicker
              label="Event banner"
              minAspect={3 / 2}
              hint="Wide artwork for the top of the pack. JPEG, PNG or WebP."
              onChange={setPickedBanner}
            />
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              With a saved 3:1 banner — the frame takes its real shape, and a
              Remove action appears
            </p>
            <BannerPicker
              label="Event banner"
              currentUrl={heroImage}
              currentAspect={3}
              minAspect={3 / 2}
              onChange={setPickedBanner}
            />
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              A stricter limit — 16:9, so anything taller than that gets cropped
            </p>
            <BannerPicker
              label="Cover image"
              minAspect={16 / 9}
              onChange={setPickedBanner}
            />
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              Disabled (parent form is saving)
            </p>
            <BannerPicker currentUrl={heroImage} currentAspect={3} onChange={() => {}} disabled />
          </div>

          <Text variant="paragraph" size="sm">
            Last onChange: {pickedBanner === undefined
              ? 'untouched'
              : pickedBanner === null
                ? 'removed'
                : `${Math.round(pickedBanner.blob.size / 1024)} KB JPEG at ${pickedBanner.aspect.toFixed(2)}:1`}
          </Text>

        </div>
      </GallerySection>

      <GallerySection title="Avatar / With Text (composition)">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar initials="JL" color="primary" size="lg" />
            <div>
              <Text variant="paragraph" weight="semibold">Jane Lee</Text>
              <Text variant="paragraph" size="sm">Commander — 3rd Battalion</Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar color="gray" status="online" />
            <div>
              <Text variant="paragraph" weight="semibold">Unknown Soldier</Text>
              <Text variant="paragraph" size="sm">Online now</Text>
            </div>
          </div>
        </div>
      </GallerySection>

      <GallerySection id="nav-cards" title="Card / Default, Button & Link">
        <div className="flex flex-wrap gap-4 items-start">

          {/* 1. Default */}
          <Card className="max-w-xs w-full">
            <CardBody>
              <Text variant="h5" className="mb-2">Default Card</Text>
              <Text variant="paragraph">
                Use this as a starting point for any card that just needs a
                title and supporting description.
              </Text>
            </CardBody>
          </Card>

          {/* 2. With Button */}
          <Card className="max-w-xs w-full">
            <CardBody className="flex flex-col gap-3">
              <Text variant="h5">Card with Button</Text>
              <Text variant="paragraph">
                Pair a description with a primary action to guide the user
                toward the next step.
              </Text>
              <Button rightIcon={<ArrowRight className="w-4 h-4" />}>
                Read more
              </Button>
            </CardBody>
          </Card>

          {/* 3. With Link */}
          <Card className="max-w-xs w-full">
            <CardBody className="flex flex-col gap-3">
              <Rocket className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <Text variant="h5">Card with Link</Text>
              <Text variant="paragraph">
                Use an icon to give the card instant visual context, then
                point users to related content with a text link.
              </Text>
              <TextLink variant="icon" href="https://example.com"
                icon={<ArrowRight className="w-4 h-4" />}>
                Learn more
              </TextLink>
            </CardBody>
          </Card>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — With Image (top image variants)
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / With Image">
        <div className="flex flex-wrap gap-4 items-start">

          {/* 4. Image + badge + button */}
          <Card className="max-w-xs w-full">
            <CardImage src={heroImage} alt="Unit card" className="h-44" />
            <CardBody className="flex flex-col gap-3">
              <Badge color="purple" shape="pill">Legendary</Badge>
              <Text variant="h5">Heavy Infantry</Text>
              <Button className="w-full">Deploy unit</Button>
            </CardBody>
          </Card>

          {/* 5. Image + description + button */}
          <Card className="max-w-xs w-full">
            <CardImage src={heroImage} alt="Unit card" className="h-44" />
            <CardBody className="flex flex-col gap-3">
              <Text variant="h5">Mounted Archers</Text>
              <Text variant="paragraph">
                Fast-moving cavalry archers that harass enemy flanks and
                withdraw before retaliation.
              </Text>
              <Button variant="outline">View stats</Button>
            </CardBody>
          </Card>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — Horizontal
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / Horizontal">
        <Card horizontal className="max-w-xl w-full">
          <CardImage
            src={heroImage}
            alt="Unit"
            className="h-48 md:h-auto md:w-48 shrink-0"
          />
          <CardBody className="flex flex-col justify-center gap-3">
            <Text variant="h5">Siege Engineers</Text>
            <Text variant="paragraph">
              Specialist troops that construct and operate heavy siege
              equipment. Slow to deploy but devastating once in position.
            </Text>
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Read more
            </Button>
          </CardBody>
        </Card>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — User Profile
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / User Profile">
        <Card className="max-w-xs w-full relative">
          {/* Options dropdown — absolute top-right */}
          <div className="absolute top-3 right-3">
            <Dropdown
              trigger={
                <Button variant="ghost" color="secondary" size="xs">
                  <MenuDots className="w-5 h-5" />
                </Button>
              }
              align="right"
            >
              <DropdownItem icon={<Pen2 className="w-4 h-4" />}>Edit</DropdownItem>
              <DropdownItem icon={<DownloadMinimalistic className="w-4 h-4" />}>Export</DropdownItem>
              <DropdownDivider />
              <DropdownItem icon={<TrashBinMinimalistic className="w-4 h-4" />}>Delete</DropdownItem>
            </Dropdown>
          </div>

          <CardBody className="flex flex-col items-center text-center gap-2 pt-8">
            <Avatar initials="JL" color="primary" size="xl" />
            <Text variant="h5" className="mt-1">Jane Lee</Text>
            <Text variant="paragraph" size="sm">Commander — 3rd Battalion</Text>
            <div className="flex gap-2 mt-2">
              <Button size="sm">Add friend</Button>
              <Button size="sm" variant="outline">Message</Button>
            </div>
          </CardBody>
        </Card>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — With Form
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / With Form">
        <Card className="max-w-sm w-full">
          <CardBody className="flex flex-col gap-4">
            <Text variant="h5">Sign in to BattleCards</Text>
            <Input label="Email" type="email" placeholder="name@battlecards.app" leftIcon={<Letter className="w-4 h-4" />} />
            <Input label="Password" type="password" placeholder="••••••••" leftIcon={<Lock className="w-4 h-4" />} />
            <div className="flex items-center justify-between">
              <Checkbox label="Remember me" />
              <TextLink variant="paragraph" href="#">Lost password?</TextLink>
            </div>
            <Button type="submit" className="w-full">Sign in</Button>
            <Text variant="paragraph" size="sm" align="center">
              No account?{' '}
              <TextLink variant="paragraph" href="#">Create one</TextLink>
            </Text>
          </CardBody>
        </Card>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — E-commerce (unit shop)
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / E-commerce">
        <Card className="max-w-xs w-full">
          <CardImage src={heroImage} alt="Heavy Infantry" className="h-44" />
          <CardBody className="flex flex-col gap-2">
            <StarRating rating={4} count={73} size="sm" />
            <Text variant="h5">Heavy Infantry Pack</Text>
            <div className="flex items-center justify-between mt-1">
              <Text variant="h5">$9.99</Text>
              <Button size="sm" leftIcon={<AddCircle className="w-4 h-4" />}>Add to cart</Button>
            </div>
          </CardBody>
        </Card>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — Call to Action
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / Call to Action">
        <Card className="max-w-sm w-full">
          <CardBody className="flex flex-col items-center text-center gap-4">
            <Rocket className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            <Text variant="h5">Take BattleCards mobile</Text>
            <Text variant="paragraph">
              Manage your decks, track battles, and challenge opponents
              from anywhere with the BattleCards app.
            </Text>
            <div className="flex flex-col gap-2 w-full">
              <Button leftIcon={<DownloadMinimalistic className="w-4 h-4" />}>
                App Store
              </Button>
              <Button variant="outline" leftIcon={<DownloadMinimalistic className="w-4 h-4" />}>
                Google Play
              </Button>
            </div>
          </CardBody>
        </Card>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — Nav Tabs (underline + default style)
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / Nav Tabs">
        <div className="flex flex-wrap gap-4 items-start">

          {/* Underline tabs inside a card */}
          <Card className="max-w-md w-full">
            <Tabs
              variant="underline"
              panelClassName="border-0 rounded-none"
              tabs={[
                { id: 'stats',     label: 'Stats',     icon: <Star className="w-4 h-4" />,   content: <Text variant="paragraph">Attack: 8 · Defence: 12 · Movement: 4 · Morale: 9</Text> },
                { id: 'abilities', label: 'Abilities', icon: <Shield className="w-4 h-4" />, content: <Text variant="paragraph">Shield Wall — Reduces incoming damage by 2 when adjacent to a friendly unit.</Text> },
                { id: 'lore',      label: 'Lore',      icon: <FileText className="w-4 h-4" />, content: <Text variant="paragraph">Forged in the northern campaigns, Heavy Infantry are the backbone of any great army.</Text> },
              ]}
            />
          </Card>

          {/* Full-width tabs inside a card */}
          <Card className="max-w-md w-full">
            <Tabs
              variant="fullWidth"
              panelClassName="border-0 rounded-none"
              tabs={[
                { id: 'stats',     label: 'Stats',     content: <Text variant="paragraph">Attack: 8 · Defence: 12 · Movement: 4 · Morale: 9</Text> },
                { id: 'abilities', label: 'Abilities', content: <Text variant="paragraph">Shield Wall — Reduces incoming damage by 2 when adjacent to a friendly unit.</Text> },
                { id: 'lore',      label: 'Lore',      content: <Text variant="paragraph">Forged in the northern campaigns, Heavy Infantry are the backbone of any great army.</Text> },
              ]}
            />
          </Card>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — With List
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / With List">
        <Card className="max-w-md w-full">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <Text variant="h5">Recent Battles</Text>
              <TextLink variant="paragraph" href="#">View all</TextLink>
            </div>
            <div className="space-y-4">
              {[
                { initials: 'JL', color: 'primary' as const, name: 'Jane Lee',    detail: 'Commander',  value: '+2,400 pts' },
                { initials: 'AM', color: 'success' as const, name: 'Alex Marsh',  detail: 'Captain',    value: '+800 pts'   },
                { initials: 'RK', color: 'purple'  as const, name: 'Raj Kumar',   detail: 'Lieutenant', value: '−1,200 pts' },
                { initials: 'TC', color: 'warning' as const, name: 'Tara Chen',   detail: 'Sergeant',   value: '+540 pts'   },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar initials={item.initials} color={item.color} />
                    <div>
                      <Text variant="paragraph" weight="medium">{item.name}</Text>
                      <Text variant="paragraph" size="sm">{item.detail}</Text>
                    </div>
                  </div>
                  <Text variant="paragraph" weight="semibold">{item.value}</Text>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — Pricing (three tiers)
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / Pricing">
        <div className="flex flex-wrap gap-4 items-start">

          {/* Free */}
          <Card className="max-w-xs w-full">
            <CardBody className="flex flex-col gap-4">
              <div>
                <Badge color="gray">Free</Badge>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-bold text-gray-900 dark:text-white">$0</span>
                  <span className="font-body text-sm text-gray-500 dark:text-gray-400">/month</span>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  { text: '2 deck slots',       ok: true  },
                  { text: 'Up to 50 cards',     ok: true  },
                  { text: 'Battle analytics',   ok: false },
                  { text: 'Custom card art',    ok: false },
                  { text: 'Priority support',   ok: false },
                ].map(({ text, ok }) => (
                  <li key={text} className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 shrink-0 ${ok ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                    <Text variant="paragraph" size="sm" strikethrough={!ok}>{text}</Text>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full">Get started</Button>
            </CardBody>
          </Card>

          {/* Standard */}
          <Card className="max-w-xs w-full">
            <CardBody className="flex flex-col gap-4">
              <div>
                <Badge color="primary">Standard</Badge>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-bold text-gray-900 dark:text-white">$9</span>
                  <span className="font-body text-sm text-gray-500 dark:text-gray-400">/month</span>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  { text: '10 deck slots',      ok: true  },
                  { text: 'Up to 500 cards',    ok: true  },
                  { text: 'Battle analytics',   ok: true  },
                  { text: 'Custom card art',    ok: false },
                  { text: 'Priority support',   ok: false },
                ].map(({ text, ok }) => (
                  <li key={text} className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 shrink-0 ${ok ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                    <Text variant="paragraph" size="sm" strikethrough={!ok}>{text}</Text>
                  </li>
                ))}
              </ul>
              <Button className="w-full">Get started</Button>
            </CardBody>
          </Card>

          {/* Pro */}
          <Card className="max-w-xs w-full">
            <CardBody className="flex flex-col gap-4">
              <div>
                <Badge color="purple">Pro</Badge>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-bold text-gray-900 dark:text-white">$29</span>
                  <span className="font-body text-sm text-gray-500 dark:text-gray-400">/month</span>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  { text: 'Unlimited decks',    ok: true },
                  { text: 'Unlimited cards',    ok: true },
                  { text: 'Battle analytics',   ok: true },
                  { text: 'Custom card art',    ok: true },
                  { text: 'Priority support',   ok: true },
                ].map(({ text, ok }) => (
                  <li key={text} className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 shrink-0 ${ok ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                    <Text variant="paragraph" size="sm">{text}</Text>
                  </li>
                ))}
              </ul>
              <Button color="dark" className="w-full">Get started</Button>
            </CardBody>
          </Card>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD — Testimonial
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Card / Testimonial">
        <div className="flex flex-wrap gap-4 items-start">

          {[
            { initials: 'JL', color: 'primary' as const, name: 'Jane Lee',   role: 'Commander, 3rd Battalion', quote: 'BattleCards completely changed how I plan my campaigns. The card system is intuitive and endlessly customisable.' },
            { initials: 'RK', color: 'purple'  as const, name: 'Raj Kumar',  role: 'Tournament Organiser',     quote: 'Running a league of 40+ players used to be chaos. Now every deck is tracked, every battle logged — flawless.' },
            { initials: 'AM', color: 'success' as const, name: 'Alex Marsh', role: 'Competitive Player',       quote: 'The stats on every card tell me exactly where my army is weak. I\'ve won three tournaments since switching.' },
          ].map(({ initials, color, name, role, quote }) => (
            <Card key={name} className="max-w-xs w-full">
              <CardBody>
                <figure>
                  <svg
                    className="w-8 h-8 mb-3 text-gray-400 dark:text-gray-600"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 18 14"
                  >
                    <path d="M6 0H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3H2a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3h-1a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Z" />
                  </svg>
                  <blockquote>
                    <Text variant="paragraph" italic className="mb-4">"{quote}"</Text>
                  </blockquote>
                  <figcaption className="flex items-center gap-3 mt-4">
                    <Avatar initials={initials} color={color} />
                    <div>
                      <Text variant="paragraph" weight="semibold">{name}</Text>
                      <Text variant="paragraph" size="sm">{role}</Text>
                    </div>
                  </figcaption>
                </figure>
              </CardBody>
            </Card>
          ))}

        </div>
      </GallerySection>

      <GallerySection id="nav-dropdowns" title="Dropdown / Basic">
        {/* min-h gives the section space so the open menu doesn't clip */}
        <div className="flex flex-wrap gap-4" style={{ minHeight: 200 }}>

          <Dropdown trigger={<Button rightIcon={<AltArrowDown className="w-4 h-4" />}>Options</Button>}>
            <DropdownItem>Dashboard</DropdownItem>
            <DropdownItem>Settings</DropdownItem>
            <DropdownItem>Earnings</DropdownItem>
            <DropdownItem>Sign out</DropdownItem>
          </Dropdown>

          <Dropdown
            trigger={<Button variant="outline" rightIcon={<AltArrowDown className="w-4 h-4" />}>With icons</Button>}
          >
            <DropdownItem icon={<Pen2 className="w-4 h-4" />}>Edit</DropdownItem>
            <DropdownItem icon={<DownloadMinimalistic className="w-4 h-4" />}>Export</DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={<TrashBinMinimalistic className="w-4 h-4" />} onClick={() => {}}>Delete</DropdownItem>
          </Dropdown>

          <Dropdown
            trigger={<Button variant="ghost" color="secondary" rightIcon={<AltArrowDown className="w-4 h-4" />}>With header</Button>}
            align="right"
          >
            <DropdownHeader>
              <p className="font-semibold">Jane Lee</p>
              <p className="text-gray-500 dark:text-gray-400">jane@battlecards.app</p>
            </DropdownHeader>
            <DropdownDivider />
            <DropdownItem>Profile</DropdownItem>
            <DropdownItem>Settings</DropdownItem>
            <DropdownItem disabled>Admin panel</DropdownItem>
            <DropdownDivider />
            <DropdownItem>Sign out</DropdownItem>
          </Dropdown>

        </div>
      </GallerySection>

      <GallerySection id="nav-inputs" title="Input / Sizes">
        <div className="w-full max-w-sm space-y-3">
          <Input
            size="sm"
            placeholder="Small input"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CloseCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
          />
          <Input
            size="base"
            placeholder="Base input"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CloseCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
          />
          <Input
            size="lg"
            placeholder="Large input"
            leftIcon={<UserRounded className="w-5 h-5" />}
            rightElement={<CloseCircle className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          INPUT — States
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Input / States">
        <div className="w-full max-w-sm space-y-3">
          <Input
            label="Input Label"
            required
            placeholder="Value"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CloseCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
            helperText="This is a helper message."
          />
          <Input
            label="Input Label"
            required
            placeholder="Value"
            value="Filled value"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CloseCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
            helperText="This is a helper message."
            readOnly
          />
          <Input
            label="Input Label"
            required
            placeholder="Value"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CloseCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
            helperText="This is a helper message."
            disabled
          />
          <Input
            label="Input Label"
            required
            placeholder="Value"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CloseCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
            helperText="This is a helper message."
            readOnly
          />
          <Input
            label="Input Label"
            required
            state="success"
            placeholder="Value"
            value="Valid value"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CheckCircle className="w-4 h-4 text-green-500" />}
            helperText="This is a helper message."
          />
          <Input
            label="Input Label"
            required
            state="error"
            placeholder="Value"
            leftIcon={<UserRounded className="w-4 h-4" />}
            rightElement={<CloseCircle className="w-4 h-4 text-red-500" />}
            helperText="This is a helper message."
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          INPUT — With icons
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Input / With Icons">
        <div className="w-full max-w-sm space-y-3">
          <Input
            label="Search"
            placeholder="Search units..."
            leftIcon={<Magnifer className="w-4 h-4" />}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            rightElement={<Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@battlecards.app"
            leftIcon={<Letter className="w-4 h-4" />}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-select" title="Select / Sizes">
        <div className="w-full max-w-sm space-y-3">
          <Select size="sm" defaultValue="">
            <option value="" disabled>Small select</option>
            <option value="infantry">Infantry</option>
            <option value="cavalry">Cavalry</option>
          </Select>
          <Select size="base" defaultValue="">
            <option value="" disabled>Base select</option>
            <option value="infantry">Infantry</option>
            <option value="cavalry">Cavalry</option>
          </Select>
          <Select size="lg" defaultValue="">
            <option value="" disabled>Large select</option>
            <option value="infantry">Infantry</option>
            <option value="cavalry">Cavalry</option>
          </Select>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          SELECT — States
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Select / States">
        <div className="w-full max-w-sm space-y-3">
          <Select
            label="Select Label"
            required
            helperText="This is a helper message."
            defaultValue=""
          >
            <option value="" disabled>Select option</option>
            <option value="unsc">UNSC</option>
            <option value="covenant">Covenant</option>
          </Select>
          <Select
            label="Select Label"
            required
            helperText="This is a helper message."
            value="unsc"
            readOnly
            onChange={() => {}}
          >
            <option value="unsc">UNSC</option>
          </Select>
          <Select
            label="Select Label"
            required
            helperText="This is a helper message."
            defaultValue=""
            disabled
          >
            <option value="" disabled>Select option</option>
            <option value="unsc">UNSC</option>
          </Select>
          <Select
            label="Select Label"
            required
            state="success"
            helperText="This is a helper message."
            defaultValue="unsc"
          >
            <option value="unsc">UNSC</option>
            <option value="covenant">Covenant</option>
          </Select>
          <Select
            label="Select Label"
            required
            state="error"
            helperText="This is a helper message."
            defaultValue=""
          >
            <option value="" disabled>Select option</option>
            <option value="unsc">UNSC</option>
          </Select>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          SELECT — With Icon
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Select / With Icon">
        <div className="w-full max-w-sm space-y-3">
          <Select
            label="Faction"
            leftIcon={<Flag className="w-4 h-4" />}
            defaultValue=""
          >
            <option value="" disabled>Choose faction…</option>
            <option value="unsc">UNSC</option>
            <option value="covenant">Covenant</option>
            <option value="flood">Flood</option>
          </Select>
          <Select
            label="Unit Type"
            leftIcon={<Shield className="w-4 h-4" />}
            defaultValue=""
          >
            <option value="" disabled>Choose type…</option>
            <option value="infantry">Infantry</option>
            <option value="vehicle">Vehicle</option>
            <option value="air">Air Support</option>
          </Select>
        </div>
      </GallerySection>

      <GallerySection id="nav-checkboxes" title="Checkbox / Colors">
        <div className="flex flex-wrap gap-6">
          <Checkbox color="primary" label="Primary"  defaultChecked />
          <Checkbox color="red"     label="Red"      defaultChecked />
          <Checkbox color="green"   label="Green"    defaultChecked />
          <Checkbox color="purple"  label="Purple"   defaultChecked />
          <Checkbox color="teal"    label="Teal"     defaultChecked />
          <Checkbox color="yellow"  label="Yellow"   defaultChecked />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CHECKBOX — States
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Checkbox / States">
        <div className="space-y-4 max-w-sm">
          <Checkbox
            label="Default unchecked"
          />
          <Checkbox
            label="Default checked"
            defaultChecked
          />
          <Checkbox
            indeterminate
            label="Indeterminate (select all)"
          />
          <Checkbox
            label="Disabled"
            disabled
          />
          <Checkbox
            label="Disabled checked"
            disabled
            defaultChecked
          />
          <Checkbox
            label="Deploy units to the front line"
            helperText="Requires at least one unit in reserve."
            color="primary"
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-stars" title="Star Rating / Display">
        <div className="flex flex-col gap-3">
          <StarRating rating={5} />
          <StarRating rating={4} />
          <StarRating rating={3} />
          <StarRating rating={4} showLabel />
          <StarRating rating={4} count={128} />
          <StarRating rating={4} showLabel count={128} />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          STAR RATING — Sizes
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Star Rating / Sizes">
        <div className="flex flex-col gap-3">
          <StarRating rating={4} size="sm"   />
          <StarRating rating={4} size="base" />
          <StarRating rating={4} size="lg"   />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          STAR RATING — Interactive
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Star Rating / Interactive">
        <InteractiveStarDemo />
      </GallerySection>

      <GallerySection id="nav-tabs" title="Tabs / Default">
        <div className="w-full max-w-lg">
          <Tabs
            tabs={[
              { id: 'profile',   label: 'Profile',   content: <Text variant="paragraph">This is the Profile tab content.</Text> },
              { id: 'dashboard', label: 'Dashboard', content: <Text variant="paragraph">This is the Dashboard tab content.</Text> },
              { id: 'settings',  label: 'Settings',  content: <Text variant="paragraph">This is the Settings tab content.</Text> },
              { id: 'disabled',  label: 'Disabled',  content: <></>, disabled: true },
            ]}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TABS — Segmented
          The joined button group from the design system, themed on primary.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Tabs / Segmented">
        <div className="w-full max-w-lg">
          <Tabs
            variant="segmented"
            tabs={[
              { id: 'format',       label: 'Event Format', icon: <InfoCircle className="w-4 h-4" />,      content: <Text variant="paragraph">Event Format panel.</Text> },
              { id: 'registration', label: 'Registration',  icon: <UserPlusRounded className="w-4 h-4" />, content: <Text variant="paragraph">Registration panel.</Text> },
              { id: 'faq',          label: 'FAQ',           icon: <Notebook className="w-4 h-4" />,        content: <Text variant="paragraph">FAQ panel.</Text> },
            ]}
          />
        </div>
        <GalleryNote>
          The selected tab is a solid primary button and the rest are outlined,
          sharing edges with no gap between them. Unlike the other variants this
          one is themed from <code>primary-*</code> rather than blue and grey, so
          it takes on each app's accent — which is what the design system's
          Button Group does. The rounded corners live on the container, so the
          first and last buttons pick them up without either needing to know
          where it sits in the row.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TABS — Controlled
          Driven from outside the tab bar, for when something else also
          selects tabs.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Tabs / Controlled">
        <ControlledTabsGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TABS — Underline
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Tabs / Underline">
        <div className="w-full max-w-lg">
          <Tabs
            variant="underline"
            tabs={[
              { id: 'profile',   label: 'Profile',   content: <Text variant="paragraph">This is the Profile tab content.</Text> },
              { id: 'dashboard', label: 'Dashboard', content: <Text variant="paragraph">This is the Dashboard tab content.</Text> },
              { id: 'settings',  label: 'Settings',  content: <Text variant="paragraph">This is the Settings tab content.</Text> },
              { id: 'contacts',  label: 'Contacts',  content: <Text variant="paragraph">This is the Contacts tab content.</Text> },
            ]}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TABS — Pills
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Tabs / Pills">
        <div className="w-full max-w-lg">
          <Tabs
            variant="pills"
            tabs={[
              { id: 'stats',     label: 'Stats',     icon: <Star className="w-4 h-4" />,   content: <Text variant="paragraph">Unit statistics breakdown.</Text> },
              { id: 'abilities', label: 'Abilities', icon: <Shield className="w-4 h-4" />, content: <Text variant="paragraph">Active and passive abilities.</Text> },
              { id: 'lore',      label: 'Lore',      icon: <FileText className="w-4 h-4" />, content: <Text variant="paragraph">Background lore for this unit.</Text> },
            ]}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TABS — Full Width
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Tabs / Full Width">
        <div className="w-full max-w-lg">
          <Tabs
            variant="fullWidth"
            tabs={[
              { id: 'stats',     label: 'Stats',     content: <Text variant="paragraph">Unit statistics breakdown.</Text> },
              { id: 'abilities', label: 'Abilities', content: <Text variant="paragraph">Active and passive abilities.</Text> },
              { id: 'lore',      label: 'Lore',      content: <Text variant="paragraph">Background lore for this unit.</Text> },
            ]}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-hr" title="HR / Variants">
        <div className="w-full space-y-2">

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Default</p>
          <HR variant="default" />

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Trimmed</p>
          <HR variant="trimmed" />

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Text</p>
          <HR variant="text" label="or" />

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Icon</p>
          <HR
            variant="icon"
            icon={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            }
          />

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Shape</p>
          <HR variant="shape" />

        </div>
      </GallerySection>

      <GallerySection id="nav-column-header" title="Column Header / Default">
        <div className="flex flex-col gap-6 w-full max-w-sm">

          {/* Icon + title + description */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-5">
            <ColumnHeader
              icon={<Shield className="w-12 h-12 text-primary-500" />}
              title="My Battles"
              description="The games you've played, and how they went."
            />
          </div>

          {/* Title only (no description) */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-5">
            <ColumnHeader
              icon={<InfoCircle className="w-12 h-12 text-primary-500" />}
              title="News & Updates"
            />
          </div>

          {/* With the optional view toggle */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-5">
            <ColumnHeader
              icon={<Shield className="w-12 h-12 text-primary-500" />}
              title="My Battles"
              description="Switch between two views with the toggle."
              toggle={{
                value: columnHeaderView,
                onChange: setColumnHeaderView,
                options: [
                  { id: 'list',    icon: <ListCheck className="w-4 h-4" />, label: 'List view' },
                  { id: 'gallery', icon: <Gallery className="w-4 h-4" />,   label: 'Gallery view' },
                ],
              }}
            />
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-rich-text-editor" title="Rich Text Editor">
        <div className="max-w-md space-y-4">
          <p className="font-body text-xs text-gray-400 dark:text-gray-500">
            TipTap-based markdown editor with formatting toolbar. Used in the Add Rule modal.
          </p>
          <RichTextEditor
            value={"**Bold text**, *italic text*, and ~~strikethrough~~.\n\n- Bullet one\n- Bullet two\n\n> A blockquote"}
            onChange={() => {}}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-multi-select" title="Multi-Select / Default">
        <div className="flex flex-wrap gap-8 items-start">

          <div className="flex flex-col gap-2 w-52">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Empty</p>
            <MultiSelectDropdown
              label="Primary Attributes"
              required
              options={MULTI_OPTIONS}
              selected={[]}
              onChange={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2 w-52">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With values</p>
            <MultiSelectDropdown
              label="Primary Attributes"
              required
              options={MULTI_OPTIONS}
              selected={['Agility', 'Passing']}
              onChange={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2 w-52">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With disabled options</p>
            <MultiSelectDropdown
              label="Secondary Attributes"
              required
              options={MULTI_OPTIONS}
              selected={['General']}
              disabledOptions={['Agility', 'Passing']}
              onChange={() => {}}
            />
          </div>

        </div>
      </GallerySection>

      <GallerySection title="Multi-Select / Interactive (mutual exclusion)">
        <div className="flex flex-wrap gap-4 items-start">

          <div className="w-52">
            <MultiSelectDropdown
              label="Primary Attributes"
              required
              helperText="Used for league progression."
              options={MULTI_OPTIONS}
              selected={multiSelected}
              disabledOptions={multiSelected2}
              onChange={setMultiSelected}
            />
          </div>

          <div className="w-52">
            <MultiSelectDropdown
              label="Secondary Attributes"
              required
              helperText="Used for league progression."
              options={MULTI_OPTIONS}
              selected={multiSelected2}
              disabledOptions={multiSelected}
              onChange={setMultiSelected2}
            />
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-vr" title="VR / Variants">
        <div className="flex flex-wrap gap-10 items-start">

          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Default</p>
            <div className="h-32 flex">
              <VR />
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Default + indented</p>
            <div className="h-32 flex">
              <VR indented />
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Or</p>
            <div className="h-32 flex">
              <VR style="or" />
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Or + indented</p>
            <div className="h-32 flex">
              <VR style="or" indented />
            </div>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-banner" title="Banner">
        <div className="w-full space-y-3">

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Default (no icon, no dismiss)</p>
          <Banner>
            Scheduled maintenance on Sunday at 2 am UTC. Expect up to 30 minutes of downtime.
          </Banner>

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">With icon</p>
          <Banner icon={<InfoCircle className="w-4 h-4" />}>
            A new version of BattleCards is available — refresh to update.
          </Banner>

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">With icon + dismiss</p>
          <Banner
            icon={<Bell className="w-4 h-4" />}
            onDismiss={() => {}}
          >
            Your roster export is ready to download.
          </Banner>

        </div>
      </GallerySection>

      <GallerySection id="nav-callout" title="Callout">
        <div className="w-full max-w-2xl space-y-3">

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Default</p>
          <Callout>
            This is a default callout. Use it for neutral, informational messages.
          </Callout>

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Good</p>
          <Callout flavour="good">
            Unit added successfully to your roster.
          </Callout>

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Warning</p>
          <Callout flavour="warning">
            You're approaching your roster point limit — only 30 pts remaining.
          </Callout>

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">Bad</p>
          <Callout flavour="bad">
            Failed to save your card. Check your connection and try again.
          </Callout>

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">With dismiss</p>
          <Callout flavour="good" onDismiss={() => {}}>
            Card exported successfully.
          </Callout>

          <p className="font-body text-xs text-gray-400 dark:text-gray-500">No leading icon</p>
          <Callout flavour="warning" leadingIcon={false}>
            This action cannot be undone.
          </Callout>

        </div>
      </GallerySection>

      <GallerySection id="nav-game-logos" title="Game Logos">
        <div className="w-full space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Blood Bowl</p>
            <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center">
              <img
                src={logoBloodBowl}
                alt="Blood Bowl"
                className="h-16 object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Halo Flashpoint</p>
            <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center">
              <img
                src={logoHaloFlashpoint}
                alt="Halo Flashpoint"
                className="h-16 object-contain"
              />
            </div>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-selectable-list-item" title="Selectable List Item">
        <div className="w-full max-w-[523px] space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Three rows — first checked, second hovered (passive), third long-name truncation</p>
            <SelectableListItem name="BR55 Battle Rifle"   checked={true}  onCheckedChange={() => {}} />
            <SelectableListItem name="MA40 AR"             checked={false} onCheckedChange={() => {}} />
            <SelectableListItem
              name="A Very Long Weapon Name That Should Definitely Truncate At Some Point"
              checked={false}
              onCheckedChange={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With subtitle (source label, as used in the multi-source picker)</p>
            <SelectableListItem
              name="BR55 Battle Rifle"
              subtitle="Pack: Space Marines"
              checked={false}
              onCheckedChange={() => {}}
            />
            <SelectableListItem
              name="Spartan Zvezda"
              subtitle="Deck: My Halo Skirmish"
              checked={true}
              onCheckedChange={() => {}}
            />
            <SelectableListItem
              name="Stealth"
              subtitle="My Library"
              checked={false}
              onCheckedChange={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Disabled (e.g. submit in flight)</p>
            <SelectableListItem name="Tackle" checked={true} onCheckedChange={() => {}} disabled />
            <SelectableListItem name="Dodge"  checked={false} onCheckedChange={() => {}} disabled />
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-pagination" title="Pagination">
        <div className="w-full">
          <PaginationGalleryDemo />
        </div>
      </GallerySection>

      <GallerySection id="nav-markdown-body" title="Markdown Body">
        <div className="w-full max-w-xl space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Full size — colour themed by the caller (as used in Update Modal)
            </p>
            <MarkdownBody className="text-base leading-6 text-gray-300 [&_strong]:text-white [&_a]:text-blue-400">
              {MARKDOWN_SAMPLE}
            </MarkdownBody>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Clamped to 5 lines, SM Regular (as used in the News &amp; Updates cards)
            </p>
            <MarkdownBody className="text-sm leading-5 text-white line-clamp-5">
              {MARKDOWN_SAMPLE}
            </MarkdownBody>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-modal" title="Modal">
        <div className="w-full space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Click to open a modal overlay</p>
            <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
            <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
              <div className="p-5 flex flex-col gap-4">
                <h2 className="font-heading text-xl text-white">Example Modal</h2>
                <p className="font-body text-sm text-gray-300">
                  Click the backdrop or the button below to close.
                </p>
                <div className="flex justify-end">
                  <Button variant="outline" color="danger" onClick={() => setModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </Modal>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-welcome-modal" title="Welcome Modal">
        <div className="w-full space-y-6">
          <WelcomeModalGalleryDemo />
        </div>
      </GallerySection>

      <GallerySection id="nav-profile-modal" title="Profile Modal">
        <div className="w-full space-y-6">
          <ProfileModalGalleryDemo />
        </div>
      </GallerySection>

      <GallerySection id="nav-update-modal" title="Update Modal">
        <div className="w-full space-y-6">
          <UpdateModalGalleryDemo />
        </div>
      </GallerySection>

      <GallerySection id="nav-mode-toggle" title="ModeToggle / Edit &amp; Play">
        <div className="flex flex-wrap gap-6 items-start">
          {(() => {
            const [mode, setMode] = React.useState<Mode>('edit');
            return (
              <div className="flex flex-col gap-3">
                <Text size="sm" color="secondary">Interactive (click to toggle)</Text>
                <ModeToggle mode={mode} onModeChange={setMode} />
                <Text size="xs" color="secondary">Current: {mode}</Text>
              </div>
            );
          })()}
          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Edit active</Text>
            <ModeToggle mode="edit" onModeChange={() => {}} />
          </div>
          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Play active</Text>
            <ModeToggle mode="play" onModeChange={() => {}} />
          </div>
        </div>
      </GallerySection>


      {/* ════════════════════════════════════════════════════════════════
          BUTTON PAIR
          Two actions that sit side-by-side on mobile and stack from md up,
          reclaiming the vertical space two full-width buttons would eat.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-button-pair" title="Button Pair">
        <div className="w-full flex flex-wrap gap-8 items-start">
          <div className="w-72">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Default</p>
            <ButtonPair>
              <Button variant="outline" color="secondary">Cancel</Button>
              <Button>Save</Button>
            </ButtonPair>
          </div>

          <div className="w-72">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">
              With responsive labels (resize across 768px)
            </p>
            <ButtonPair>
              <Button variant="outline" color="secondary" leftIcon={<AddCircle className="w-4 h-4" />}>
                <span className="md:hidden">Add</span>
                <span className="hidden md:inline">Add to Collection</span>
              </Button>
              <Button leftIcon={<Diskette className="w-4 h-4" />}>
                <span className="md:hidden">Save</span>
                <span className="hidden md:inline">Save Changes</span>
              </Button>
            </ButtonPair>
          </div>

          <div className="w-72">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Destructive pair</p>
            <ButtonPair>
              <Button variant="outline" color="secondary">Keep</Button>
              <Button color="danger" leftIcon={<TrashBinMinimalistic className="w-4 h-4" />}>Delete</Button>
            </ButtonPair>
          </div>

          <GalleryNote>
            Wrap exactly two &lt;Button&gt;s — each is stretched to share the row below
            md and fill the column from md up.
          </GalleryNote>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          COLUMNS
          The three home-screen column frames. All share the ColumnShell
          chrome and ColumnHeader; they differ only in how the list
          navigates — paging vs scrolling vs bespoke.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-columns" title="Columns / Paginated, Scroll & Shell">
        {/* Each column is given a definite height and told to fill it. ColumnShell
            is `shrink-0` with no height of its own — in the app it stretches
            inside the home screen's flex row — so without `h-full` here it sizes
            to its content, spills out of the preview box, and (for the paginated
            one) makes useAutoPageSize measure a collapsed list and settle on a
            single row per page. */}
        <div className="w-full grid gap-6 lg:grid-cols-3 items-start">

          {/* PaginatedColumn — fills the space, pages with <Pagination> */}
          <div className="h-[420px]">
            <PaginatedColumn
              className="h-full"
              icon={<Shield className="w-12 h-12 text-primary-500" />}
              title="Paginated Column"
              description="Fills the visible space and pages. Best for uniform rows."
              items={DEMO_ROWS}
              getKey={r => r.id}
              renderItem={r => <DemoRow name={r.name} detail={r.detail} />}
              itemHeight={52}
              gap={6}
            />
          </div>

          {/* ScrollColumn — scrolls, with infinite-scroll wiring available */}
          <div className="h-[420px]">
            <ScrollColumn
              className="h-full"
              icon={<ListCheck className="w-12 h-12 text-primary-500" />}
              title="Scroll Column"
              description="Scrolls instead of paging. Best for variable-height content."
              items={DEMO_ROWS}
              getKey={r => r.id}
              renderItem={r => <DemoRow name={r.name} detail={r.detail} />}
            />
          </div>

          {/* ColumnShell — the bare frame, for a bespoke body */}
          <div className="h-[420px]">
            <ColumnShell className="h-full">
              <ColumnHeader
                icon={<Widget2 className="w-12 h-12 text-primary-500" />}
                title="Column Shell"
                description="Just the frame — supply your own body."
              />
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <p className="font-body text-sm text-gray-500 dark:text-gray-400 text-center px-4">
                  Anything can go here. Used by the rare column that needs a bespoke
                  body but the standard chrome.
                </p>
              </div>
            </ColumnShell>
          </div>
        </div>

        <div className="w-full grid gap-6 lg:grid-cols-2 items-start mt-6">
          {/* Empty + loading states */}
          <div className="h-[300px]">
            <PaginatedColumn
              className="h-full"
              icon={<Shield className="w-12 h-12 text-gray-400" />}
              title="Empty state"
              items={[]}
              getKey={(_, i) => i}
              renderItem={() => null}
              itemHeight={52}
              empty="No battles logged yet."
            />
          </div>
          <div className="h-[300px]">
            <ScrollColumn
              className="h-full"
              icon={<Shield className="w-12 h-12 text-gray-400" />}
              title="Loading state"
              items={[]}
              getKey={(_, i) => i}
              renderItem={() => null}
              loading
              loadingLabel="Loading battles…"
            />
          </div>
        </div>

        <GalleryNote>
          PaginatedColumn measures its own list to decide the page size
          (useAutoPageSize), so the number of rows per page changes with the height
          you give it — these previews are boxed at a fixed height to show that.
          Pass <code>wide</code> to double the desktop width.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          FRIENDS COLUMN
          The "My Friends" home-screen column. Unlike the presentational
          friends dialogs, this one fetches its own data.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-friends-column" title="Friends Column">
        {/* h-full for the same reason as the columns above — signed in with a few
            requests and friends this list is taller than the box, and without it
            the column spills over the caption below. */}
        <div className="w-full max-w-md h-[420px]">
          <FriendsColumn className="h-full" />
        </div>
        <GalleryNote>
          This column owns its data (useFriends), so it only fills in when the
          gallery is opened in a signed-in app — otherwise you see its loading and
          empty states. Requests and friends are two sections in one list, and each
          appears only when it has something in it, so a user with no pending
          requests never sees an empty "Friend Requests" heading. A request card
          deliberately shows only the @handle: the real name is private until you
          accept.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          SEARCH SELECT
          Single-select searchable dropdown with per-option icons. Matches
          Select's closed appearance but opens a floating search panel.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-search-select" title="Search Select">
        <SearchSelectGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          SHEET
          Bottom action-sheet on mobile, centred dialog on desktop.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-sheet" title="Sheet">
        <SheetGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          LIGHTBOX
          Full-screen image viewer with pinch / double-tap zoom.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-lightbox" title="Lightbox">
        <LightboxGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          HANDLE LINK
          An @handle that opens that user's profile modal.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-handle-link" title="Handle Link">
        <HandleLinkGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          IMPERSONATION BANNER
          Persistent reminder that an admin is viewing as someone else.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-impersonation-banner" title="Impersonation Banner">
        <ImpersonationBannerGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BUILDER SHELL
          The three-column editor layout and its two aside panels. Shared by
          BattleCards' card builders and BattlePack's pack editor; the centre
          column is a plain slot, so each app supplies its own.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-builder-shell" title="Builder Shell">
        <BuilderShellGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          STEP PROGRESS
          Where you are in a multi-step flow.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-step-progress" title="Step Progress">
        <StepProgressGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          PICKER TILE
          A row of exclusive choices, each explaining what it means.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-picker-tile" title="Picker Tile">
        <PickerTileGalleryDemo />
      </GallerySection>

      <GallerySection title="Builder Shell / ListPanel">
        <div className="w-64 h-[480px] flex flex-col bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <ListPanel
            title="UNSC Strike Team"
            editingTitle={false}
            inputRef={{ current: null }}
            onStartEdit={() => {}}
            onCommit={() => {}}
            onCancelEdit={() => {}}
            footer={
              <Button leftIcon={<AddCircle className="w-4 h-4" />} variant="outline" size="sm" className="w-full">
                Add Unit
              </Button>
            }
          >
            <DemoListRow label="Spartan CQB" active />
            <DemoListRow label="ODST Demolition" />
            <DemoListRow label="Marine Squad" />
          </ListPanel>
        </div>

        {/* With a header action slot (e.g. edit-mode toggle) and a subtitle line */}
        <div className="w-64 h-[480px] flex flex-col bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <ListPanel
            title="Banished Vanguard"
            editingTitle={false}
            inputRef={{ current: null }}
            onStartEdit={() => {}}
            onCommit={() => {}}
            onCancelEdit={() => {}}
            headerSubtitle={
              <p className="font-body text-xs font-bold text-gray-500 uppercase tracking-[1.2px] truncate">
                370 Points
              </p>
            }
            headerAction={
              <button className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white" title="Edit deck">
                <Pen2 className="w-4 h-4" />
              </button>
            }
            footer={
              <Button leftIcon={<AddCircle className="w-4 h-4" />} variant="outline" size="sm" className="w-full">
                Add Unit
              </Button>
            }
          >
            <DemoListRow label="Elite Honor Guard" />
            <DemoListRow label="Brute Chieftain" active />
            <DemoListRow label="Jackal Sniper" />
          </ListPanel>
        </div>

        {/* Mid-rename — the state the inline editor is in after a double-click */}
        <div className="w-64 h-[480px] flex flex-col bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <ListPanel
            title="Season 6 League"
            editingTitle
            inputRef={{ current: null }}
            onStartEdit={() => {}}
            onCommit={() => {}}
            onCancelEdit={() => {}}
          >
            <DemoListRow label="Event Basics" active />
            <DemoListRow label="Event Timeline" />
          </ListPanel>
        </div>

        <GalleryNote>
          The left aside. It titles a deck in BattleCards and a pack in
          BattlePack, so the prop is `title`, not either. The rows, the header
          action and the footer are all caller-owned slots — the rows here are
          plain stand-ins.
        </GalleryNote>
      </GallerySection>

      <GallerySection title="Builder Shell / EditorPanel">
        <div className="w-64 h-[480px] flex flex-col bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <EditorPanel title="Edit Card">
            <Input label="Unit Name" placeholder="e.g. Spartan CQB" value="Spartan CQB" onChange={() => {}} />
            <Counter label="Hit Points" value={3} onChange={() => {}} />
            <Counter label="Armour"     value={2} onChange={() => {}} />
            <Counter label="Points"     value={120} onChange={() => {}} />
          </EditorPanel>
        </div>

        <div className="w-64 h-[480px] flex flex-col bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <EditorPanel
            title="Event Basics"
            headerAction={
              <button className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white" title="Close">
                <CloseCircle className="w-4 h-4" />
              </button>
            }
          >
            <Input label="Event Name" placeholder="e.g. Season 6 League" value="Season 6 League" onChange={() => {}} />
            <p className="font-body text-xs text-gray-400">
              Hand-written helper copy sits under the fields — that is why each
              form is bespoke rather than generated.
            </p>
          </EditorPanel>
        </div>

        <GalleryNote>
          The right aside — a sticky heading over a scrolling body, and nothing
          else. Every form inside it is written by the page.
        </GalleryNote>
      </GallerySection>

    </>
  );
};

export default SharedGallerySections;
