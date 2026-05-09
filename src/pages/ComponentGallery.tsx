/**
 * ComponentGallery.tsx — Component Gallery Page
 *
 * A living reference for every UI component in the app.
 * This page is a development tool only — not a screen users will see.
 *
 * HOW TO USE:
 * As new components are built, import them here and add a <GallerySection>
 * below. Show every meaningful variant and state so components can be
 * reviewed and tweaked in isolation from the pages that use them.
 *
 * Navigate to this page at: http://localhost:5173/gallery
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Text from '../components/Text';
import List from '../components/List';
import TextLink from '../components/TextLink';
import HR from '../components/HR';
import Navbar from '../components/Navbar';
import Sidebar, { SidebarItem } from '../components/Sidebar';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Avatar, { AvatarGroup } from '../components/Avatar';
import Card, { CardImage, CardBody } from '../components/Card';
import Dropdown, { DropdownItem, DropdownDivider, DropdownHeader } from '../components/Dropdown';
import Input from '../components/Input';
import Select from '../components/Select';
import Counter from '../components/Counter';
import UnitListEntry from '../components/UnitListEntry';
import Checkbox from '../components/Checkbox';
import StarRating from '../components/StarRating';
import Tabs from '../components/Tabs';
import { RAW_PALETTE, SEMANTIC_PALETTE, type ColorFamily } from '../data/colors';
import heroImage from '../assets/hero.png';
import BloodBowlCard from '../components/BloodBowlCard';
import HaloFlashpointCard from '../components/HaloFlashpointCard';
import StarcraftCard from '../components/StarcraftCard';
import StarcraftPhaseFrame from '../components/StarcraftPhaseFrame';
import HaloFlashpointRuleCard from '../components/HaloFlashpointRuleCard';
import KillTeamCard from '../components/KillTeamCard';
import KillTeamRuleCard from '../components/KillTeamRuleCard';
import AddonInfoModal from '../components/AddonInfoModal';
import Card3DWrapper from '../components/Card3DWrapper';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import VR from '../components/VR';
import Banner from '../components/Banner';
import Callout from '../components/Callout';
import logoBloodBowl from '../assets/games/logo-blood-bowl.png';
import logoHaloFlashpoint from '../assets/games/logo-halo-flashpoint.png';
import DeckListItem from '../components/DeckListItem';
import AddonListItem from '../components/AddonListItem';
import RichTextEditor from '../components/RichTextEditor';
import AddAddonModal, { type AddonFormProps } from '../components/AddAddonModal';
import AddKeywordModal from '../components/AddKeywordModal';
import KeywordInfoModal from '../components/KeywordInfoModal';
import WeaponInfoModal from '../components/WeaponInfoModal';
import ImportListModal from '../components/ImportListModal';
import SaveTemplateModal from '../components/SaveTemplateModal';
import NewCardModal, { type NewCardModalTemplate } from '../components/NewCardModal';
import BlogEntryPreview from '../components/BlogEntryPreview';
import Modal from '../components/Modal';
import UploadPhotoModal from '../components/UploadPhotoModal';
import GamePickerItem from '../components/GamePickerItem';
import ModeToggle, { type Mode } from '../components/ModeToggle';
import PlaySubnav, { type PlayTab } from '../components/PlaySubnav';
import EditSubnav from '../components/EditSubnav';
import BuilderShell from '../components/BuilderShell';
import CardListPanel from '../components/CardListPanel';
import EditorPanel from '../components/EditorPanel';
import CenterViewport from '../components/CenterViewport';
import TokenMenu from '../components/TokenMenu';
import TokenOverlay from '../components/TokenOverlay';
import PrintCardGrid from '../components/PrintCardGrid';
import type { TokenDefinition } from '../lib/database.types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces, TS path resolver struggles but Vite handles fine
import iconBloodBowl from '../assets/games/card assets/blood-bowl/icon.png';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import iconHalo from '../assets/games/card assets/halo/icon.png';

// ── Icon imports (Solar Linear) ───────────────────────────────────────────────
import Home             from '../icons/Home';
import Magnifer         from '../icons/Magnifer';
import Bell             from '../icons/Bell';
import BellBing         from '../icons/BellBing';
import Settings         from '../icons/Settings';
import Star             from '../icons/Star';
import Bookmark         from '../icons/Bookmark';
import Heart            from '../icons/Heart';
import Rocket           from '../icons/Rocket';
import Shield           from '../icons/Shield';
import Flag             from '../icons/Flag';
import AddCircle        from '../icons/AddCircle';
import MinusCircle      from '../icons/MinusCircle';
import CheckCircle      from '../icons/CheckCircle';
import CloseCircle      from '../icons/CloseCircle';
import InfoCircle       from '../icons/InfoCircle';
import DangerCircle     from '../icons/DangerCircle';
import QuestionCircle   from '../icons/QuestionCircle';
import Pen2             from '../icons/Pen2';
import TrashBinMinimalistic  from '../icons/TrashBinMinimalistic';
import DownloadMinimalistic  from '../icons/DownloadMinimalistic';
import UploadMinimalistic    from '../icons/UploadMinimalistic';
import Diskette         from '../icons/Diskette';
import Share            from '../icons/Share';
import Filter           from '../icons/Filter';
import MenuDots         from '../icons/MenuDots';
import Eye              from '../icons/Eye';
import EyeClosed        from '../icons/EyeClosed';
import Lock             from '../icons/Lock';
import LockUnlocked     from '../icons/LockUnlocked';
import ArrowLeft        from '../icons/ArrowLeft';
import ArrowRight       from '../icons/ArrowRight';
import ArrowUp          from '../icons/ArrowUp';
import ArrowDown        from '../icons/ArrowDown';
import AltArrowLeft     from '../icons/AltArrowLeft';
import AltArrowRight    from '../icons/AltArrowRight';
import AltArrowUp       from '../icons/AltArrowUp';
import AltArrowDown     from '../icons/AltArrowDown';
import UserRounded      from '../icons/UserRounded';
import UsersGroupRounded from '../icons/UsersGroupRounded';
import UserPlusRounded  from '../icons/UserPlusRounded';
import UserCircle       from '../icons/UserCircle';
import Widget2          from '../icons/Widget2';
import ListCheck        from '../icons/ListCheck';
import Inbox            from '../icons/Inbox';
import Letter           from '../icons/Letter';
import Gallery          from '../icons/Gallery';
import FileText         from '../icons/FileText';
import Folder           from '../icons/Folder';
import Clipboard        from '../icons/Clipboard';
import Play             from '../icons/Play';
import Pause            from '../icons/Pause';
import Stop             from '../icons/Stop';
import Microphone       from '../icons/Microphone';
import Videocamera      from '../icons/Videocamera';
import Moon             from '../icons/Moon';
import Sun              from '../icons/Sun';

// ── Icon imports (Solar Bold) ─────────────────────────────────────────────────
import HomeBold             from '../icons/bold/Home';
import MagniferBold         from '../icons/bold/Magnifer';
import BellBold             from '../icons/bold/Bell';
import BellBingBold         from '../icons/bold/BellBing';
import SettingsBold         from '../icons/bold/Settings';
import StarBold             from '../icons/bold/Star';
import BookmarkBold         from '../icons/bold/Bookmark';
import HeartBold            from '../icons/bold/Heart';
import RocketBold           from '../icons/bold/Rocket';
import ShieldBold           from '../icons/bold/Shield';
import FlagBold             from '../icons/bold/Flag';
import AddCircleBold        from '../icons/bold/AddCircle';
import MinusCircleBold      from '../icons/bold/MinusCircle';
import CheckCircleBold      from '../icons/bold/CheckCircle';
import CloseCircleBold      from '../icons/bold/CloseCircle';
import InfoCircleBold       from '../icons/bold/InfoCircle';
import DangerCircleBold     from '../icons/bold/DangerCircle';
import QuestionCircleBold   from '../icons/bold/QuestionCircle';
import Pen2Bold             from '../icons/bold/Pen2';
import TrashBinMinimalisticBold  from '../icons/bold/TrashBinMinimalistic';
import DownloadMinimalisticBold  from '../icons/bold/DownloadMinimalistic';
import UploadMinimalisticBold    from '../icons/bold/UploadMinimalistic';
import DisketteBold         from '../icons/bold/Diskette';
import ShareBold            from '../icons/bold/Share';
import FilterBold           from '../icons/bold/Filter';
import MenuDotsBold         from '../icons/bold/MenuDots';
import EyeBold              from '../icons/bold/Eye';
import EyeClosedBold        from '../icons/bold/EyeClosed';
import LockBold             from '../icons/bold/Lock';
import LockUnlockedBold     from '../icons/bold/LockUnlocked';
import UserRoundedBold      from '../icons/bold/UserRounded';
import UsersGroupRoundedBold from '../icons/bold/UsersGroupRounded';
import UserPlusRoundedBold  from '../icons/bold/UserPlusRounded';
import UserCircleBold       from '../icons/bold/UserCircle';
import Widget2Bold          from '../icons/bold/Widget2';
import ListCheckBold        from '../icons/bold/ListCheck';
import InboxBold            from '../icons/bold/Inbox';
import LetterBold           from '../icons/bold/Letter';
import GalleryBold          from '../icons/bold/Gallery';
import FileTextBold         from '../icons/bold/FileText';
import FolderBold           from '../icons/bold/Folder';
import ClipboardBold        from '../icons/bold/Clipboard';
import PlayBold             from '../icons/bold/Play';
import PauseBold            from '../icons/bold/Pause';
import StopBold             from '../icons/bold/Stop';
import MicrophoneBold       from '../icons/bold/Microphone';
import VideocameraBold      from '../icons/bold/Videocamera';
import MoonBold             from '../icons/bold/Moon';
import SunBold              from '../icons/bold/Sun';

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

// ── BuilderShellDemo ──────────────────────────────────────────────────────────

/** Inline preview of <BuilderShell> + <CardListPanel> + <EditorPanel> +
 *  <CenterViewport> composed together. Stateful so the deck-name rename
 *  and mobile panel toggles are demonstrable. */
const BuilderShellDemo = () => {
  const [cardListOpen, setCardListOpen] = React.useState(false);
  const [editorOpen,   setEditorOpen]   = React.useState(false);
  const [deckName,     setDeckName]     = React.useState<string | null>('Demo Deck');
  const [editingName,  setEditingName]  = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditingName(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const commit = (n: string) => {
    const trimmed = n.trim();
    setEditingName(false);
    if (trimmed) setDeckName(trimmed);
  };

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 [&>div]:!h-full">
      <BuilderShell
        navbar={<Navbar fixed={false} />}
        topBar={
          <EditSubnav
            className="lg:hidden"
            cardListOpen={cardListOpen}
            onToggleCardList={() => { setCardListOpen(o => !o); setEditorOpen(false); }}
            editorOpen={editorOpen}
            onToggleEditor={() => { setEditorOpen(o => !o); setCardListOpen(false); }}
          />
        }
        leftPanelOpen={cardListOpen}
        leftPanel={
          <CardListPanel
            deckName={deckName}
            editingDeckName={editingName}
            inputRef={inputRef}
            onStartEdit={startEdit}
            onCommit={commit}
            onCancelEdit={() => setEditingName(false)}
            footer={
              <Button leftIcon={<AddCircle className="w-4 h-4" />} variant="outline" size="sm" className="w-full">
                Add Unit
              </Button>
            }
          >
            <UnitListEntry status="complete" unitName="Spartan CQB"     active />
            <UnitListEntry status="complete" unitName="ODST Demolition"        />
            <UnitListEntry status="blank"                                      />
          </CardListPanel>
        }
        center={
          <CenterViewport logo={<img src={logoHaloFlashpoint} alt="Halo Flashpoint" className="h-10 w-auto" />}>
            <div className="flex-1 min-h-0 w-full flex items-center justify-center text-gray-500 font-body text-sm">
              {/* Carousel placeholder — real builders mount <CardCarousel> here */}
              [ CardCarousel ]
            </div>
          </CenterViewport>
        }
        rightPanelOpen={editorOpen}
        rightPanel={
          <EditorPanel title="Edit Card">
            <Input label="Unit Name" placeholder="e.g. Spartan CQB" value="Spartan CQB" onChange={() => {}} />
            <Counter label="Hit Points" value={3} onChange={() => {}} />
          </EditorPanel>
        }
      />
    </div>
  );
};

// ── Gallery wrapper ───────────────────────────────────────────────────────────

const MULTI_OPTIONS = ['Agility', 'General', 'Mutations', 'Passing', 'Strength', 'Devious'];

const ComponentGallery = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counterDefault, setCounterDefault] = useState(1);
  const [counterSuccess, setCounterSuccess] = useState(3);
  const [counterError,   setCounterError]   = useState(0);
  const [multiSelected,  setMultiSelected]  = useState<string[]>([]);
  const [multiSelected2, setMultiSelected2] = useState<string[]>([]);
  const [modalOpen,          setModalOpen]          = useState(false);
  const [uploadPhotoOpen,    setUploadPhotoOpen]    = useState(false);
  const [addonModalOpen,     setAddonModalOpen]     = useState(false);
  const [keywordModalOpen,   setKeywordModalOpen]   = useState(false);
  const [keywordInfoOpen,    setKeywordInfoOpen]    = useState(false);
  const [weaponInfoOpen,     setWeaponInfoOpen]     = useState(false);
  const [importListOpen,     setImportListOpen]     = useState(false);
  const [saveTemplateOpen,   setSaveTemplateOpen]   = useState(false);
  const [saveTemplatePrefill,setSaveTemplatePrefill]= useState(false);
  const [newCardOpen,        setNewCardOpen]        = useState(false);
  const [newCardHasTemplates,setNewCardHasTemplates]= useState(true);
  const [addonInfoWeapon,    setAddonInfoWeapon]    = useState(false);
  const [addonInfoAbility,   setAddonInfoAbility]   = useState(false);

  const galleryTemplates: NewCardModalTemplate[] = [
    { id: 't1', name: 'Spartan Sergeant' },
    { id: 't2', name: 'Elite Honor Guard' },
    { id: 't3', name: 'ODST Demolition' },
    { id: 't4', name: 'Grunt Squad Leader' },
    { id: 't5', name: 'Jackal Sniper' },
    { id: 't6', name: 'Brute Chieftain' },
  ];
  const [selectedAddonId,    setSelectedAddonId]    = useState<string | null>(null);
  const [pickedGame,     setPickedGame]     = useState<string | null>(null);
  return (
    // The gallery uses Tailwind's light/dark bg so components are previewed
    // against the correct background colour in both modes.
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* ── Gallery navigation sidebar ──────────────────────────────────
          Provides anchor-link navigation to every component section.
          On desktop it is always visible; on mobile it slides in when
          sidebarOpen=true (toggled by the hamburger button below).
      ────────────────────────────────────────────────────────────────── */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <SidebarItem href="#nav-navbar"     icon={<Home className="w-5 h-5" />}              label="Navbar"      />
        <SidebarItem href="#nav-sidebar"    icon={<ListCheck className="w-5 h-5" />}         label="Sidebar"     />
        <SidebarItem href="#nav-icons"      icon={<Widget2 className="w-5 h-5" />}           label="Icons"       />
        <SidebarItem href="#nav-colours"    icon={<Gallery className="w-5 h-5" />}           label="Colours"     />
        <SidebarItem href="#nav-text"       icon={<FileText className="w-5 h-5" />}          label="Text"        />
        <SidebarItem href="#nav-lists"      icon={<Clipboard className="w-5 h-5" />}         label="Lists"       />
        <SidebarItem href="#nav-links"      icon={<ArrowRight className="w-5 h-5" />}        label="Links"       />
        <SidebarItem href="#nav-hr"         icon={<MinusCircle className="w-5 h-5" />}       label="HR"          />
        <SidebarItem href="#nav-buttons"    icon={<Rocket className="w-5 h-5" />}            label="Buttons"     />
        <SidebarItem href="#nav-counter"    icon={<AddCircle className="w-5 h-5" />}         label="Counter"     />
        <SidebarItem href="#nav-badges"     icon={<Shield className="w-5 h-5" />}            label="Badges"      />
        <SidebarItem href="#nav-avatars"    icon={<UserRounded className="w-5 h-5" />}       label="Avatars"     />
        <SidebarItem href="#nav-cards"      icon={<Bookmark className="w-5 h-5" />}          label="Cards"       />
        <SidebarItem href="#nav-dropdowns"  icon={<AltArrowDown className="w-5 h-5" />}      label="Dropdowns"   />
        <SidebarItem href="#nav-inputs"     icon={<Inbox className="w-5 h-5" />}             label="Inputs"      />
        <SidebarItem href="#nav-select"     icon={<AltArrowDown className="w-5 h-5" />}      label="Select"      />
        <SidebarItem href="#nav-checkboxes" icon={<CheckCircle className="w-5 h-5" />}       label="Checkboxes"  />
        <SidebarItem href="#nav-stars"      icon={<Star className="w-5 h-5" />}              label="Star Rating" />
        <SidebarItem href="#nav-tabs"       icon={<Filter className="w-5 h-5" />}            label="Tabs"        />
        <SidebarItem href="#nav-bb-card"      icon={<Shield className="w-5 h-5" />}            label="BB Card"     />
        <SidebarItem href="#nav-sc-card"      icon={<Shield className="w-5 h-5" />}            label="SC Card"     />
        <SidebarItem href="#nav-sc-phase-frame" icon={<Shield className="w-5 h-5" />}          label="SC Phase Frame" />
        <SidebarItem href="#nav-kill-team-card" icon={<Shield className="w-5 h-5" />}          label="KT Card" />
        <SidebarItem href="#nav-kill-team-rule-card" icon={<Shield className="w-5 h-5" />}     label="KT Rule Card" />
        <SidebarItem href="#nav-addon-info-modal" icon={<Shield className="w-5 h-5" />}        label="Addon Info Modal" />
        <SidebarItem href="#nav-multi-select" icon={<CheckCircle className="w-5 h-5" />}        label="Multi-Select" />
        <SidebarItem href="#nav-vr"           icon={<MinusCircle className="w-5 h-5" />}        label="VR"           />
        <SidebarItem href="#nav-banner"       icon={<Bell className="w-5 h-5" />}               label="Banner"       />
        <SidebarItem href="#nav-callout"      icon={<InfoCircle className="w-5 h-5" />}         label="Callout"      />
        <SidebarItem href="#nav-game-logos"       icon={<Gallery className="w-5 h-5" />}            label="Game Logos"       />
        <SidebarItem href="#nav-deck-list-item"    icon={<Gallery className="w-5 h-5" />}            label="Deck List Item"   />
        <SidebarItem href="#nav-blog-entry-preview" icon={<Gallery className="w-5 h-5" />}           label="Blog Entry Preview" />
        <SidebarItem href="#nav-modal"              icon={<Gallery className="w-5 h-5" />}            label="Modal"            />
        <SidebarItem href="#nav-upload-photo-modal" icon={<Gallery className="w-5 h-5" />}            label="Upload Photo Modal" />
        <SidebarItem href="#nav-save-template-modal" icon={<Gallery className="w-5 h-5" />}           label="Save Template Modal" />
        <SidebarItem href="#nav-new-card-modal"     icon={<Gallery className="w-5 h-5" />}            label="New Card Modal" />
        <SidebarItem href="#nav-game-picker-item"   icon={<Gallery className="w-5 h-5" />}            label="Game Picker Item" />
        <SidebarItem href="#nav-builder-shell"      icon={<Widget2 className="w-5 h-5" />}            label="Builder Shell"   />
      </Sidebar>

      {/* ── Main content — offset on desktop to clear the sidebar ──────── */}
      <div className="sm:ml-64 px-10 py-12">

        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="mb-2 flex items-center gap-3">

          {/* Hamburger — mobile only */}
          <button
            className="sm:hidden shrink-0 p-1.5 rounded-lg
                       text-gray-500 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <ListCheck className="w-5 h-5" />
          </button>

          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900 dark:text-white">
              Component Gallery
            </h1>
            <p className="font-body text-sm text-gray-500 dark:text-gray-400 mt-1">
              A reference for every UI component used in BattleCards.
            </p>
          </div>

        </div>
        <Link to="/" className="font-body text-xs text-blue-500 hover:underline">
          ← Back to app
        </Link>

        <HR variant="default" />

      {/* ════════════════════════════════════════════════════════════════
          NAVBAR
          Responsive top navigation bar. Fixed in production; rendered
          in a bounded preview container here in the gallery.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-navbar" title="Navbar / Default">

        {/* Preview wrapper — simulates a page viewport at reduced size */}
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">

          {/* Navbar rendered with fixed=false so it stays inside the preview */}
          <Navbar fixed={false} />

          {/* Simulated page body beneath the navbar */}
          <div className="h-24 bg-gray-50 dark:bg-gray-950 flex items-center
                          justify-center px-4">
            <p className="font-body text-xs text-gray-400 italic">
              Page content sits here
            </p>
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          SIDEBAR
          Off-canvas drawer on mobile, persistent panel on desktop.
          Previewed at fixed width here in the gallery.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-sidebar" title="Sidebar / Default">

        {/* Preview wrapper — clips the sidebar to a fixed area */}
        <div className="w-full rounded-xl overflow-hidden border border-gray-200
                        dark:border-gray-700 flex" style={{ height: 320 }}>

          {/* Sidebar rendered statically (always open) for gallery preview */}
          <div className="relative shrink-0" style={{ width: 256 }}>
            <Sidebar
              isOpen={true}
              width="w-full"
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

      {/* ════════════════════════════════════════════════════════════════
          ICONS — Solar Icon Set
          Solar Linear (linear) + Solar Bold (bold)
          GitHub: https://github.com/480-Design/Solar-Icon-Set
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          COLOUR PALETTE — Raw
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          TEXT — Headings
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          LISTS
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          LISTS — Units
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection title="Lists / Units">
        <div className="w-full max-w-sm space-y-4">

          {/* Default state — all statuses */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Default</p>
            <div className="space-y-1">
              <UnitListEntry status="blank" />
              <UnitListEntry status="complete" unitName="Jane-664"        unitType="Spartan ZVEZDA" />
              <UnitListEntry status="pending"  unitName="Mk. VII Warrior" unitType="UNSC Marine"   />
            </div>
          </div>

          {/* Active state — all statuses */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Active</p>
            <div className="space-y-1">
              <UnitListEntry status="blank"    active />
              <UnitListEntry status="complete" active unitName="Jane-664"        unitType="Spartan ZVEZDA" />
              <UnitListEntry status="pending"  active unitName="Mk. VII Warrior" unitType="UNSC Marine"   />
            </div>
          </div>

          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Edit Mode</p>
            <div className="space-y-1">
              <UnitListEntry status="complete" editMode unitName="Jane-664"        unitType="Spartan ZVEZDA" onDuplicate={() => {}} onDelete={() => {}} />
              <UnitListEntry status="complete" editMode active unitName="Mk. VII Warrior" unitType="UNSC Marine" onDuplicate={() => {}} onDelete={() => {}} />
              <UnitListEntry status="blank"    editMode onDuplicate={() => {}} onDelete={() => {}} />
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          LINKS
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          BUTTON — Filled
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          COUNTER
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          BADGE — Solid
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          AVATAR — Sizes
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          AVATAR — With Text (composition pattern)
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          CARD — Default & With Button & With Link
          Simple text-only cards with increasing interaction.
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          DROPDOWN — Basic
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          INPUT — Sizes
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          SELECT — Sizes
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          CHECKBOX — Colors
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          STAR RATING — Display
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          TABS — Default (background highlight)
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          HORIZONTAL RULES
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ── Blood Bowl Card ────────────────────────────────────────────── */}
      <GallerySection id="nav-bb-card" title="Blood Bowl Card / Default">
        <div className="flex flex-wrap gap-8 items-start">

          {/* Empty / placeholder state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Empty state (default props)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 278, height: Math.round(1100 * (278 / 750)) }}>
              <div style={{ transform: `scale(${278 / 750})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <BloodBowlCard />
              </div>
            </div>
          </div>

          {/* Filled state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Filled state
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 278, height: Math.round(1100 * (278 / 750)) }}>
              <div style={{ transform: `scale(${278 / 750})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <BloodBowlCard
                  teamName="Imperial Nobility"
                  unitName="Noble Blitzer"
                  cost={90}
                  ma={6}
                  st={3}
                  ag={3}
                  pa={4}
                  av={9}
                  skills="Block, Catch, Dump-Off"
                  primaryAttribute="Passing"
                  secondaryAttribute="Agility"
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ── Halo Flashpoint Card ──────────────────────────────────────── */}
      <GallerySection id="nav-halo-card" title="Halo Flashpoint Card / Default">
        <div className="flex flex-wrap gap-8 items-start">

          {/* Empty / placeholder state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Empty state (default props)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 508, height: Math.round(890 * (508 / 1270)) }}>
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <HaloFlashpointCard />
              </div>
            </div>
          </div>

          {/* Filled state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Filled state
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 508, height: Math.round(890 * (508 / 1270)) }}>
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <HaloFlashpointCard
                  unitName="Spartan Zvezda"
                  keywords="Energy Shield (2), Scout"
                  ra={4}
                  fi={5}
                  sv={4}
                  advanceValue={1}
                  sprintValue={3}
                  ar={2}
                  hp={4}
                  weapons={[
                    { type: 'Close Combat', name: 'Fists',           range: 'CC', ap: '-', keywords: '-'                        },
                    { type: 'Ranged',       name: 'BR55 Battle Rifle', range: 'R5', ap: '1', keywords: 'Optics, Weight of Fire (1)' },
                  ]}
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ── Starcraft Card ─────────────────────────────────────────────── */}
      <GallerySection id="nav-sc-card" title="StarCraft Card / Default">
        <div className="flex flex-col gap-8 items-start">

          {/* Empty / placeholder state */}
          <div className="flex flex-col gap-2 items-start">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Empty state (default props) — chrome SVG is transparent for now
            </p>
            <div className="relative overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800" style={{ width: 508, height: Math.round(890 * (508 / 1270)) }}>
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <StarcraftCard />
              </div>
            </div>
          </div>

          {/* Populated — Marine example from the Figma design */}
          <div className="flex flex-col gap-2 items-start">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Populated — Terran Marine (with parent/child weapons and abilities)
            </p>
            <div className="relative overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800" style={{ width: 760, height: Math.round(890 * (760 / 1270)) }}>
              <div style={{ transform: `scale(${760 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <StarcraftCard
                  unitType="Marine"
                  speed={4}
                  evade={5}
                  armour={5}
                  hitPoints={2}
                  size={2}
                  supplyTiers={[
                    { maxModels: 3, supply: 1 },
                    { maxModels: 6, supply: 2 },
                    { maxModels: 9, supply: 3 },
                  ]}
                  abilities={[
                    { id: 'stimpack',    name: 'Stimpack',         phase: 'movement', timing: 'active',   cpCost: 1, description: 'Gain Non-Lethal Damage (3). This unit gains Buff Speed (2) and C-14 Rifle gains Precision (3).' },
                    { id: 'shield',      name: 'Shield',           phase: 'assault',  timing: 'reaction', cpCost: 1, description: 'Gain Non-Lethal Damage (3). This unit gains Buff Speed (2) and C-14 Rifle gains Precision (3).' },
                    { id: 'slugthrower', name: 'Slugthrower',      phase: 'assault',  timing: 'passive',             description: 'Gain Non-Lethal Damage (3). This unit gains Buff Speed (2) and C-14 Rifle gains Precision (3).' },
                    { id: 'grenades',    name: 'Grenades — Frag',  phase: 'assault',  timing: 'passive',             description: 'Gain Non-Lethal Damage (3). This unit gains Buff Speed (2) and C-14 Rifle gains Precision (3).' },
                  ]}
                  weapons={[
                    {
                      id: 'c14', name: 'C-14 Rifle', phase: 'assault',
                      range: 12, roa: 2, hit: 3, dmg: 1, surgeType: 'Light', sDice: 'D3',
                      keywords: [
                        { keywordId: 'target',     name: 'Target',     description: '', hasValue: true,  value: 'all' },
                        { keywordId: 'long-range', name: 'Long Range', description: '', hasValue: true,  value: '18"' },
                      ],
                    },
                    {
                      id: 'agg12', name: 'AGG-12', phase: 'assault',
                      range: 12, roa: 3, hit: 3, dmg: 1, surgeType: 'Armoured', sDice: 'D3',
                      parentId: 'c14',
                      keywords: [
                        { keywordId: 'target',     name: 'Target',     description: '', hasValue: true, value: 'all' },
                        { keywordId: 'long-range', name: 'Long Range', description: '', hasValue: true, value: '18"' },
                        { keywordId: 'specialist', name: 'Specialist', description: '', hasValue: false, value: null },
                      ],
                    },
                    {
                      id: 'glaunch', name: 'Grenade Launcher', phase: 'assault',
                      range: 12, roa: 4, hit: 3, dmg: 1, surgeType: 'Light', sDice: 'D3',
                      keywords: [
                        { keywordId: 'target',     name: 'Target',     description: '', hasValue: true,  value: 'Ground' },
                        { keywordId: 'long-range', name: 'Long Range', description: '', hasValue: true,  value: '18"' },
                        { keywordId: 'specialist', name: 'Specialist', description: '', hasValue: false, value: null },
                        { keywordId: 'sidearm',    name: 'Sidearm',    description: '', hasValue: false, value: null },
                      ],
                    },
                    { id: 'strike',  name: 'Strike',  phase: 'combat', range: 0, roa: 1, hit: 5, dmg: 1 },
                    { id: 'bayonet', name: 'Bayonet', phase: 'combat', range: 0, roa: 2, hit: 5, dmg: 1, surgeType: 'Light', sDice: 'D3', parentId: 'strike' },
                  ]}
                  tags="Core, Light, Biological, Ground, Terran"
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ── Starcraft Phase Frame ─────────────────────────────────────── */}
      <GallerySection id="nav-sc-phase-frame" title="StarCraft Phase Frame / Assault">
        <div className="flex flex-col gap-4 items-start">
          <p className="font-body text-xs text-gray-400 dark:text-gray-500">
            Assault Phase example — C-14 Rifle (parent) with AGG-12 + Grenade Launcher upgrades, plus
            three abilities (Shield · reaction · 1CP, Slugthrower · passive, Grenades — Frag · passive).
          </p>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
            <StarcraftPhaseFrame
              phaseName="Assault Phase"
              weapons={[
                {
                  id: 'c14', name: 'C-14 Rifle',
                  range: 12, roa: 2, hit: 3, dmg: 1, surgeType: 'Light', sDice: 'D3',
                  keywords: [
                    { keywordId: 'target',     name: 'Target',     description: '', hasValue: true,  value: 'all' },
                    { keywordId: 'long-range', name: 'Long Range', description: '', hasValue: true,  value: '18"' },
                  ],
                },
                {
                  id: 'agg12', name: 'AGG-12', parentId: 'c14',
                  range: 12, roa: 3, hit: 3, dmg: 1, surgeType: 'Armoured', sDice: 'D3',
                  keywords: [
                    { keywordId: 'target',     name: 'Target',     description: '', hasValue: true, value: 'all' },
                    { keywordId: 'long-range', name: 'Long Range', description: '', hasValue: true, value: '18"' },
                    { keywordId: 'specialist', name: 'Specialist', description: '', hasValue: false, value: null },
                  ],
                },
                {
                  id: 'glaunch', name: 'Grenade Launcher', parentId: 'c14',
                  range: 12, roa: 4, hit: 3, dmg: 1, surgeType: 'Light', sDice: 'D3',
                  keywords: [
                    { keywordId: 'target',     name: 'Target',     description: '', hasValue: true,  value: 'Ground' },
                    { keywordId: 'long-range', name: 'Long Range', description: '', hasValue: true,  value: '18"' },
                    { keywordId: 'specialist', name: 'Specialist', description: '', hasValue: false, value: null },
                    { keywordId: 'sidearm',    name: 'Sidearm',    description: '', hasValue: false, value: null },
                  ],
                },
              ]}
              abilities={[
                {
                  id:    'shield',
                  name:  'Shield',
                  phase: 'assault',
                  timing: 'reaction',
                  cpCost: 1,
                  description: 'Gain Non-Lethal Damage (3). This unit gains Buff Speed (2) and C-14 Rifle gain Precision (3).',
                },
                {
                  id:    'slugthrower',
                  name:  'Slugthrower',
                  phase: 'assault',
                  timing: 'passive',
                  description: 'Gain Non-Lethal Damage (3). This unit gains Buff Speed (2) and C-14 Rifle gain Precision (3).',
                },
                {
                  id:    'grenades',
                  name:  'Grenades — Frag',
                  phase: 'assault',
                  timing: 'passive',
                  description: 'Gain Non-Lethal Damage (3). This unit gains Buff Speed (2) and C-14 Rifle gain Precision (3).',
                },
              ]}
            />
          </div>
        </div>
      </GallerySection>

      {/* ── Kill Team Card ─────────────────────────────────────────── */}
      <GallerySection id="nav-kill-team-card" title="Kill Team Card / Default">
        <div className="flex flex-wrap gap-8 items-start">

          {/* Empty / placeholder state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Empty state (default props)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 508, height: Math.round(890 * (508 / 1270)) }}>
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <KillTeamCard />
              </div>
            </div>
          </div>

          {/* Filled state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Filled state
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 508, height: Math.round(890 * (508 / 1270)) }}>
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <KillTeamCard
                  operativeName="Ravener Venomspitter"
                  tags="Ravener, Great Devourer, Tyranid, Venomspitter"
                  actions={3}
                  movement={3}
                  save={3}
                  wounds={20}
                  weapons={[
                    { name: 'Pincer Tail',           meleeOrRanged: 'ranged', attack: 4, hit: '3+', damage: '3/4', keywords: 'Range 8", Blast 2, Poison*',
                      keywordData: [
                        { label: 'Range 8"', name: 'Range', description: 'This weapon can target operatives within 8" of the firing operative.' },
                        { label: 'Blast 2',  name: 'Blast', description: 'Each successful hit also affects all operatives within 2" of the target.' },
                        { label: 'Poison',   name: 'Poison', description: 'On a successful hit, the target gains a Poison token. Operatives with a Poison token take D3 damage when activated.' },
                      ] },
                    { name: 'Venom bolt (blast)',    meleeOrRanged: 'ranged', attack: 4, hit: '3+', damage: '3/5', keywords: 'Range 8", Blast 2, Poison*' },
                    { name: 'Venom bolt (Focused)',  meleeOrRanged: 'ranged', attack: 4, hit: '3+', damage: '3/5', keywords: 'Range 8", Piercing 1, Poison*' },
                    { name: 'Scything Talons',       meleeOrRanged: 'melee',  attack: 5, hit: '3+', damage: '4/5', keywords: '-' },
                  ]}
                  abilities={[
                    { name: 'Hypersensory Hunter', apCost: 0, keywords: '', description: 'This operative can perform the Charge action while it has a Conceal order if it performed the Burrow action during the same activation/ counteraction.' },
                    { name: 'Ability 2',           apCost: 1, keywords: '', description: 'Until this operative has shot with its venom bolt, until it performs this action again, or until it performs the Burrow action (whichever comes first), all profiles of its venom bolt have the Lethal 5+ weapon rule, have 1 added to their Atk stat and the Range 8" weapon rule removed.' },
                    { name: 'Ability 3',           apCost: 1, keywords: '', description: 'Until this operative has shot with its venom bolt, until it performs this action again, or until it performs the Burrow action (whichever comes first), all profiles of its venom bolt have the Lethal 5+ weapon rule, have 1 added to their Atk stat and the Range 8" weapon rule removed.' },
                    { name: 'Ability 4',           apCost: 0, keywords: '', description: 'Until this operative has shot with its venom bolt, until it performs this action again, or until it performs the Burrow action (whichever comes first), all profiles of its venom bolt have the Lethal 5+ weapon rule, have 1 added to their Atk stat and the Range 8" weapon rule removed.' },
                  ]}
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ── Kill Team Rule Card ───────────────────────────────────── */}
      <GallerySection id="nav-kill-team-rule-card" title="Kill Team Rule Card / Default">
        <p className="font-body text-sm text-gray-500 dark:text-gray-400 mb-6">
          Faction Rule layout — title + description, with an optional attached ability.
        </p>
        <div className="flex flex-wrap gap-8 items-start">

          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Empty state (default props)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 350, height: Math.round(1200 * (350 / 700)) }}>
              <div style={{ transform: `scale(${350 / 700})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <KillTeamRuleCard />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Title + description
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 350, height: Math.round(1200 * (350 / 700)) }}>
              <div style={{ transform: `scale(${350 / 700})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <KillTeamRuleCard
                  title="Rule Title"
                  description={`Until this operative has shot with its venom bolt, until it performs this action again, or until it performs the Burrow action (whichever comes first), all profiles of its venom bolt have the Lethal 5+ weapon rule, have 1 added to their Atk stat and the Range 8" weapon rule removed.`}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              With attached ability
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 350, height: Math.round(1200 * (350 / 700)) }}>
              <div style={{ transform: `scale(${350 / 700})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <KillTeamRuleCard
                  title="Rule Title"
                  description={`Until this operative has shot with its venom bolt, until it performs this action again, or until it performs the Burrow action (whichever comes first), all profiles of its venom bolt have the Lethal 5+ weapon rule, have 1 added to their Atk stat and the Range 8" weapon rule removed.`}
                  ability={{
                    name:        'Rule Ability',
                    apCost:      1,
                    keywords:    '',
                    description: `Until this operative has shot with its venom bolt, until it performs this action again, or until it performs the Burrow action (whichever comes first), all profiles of its venom bolt have the Lethal 5+ weapon rule, have 1 added to their Atk stat and the Range 8" weapon rule removed.`,
                  }}
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ── Addon Info Modal — universal, schema-driven ─────────────── */}
      <GallerySection id="nav-addon-info-modal" title="Addon Info Modal">
        <div className="w-full space-y-4">
          <p className="font-body text-sm text-gray-400">
            Universal read-only modal for any addon (weapons, abilities, skills, …).
            Caller passes a list of game-specific stat rows + optional description and
            keywords. The Edit button label is parameterised by <code>addonTypeName</code>.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setAddonInfoWeapon(true)}>Open as Weapon (Kill Team)</Button>
            <Button onClick={() => setAddonInfoAbility(true)} variant="outline">Open as Ability (Kill Team)</Button>
          </div>
          <AddonInfoModal
            open={addonInfoWeapon}
            onClose={() => setAddonInfoWeapon(false)}
            name="Bolt Rifle"
            addonTypeName="Weapon"
            statRows={[
              { label: 'Type',   value: 'Ranged' },
              { label: 'Attack', value: 4 },
              { label: 'Hit',    value: '3+' },
              { label: 'Damage', value: '3/4' },
            ]}
            keywords={[
              { keywordId: 'demo-pierce', keywordName: 'Pierce', description: 'Reduces target save.', hasParams: true,  paramValue: 1 },
              { keywordId: 'demo-lethal', keywordName: 'Lethal', description: 'Critical on a 5+.',     hasParams: true,  paramValue: 5 },
            ]}
            onEdit={() => setAddonInfoWeapon(false)}
            onKeywordClick={() => {}}
          />
          <AddonInfoModal
            open={addonInfoAbility}
            onClose={() => setAddonInfoAbility(false)}
            name="Astartes"
            description="During friendly operative activation, perform two Shoot or two Fight actions; bolt weapon must feature in at least one Shoot."
            addonTypeName="Ability"
            statRows={[ { label: 'AP Cost', value: 'Free' } ]}
            onEdit={() => setAddonInfoAbility(false)}
          />
        </div>
      </GallerySection>

      {/* ── Rich Text Editor ────────────────────────────────────────── */}
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

      {/* ── Halo Flashpoint Rule Card ─────────────────────────────── */}
      <GallerySection id="nav-halo-rule-card" title="Halo Flashpoint Rule Card">
        <div className="flex flex-wrap gap-8 items-start">

          {/* Empty state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Empty state (default props)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 508, height: Math.round(890 * (508 / 1270)) }}>
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <HaloFlashpointRuleCard />
              </div>
            </div>
          </div>

          {/* Filled state with markdown */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Filled state (markdown)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 508, height: Math.round(890 * (508 / 1270)) }}>
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <HaloFlashpointRuleCard
                  title="Assault"
                  description={"When this unit activates, it may make a **free move action** before its normal actions.\n\n- The free move must be towards the nearest enemy unit\n- Cannot be used if the unit is *pinned*\n- Stacks with other movement abilities"}
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ── Card 3D Wrapper ───────────────────────────────────────── */}
      <GallerySection id="nav-card-3d" title="Card 3D Wrapper">
        <p className="font-body text-sm text-gray-500 dark:text-gray-400 mb-6">
          Hover over each card to see the 3D tilt effect.
        </p>
        <div className="flex flex-wrap gap-12 items-start">

          {/* Blood Bowl */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Blood Bowl</p>
            <Card3DWrapper
              style={{
                width:    278,
                height:   Math.round(1100 * (278 / 750)),
                position: 'relative',
                flexShrink: 0,
                filter:   'drop-shadow(0 5.571px 75.215px #1E1F6E)',
              }}
            >
              <div style={{ transform: `scale(${278 / 750})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <BloodBowlCard
                  teamName="Imperial Nobility"
                  unitName="Noble Blitzer"
                  cost={90}
                  ma={6}
                  st={3}
                  ag={3}
                  pa={4}
                  av={9}
                  skills="Block, Catch, Dump-Off"
                  primaryAttribute="Passing"
                  secondaryAttribute="Agility"
                />
              </div>
            </Card3DWrapper>
          </div>

          {/* Halo Flashpoint */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Halo Flashpoint</p>
            <Card3DWrapper
              style={{
                width:    508,
                height:   Math.round(890 * (508 / 1270)),
                position: 'relative',
                flexShrink: 0,
                filter:   'drop-shadow(0 5.571px 75.215px #1E1F6E)',
              }}
            >
              <div style={{ transform: `scale(${508 / 1270})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <HaloFlashpointCard
                  unitName="Spartan Zvezda"
                  keywords="Energy Shield (2), Scout"
                  ra={4}
                  fi={5}
                  sv={4}
                  advanceValue={1}
                  sprintValue={3}
                  ar={2}
                  hp={4}
                  weapons={[
                    { type: 'Close Combat', name: 'Fists',             range: 'CC', ap: '-', keywords: '-'                        },
                    { type: 'Ranged',       name: 'BR55 Battle Rifle', range: 'R5', ap: '1', keywords: 'Optics, Weight of Fire (1)' },
                  ]}
                />
              </div>
            </Card3DWrapper>
          </div>

        </div>
      </GallerySection>

      {/* ── Multi-Select Dropdown ──────────────────────────────────── */}
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

      {/* ════════════════════════════════════════════════════════════════
          VR — Vertical Rule
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          BANNER
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          CALLOUT
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          GAME LOGOS
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          DECK LIST ITEM
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-deck-list-item" title="Deck List Item">
        <div className="w-full space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With game icon thumbnail</p>
            <DeckListItem
              name="Imperial Nobility 11's Team"
              cardCount={3}
              thumbnailBg="bg-[#15417e]"
              thumbnail={<img src={iconBloodBowl} alt="" className="size-full object-cover" />}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With gradient thumbnail</p>
            <DeckListItem
              name="250 Point Spartans"
              cardCount={5}
              thumbnailBg="bg-gradient-to-b from-[#252525] to-[#181d24]"
              thumbnail={<img src={iconHalo} alt="" className="size-full object-cover" />}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">No thumbnail (colour background only)</p>
            <DeckListItem
              name="Space Marines 500pt Crusade List"
              cardCount={10}
              thumbnailBg="bg-gradient-to-b from-[#141c22] to-[#34566b]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Single card</p>
            <DeckListItem
              name="Solo Test Deck"
              cardCount={1}
              thumbnailBg="bg-gray-700"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With delete action (⋯ menu)</p>
            <DeckListItem
              name="Deletable Deck"
              cardCount={4}
              thumbnailBg="bg-[#15417e]"
              thumbnail={<img src={iconBloodBowl} alt="" className="size-full object-cover" />}
              onDelete={() => {}}
            />
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          ADDON LIST ITEM
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-addon-list-item" title="Addon List Item">
        <div className="w-full space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Default (unselected)</p>
            <AddonListItem
              name="BR55 Battle Rifle"
              subtitle="Ranged, R5, AP 1, Optics, Weight of Fire (1)"
              addonTypeName="Weapon"
              onSelect={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Selected</p>
            <AddonListItem
              name="M6 Magnum"
              subtitle="Ranged, R3, AP 0, Pistol"
              selected
              addonTypeName="Weapon"
              onSelect={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Skill (description subtitle)</p>
            <AddonListItem
              name="Tackle"
              subtitle="Opposing players who are standing in any of this player's tackle zones are not allowed to use their Dodge skill."
              addonTypeName="Skill"
              onSelect={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Selectable — click to toggle</p>
            <AddonListItem
              name="Energy Sword"
              subtitle="Melee, R0, AP 3, Energy"
              selected={selectedAddonId === 'demo'}
              addonTypeName="Weapon"
              onSelect={() => setSelectedAddonId(selectedAddonId === 'demo' ? null : 'demo')}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          ADD ADDON MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-add-addon-modal" title="Add Addon Modal">
        <div className="w-full space-y-4">

          <p className="font-body text-sm text-gray-400">
            Two-step wizard. Step 1 shows existing eligible addons (fetched from Supabase).
            Step 2 renders the game-specific create/edit form. Opens connected to the
            Blood Bowl skills addon type.
          </p>

          <Button onClick={() => setAddonModalOpen(true)}>
            Open Add Skill Modal (Blood Bowl)
          </Button>

          {/* Demo skill form — used only within the gallery */}
          {(() => {
            const DemoSkillForm = ({ editingAddon, onSave, onCancel, saving }: AddonFormProps) => {
              const [name, setName] = useState(editingAddon?.name ?? '');
              const [desc, setDesc] = useState(editingAddon?.description ?? '');
              const canSave = name.trim() !== '' && desc.trim() !== '' && !saving;
              return (
                <div className="p-5 flex flex-col gap-3">
                  <h5 className="font-heading text-xl text-white">
                    {editingAddon ? 'Edit Skill' : 'Create Skill'}
                  </h5>
                  <p className="font-body text-sm text-gray-300">
                    Once created, you can add this skill to other units from the same game.
                  </p>
                  <Input label="Skill Name" required placeholder="Tackle, Stunty, etc." value={name} onChange={e => setName(e.target.value)} />
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-0.5 items-center font-body text-sm font-medium text-gray-100">
                      <span>Skill Description</span><span className="text-red-600">*</span>
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Copy from the rules, or enter a brief description."
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 font-body text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button disabled={!canSave} loading={saving} onClick={() => onSave(name.trim(), desc.trim(), {})}>
                      {editingAddon ? 'Update Skill' : 'Save Skill'}
                    </Button>
                    <Button variant="ghost" color="danger" onClick={onCancel} disabled={saving}>Cancel</Button>
                  </div>
                </div>
              );
            };
            return (
              <AddAddonModal
                open={addonModalOpen}
                onClose={() => setAddonModalOpen(false)}
                gameSlug="blood-bowl"
                addonTypeSlug="skills"
                addonTypeName="Skill"
                excludeAddonIds={[]}
                onAdd={() => setAddonModalOpen(false)}
                onDeleted={() => {}}
                getSubtitle={addon => addon.description?.trim() || addon.name}
                CreateFormComponent={DemoSkillForm}
              />
            );
          })()}

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          ADD KEYWORD MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-add-keyword-modal" title="Add Keyword Modal">
        <div className="w-full space-y-4">

          <p className="font-body text-sm text-gray-400">
            Three-step keyword wizard. Step 1 picks an existing keyword or creates a new one.
            Step 2 is the create-keyword form. Step 3 sets the parameter value (if applicable).
            Opens connected to the Halo Flashpoint game.
          </p>

          <Button onClick={() => setKeywordModalOpen(true)}>
            Open Add Keyword Modal (Halo Flashpoint)
          </Button>

          <AddKeywordModal
            open={keywordModalOpen}
            onClose={() => setKeywordModalOpen(false)}
            gameSlug="halo-flashpoint"
            onKeywordSelected={() => setKeywordModalOpen(false)}
            excludeKeywordIds={[]}
          />

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          KEYWORD INFO MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-keyword-info-modal" title="Keyword Info Modal">
        <div className="w-full space-y-4">

          <p className="font-body text-sm text-gray-400">
            Read-only modal showing a keyword's name and description.
            Opened by clicking a keyword link (blue underlined text).
          </p>

          <Button onClick={() => setKeywordInfoOpen(true)}>
            Open Keyword Info Modal
          </Button>

          <KeywordInfoModal
            open={keywordInfoOpen}
            onClose={() => setKeywordInfoOpen(false)}
            name="Optics"
            description={"A weapon with the Optics keyword adds a +1 die modifier to Shoot actions. Headshots occur on rolls of 7 and 8.\n\nThis keyword may not be used when using the Rapid Fire keyword to make a Blaze Away Shoot action."}
          />

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          WEAPON INFO MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-weapon-info-modal" title="Weapon Info Modal">
        <div className="w-full space-y-4">

          <p className="font-body text-sm text-gray-400">
            Read-only modal showing a weapon's properties: type, range, AP, points cost,
            and clickable keyword chips. Includes an "Edit Weapon" button.
          </p>

          <Button onClick={() => setWeaponInfoOpen(true)}>
            Open Weapon Info Modal
          </Button>

          <WeaponInfoModal
            open={weaponInfoOpen}
            onClose={() => setWeaponInfoOpen(false)}
            weapon={{
              name: 'M6H2 Magnum',
              type: 'Ranged',
              range: '3',
              ap: '0',
              pointsCost: '15',
              weaponKeywords: [
                { keywordId: 'demo-1', keywordName: 'Optics', description: 'A weapon with the Optics keyword adds a +1 die modifier to Shoot actions.', hasParams: false, paramValue: null },
              ],
            }}
            onEdit={() => setWeaponInfoOpen(false)}
            onKeywordClick={() => {}}
          />

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BLOG ENTRY PREVIEW
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-blog-entry-preview" title="Blog Entry Preview">
        <div className="w-full space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With "Read Update" button</p>
            <BlogEntryPreview
              title="Example Release Note"
              body="This is a placeholder release note. It has a maximum of 3 lines, after which the text will be truncated. But don't worry, there's a button to view the full update!"
              onRead={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Body clamped to 3 lines (long text)</p>
            <BlogEntryPreview
              title="v1.2 — New Card Builder"
              body="This release ships the updated Blood Bowl card builder with full support for all 26 team rosters. We've also improved the export pipeline so cards render at 300 DPI by default, and fixed a crash that occurred when switching between game types mid-session. Additionally, the Halo Flashpoint builder now supports multi-select for unit abilities."
              onRead={() => {}}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Without "Read Update" button (onRead omitted)</p>
            <BlogEntryPreview
              title="Maintenance Notice"
              body="Scheduled maintenance on Sunday at 2 am UTC. The app will be unavailable for approximately 30 minutes."
            />
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          MODAL
      ════════════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════════════
          UPLOAD PHOTO MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-upload-photo-modal" title="Upload Photo Modal">
        <div className="w-full space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              First step of the unit photo upload flow — choose camera or file upload
            </p>
            <Button onClick={() => setUploadPhotoOpen(true)}>Open Upload Photo Modal</Button>
            <UploadPhotoModal
              open={uploadPhotoOpen}
              onClose={() => setUploadPhotoOpen(false)}
              game="halo-flashpoint"
              cardDbId={null}
              onImageUploaded={(url, _style) => console.log('Portrait:', url)}
              onAvatarUploaded={url => console.log('Avatar:', url)}
            />
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          GAME PICKER ITEM
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-game-picker-item" title="Game Picker Item">
        <div className="w-full space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Default (unselected)</p>
            <div className="flex flex-col gap-1.5 max-w-lg">
              <GamePickerItem logoSrc={logoHaloFlashpoint} logoAlt="Halo: Flashpoint" />
              <GamePickerItem logoSrc={logoBloodBowl} logoAlt="Blood Bowl" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Selected state</p>
            <div className="flex flex-col gap-1.5 max-w-lg">
              <GamePickerItem logoSrc={logoHaloFlashpoint} logoAlt="Halo: Flashpoint" selected />
              <GamePickerItem logoSrc={logoBloodBowl} logoAlt="Blood Bowl" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Interactive (single-select)</p>
            <div className="flex flex-col gap-1.5 max-w-lg">
              <GamePickerItem
                logoSrc={logoHaloFlashpoint}
                logoAlt="Halo: Flashpoint"
                selected={pickedGame === 'halo-flashpoint'}
                onClick={() => setPickedGame('halo-flashpoint')}
              />
              <GamePickerItem
                logoSrc={logoBloodBowl}
                logoAlt="Blood Bowl"
                selected={pickedGame === 'blood-bowl'}
                onClick={() => setPickedGame('blood-bowl')}
              />
            </div>
          </div>

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          IMPORT LIST MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-import-list-modal" title="Import List Modal">
        <div className="w-full space-y-4">

          <p className="font-body text-sm text-gray-400">
            Two-step flow: paste a plain-text army list, preview the parsed units,
            then import as a new deck. Currently supports Halo: Flashpoint lists.
          </p>

          <Button onClick={() => setImportListOpen(true)}>
            Open Import List Modal
          </Button>

          <ImportListModal
            open={importListOpen}
            onClose={() => setImportListOpen(false)}
            onImported={(deckId, gameSlug) => {
              setImportListOpen(false);
              console.log('Imported deck:', deckId, 'game:', gameSlug);
            }}
          />

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          SAVE TEMPLATE MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-save-template-modal" title="Save Template Modal">
        <div className="w-full space-y-4">

          <p className="font-body text-sm text-gray-400">
            Opens from the "Save as Template" button in the card edit panel.
            Collects a template name (required). When invoked from a card
            that already has a unit name, the field is prefilled.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setSaveTemplatePrefill(false); setSaveTemplateOpen(true); }}>
              Open (blank name)
            </Button>
            <Button
              variant="outline"
              onClick={() => { setSaveTemplatePrefill(true); setSaveTemplateOpen(true); }}
            >
              Open (prefilled name)
            </Button>
          </div>

          <SaveTemplateModal
            open={saveTemplateOpen}
            onClose={() => setSaveTemplateOpen(false)}
            defaultName={saveTemplatePrefill ? 'Spartan Sergeant' : ''}
            onSave={async (name) => {
              console.log('Save template as:', name);
              setSaveTemplateOpen(false);
            }}
          />

        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          NEW CARD MODAL
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-new-card-modal" title="New Card Modal">
        <div className="w-full space-y-4">

          <p className="font-body text-sm text-gray-400">
            Shown when the user adds a card to a deck and has saved templates
            for that game. Offers a blank-card path plus a searchable list of
            templates. When there are no templates, the parent skips this
            modal and creates a blank card directly.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setNewCardHasTemplates(true); setNewCardOpen(true); }}>
              Open (with templates)
            </Button>
            <Button
              variant="outline"
              onClick={() => { setNewCardHasTemplates(false); setNewCardOpen(true); }}
            >
              Open (no templates)
            </Button>
          </div>

          <NewCardModal
            open={newCardOpen}
            onClose={() => setNewCardOpen(false)}
            templates={newCardHasTemplates ? galleryTemplates : []}
            onNewBlank={() => {
              console.log('New blank card');
              setNewCardOpen(false);
            }}
            onPickTemplate={async (id) => {
              console.log('Create from template:', id);
              setNewCardOpen(false);
            }}
            onDeleteTemplate={(id) => console.log('Delete template:', id)}
          />

        </div>
      </GallerySection>

      {/* ── PlaySubnav ─────────────────────────────────────────────────── */}
      <GallerySection title="PlaySubnav / Units & Rules">
        <div className="flex flex-col gap-6">
          {(() => {
            const [tab, setTab] = React.useState<PlayTab>('units');
            return (
              <div className="flex flex-col gap-3">
                <Text size="sm" color="secondary">Interactive (click to toggle)</Text>
                <PlaySubnav tab={tab} onTabChange={setTab} />
                <Text size="xs" color="secondary">Current: {tab}</Text>
              </div>
            );
          })()}
          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Units active</Text>
            <PlaySubnav tab="units" onTabChange={() => {}} />
          </div>
          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Rules active</Text>
            <PlaySubnav tab="rules" onTabChange={() => {}} />
          </div>
        </div>
      </GallerySection>

      {/* ── EditSubnav ─────────────────────────────────────────────────── */}
      <GallerySection title="EditSubnav / Card List & Editor (tablet + mobile)">
        <div className="flex flex-col gap-6">
          <Text size="sm" color="secondary">
            Shown below the Navbar in Edit mode on viewports smaller than lg.
            Each button's label + colour flips based on whether the panel is open.
          </Text>

          {(() => {
            const [cardListOpen, setCardListOpen] = React.useState(false);
            const [editorOpen, setEditorOpen]     = React.useState(false);
            return (
              <div className="flex flex-col gap-3">
                <Text size="sm" color="secondary">Interactive (click to toggle)</Text>
                <EditSubnav
                  cardListOpen={cardListOpen}
                  onToggleCardList={() => setCardListOpen(o => !o)}
                  editorOpen={editorOpen}
                  onToggleEditor={() => setEditorOpen(o => !o)}
                />
                <Text size="xs" color="secondary">
                  cardListOpen: {String(cardListOpen)} · editorOpen: {String(editorOpen)}
                </Text>
              </div>
            );
          })()}

          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Both closed (default — invites to open)</Text>
            <EditSubnav
              cardListOpen={false}
              onToggleCardList={() => {}}
              editorOpen={false}
              onToggleEditor={() => {}}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Card list open, editor closed</Text>
            <EditSubnav
              cardListOpen={true}
              onToggleCardList={() => {}}
              editorOpen={false}
              onToggleEditor={() => {}}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Card list closed, editor open</Text>
            <EditSubnav
              cardListOpen={false}
              onToggleCardList={() => {}}
              editorOpen={true}
              onToggleEditor={() => {}}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">Both open</Text>
            <EditSubnav
              cardListOpen={true}
              onToggleCardList={() => {}}
              editorOpen={true}
              onToggleEditor={() => {}}
            />
          </div>
        </div>
      </GallerySection>

      {/* ── ModeToggle ──────────────────────────────────────────────────── */}
      <GallerySection title="ModeToggle / Edit & Play">
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

      <GallerySection id="play-token-menu" title="TokenMenu / Play Mode">
        <div className="flex flex-col gap-6 w-full max-w-md">
          <Text size="sm" color="secondary">
            Floating token action menu for Play mode. Click "Token" to expand.
          </Text>
          <div className="relative bg-gray-900 rounded-lg p-8 h-64 flex items-end justify-end">
            <TokenMenu
              tokenDefinitions={[
                { id: 'demo-damage', game_id: '', name: 'Damage', description: null, icon: 'Token Type=Damage, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: 'hp', stat_role: 'max', starting_value: 0, min_value: 0, max_value: null, sort_order: 1, created_at: '' },
                { id: 'demo-shield', game_id: '', name: 'Shield', description: null, icon: 'Token Type=Shield, State=Default', icon_off: 'Token Type=Shield, State=Off', is_toggle: true, keyword_name: 'Energy Shield', keyword_value_role: 'max', stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: null, sort_order: 2, created_at: '' },
                { id: 'demo-crouch', game_id: '', name: 'Crouching', description: null, icon: 'Token Type=Crouch, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: 1, sort_order: 3, created_at: '' },
                { id: 'demo-pinned', game_id: '', name: 'Pinned', description: null, icon: 'Token Type=Pinned, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: 1, sort_order: 4, created_at: '' },
                { id: 'demo-activated', game_id: '', name: 'Activated', description: null, icon: 'Token Type=Activated, State=Default', icon_off: 'Token Type=Activated, State=Off', is_toggle: true, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: 1, min_value: 0, max_value: 1, sort_order: 5, created_at: '' },
              ] as TokenDefinition[]}
              card={{ hp: 3, unitKeywords: [{ keywordName: 'Energy Shield', paramValue: 2 }] }}
              tokenState={{ 'demo-activated': 1 }}
              onTokenChange={() => {}}
            />
          </div>
        </div>
      </GallerySection>

      <GallerySection id="play-token-overlay" title="TokenOverlay / Play Mode">
        <div className="flex flex-col gap-6 w-full">
          <Text size="sm" color="secondary">
            Token icons overlaid on the card in play mode. Scaled down here for preview.
          </Text>
          <div className="relative bg-gray-900 rounded-lg p-8 overflow-visible" style={{ width: 660, height: 520 }}>
            {/* Scaled-down card container to show overlay positioning */}
            <div style={{ position: 'relative', width: 1270 / 2, height: 890 / 2, transform: 'scale(0.5)', transformOrigin: 'top left', background: '#a1a1a1', borderRadius: 8 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text size="sm" color="secondary">Card placeholder</Text>
              </div>
              <TokenOverlay
                tokenDefinitions={[
                  { id: 'demo-damage', game_id: '', name: 'Damage', description: null, icon: 'Token Type=Damage, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: 'hp', stat_role: 'max', starting_value: 0, min_value: 0, max_value: null, sort_order: 1, created_at: '' },
                  { id: 'demo-shield', game_id: '', name: 'Shield', description: null, icon: 'Token Type=Shield, State=Default', icon_off: 'Token Type=Shield, State=Off', is_toggle: true, keyword_name: 'Energy Shield', keyword_value_role: 'max', stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: null, sort_order: 2, created_at: '' },
                  { id: 'demo-crouch', game_id: '', name: 'Crouching', description: null, icon: 'Token Type=Crouch, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: 1, sort_order: 3, created_at: '' },
                  { id: 'demo-pinned', game_id: '', name: 'Pinned', description: null, icon: 'Token Type=Pinned, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: 1, sort_order: 4, created_at: '' },
                  { id: 'demo-activated', game_id: '', name: 'Activated', description: null, icon: 'Token Type=Activated, State=Default', icon_off: 'Token Type=Activated, State=Off', is_toggle: true, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: 1, min_value: 0, max_value: 1, sort_order: 5, created_at: '' },
                ] as TokenDefinition[]}
                card={{ hp: 4, unitKeywords: [{ keywordName: 'Energy Shield', paramValue: 3 }] }}
                tokenState={{ 'demo-activated': 1, 'demo-crouch': 0, 'demo-pinned': 0, 'demo-damage': 2, 'demo-shield': 2 }}
              />
            </div>
          </div>
        </div>
      </GallerySection>

      {/* ── PrintCardGrid ──────────────────────────────────────────────── */}
      <GallerySection title="PrintCardGrid / Blood Bowl (A4)">
        <div className="flex flex-col gap-4 w-full overflow-auto">
          <Text size="sm" color="secondary">
            Print layout grid with demo Blood Bowl cards scaled to fit A4 paper. 2x2 = 4 cards per page.
          </Text>
          <div className="bg-gray-800 p-6 rounded-lg overflow-auto">
            <PrintCardGrid
              gameSlug="blood-bowl"
              paperSize="a4"
              printSize={[75, 110]}
              bleedSize={[81, 116]}
              excludedIds={new Set()}
              bloodBowlCards={[
                { id: 'bb1', teamName: 'Orc Boyz', unitName: 'Black Orc', playerRole: 'Blocker', cost: '90,000', skills: 'Block, Grab', primaryAttribute: 'S', secondaryAttribute: 'GA', ma: 4, st: 4, ag: 4, pa: 5, av: 10, portraitUrl: null, avatarUrl: null },
                { id: 'bb2', teamName: 'Orc Boyz', unitName: 'Blitzer', playerRole: 'Blitzer', cost: '80,000', skills: 'Block', primaryAttribute: 'GS', secondaryAttribute: 'AP', ma: 6, st: 3, ag: 3, pa: 4, av: 9, portraitUrl: null, avatarUrl: null },
                { id: 'bb3', teamName: 'Orc Boyz', unitName: 'Thrower', playerRole: 'Thrower', cost: '65,000', skills: 'Sure Hands, Pass', primaryAttribute: 'GP', secondaryAttribute: 'AS', ma: 5, st: 3, ag: 3, pa: 3, av: 8, portraitUrl: null, avatarUrl: null },
                { id: 'bb4', teamName: 'Orc Boyz', unitName: 'Lineman', playerRole: 'Lineman', cost: '50,000', skills: '', primaryAttribute: 'G', secondaryAttribute: 'AS', ma: 5, st: 3, ag: 3, pa: 4, av: 9, portraitUrl: null, avatarUrl: null },
                { id: 'bb5', teamName: 'Orc Boyz', unitName: 'Goblin', playerRole: 'Goblin', cost: '40,000', skills: 'Dodge, Stunty', primaryAttribute: 'A', secondaryAttribute: 'GPS', ma: 6, st: 2, ag: 3, pa: 4, av: 7, portraitUrl: null, avatarUrl: null },
              ]}
            />
          </div>
        </div>
      </GallerySection>

      <GallerySection title="PrintCardGrid / Halo Flashpoint (A4)">
        <div className="flex flex-col gap-4 w-full overflow-auto">
          <Text size="sm" color="secondary">
            Print layout grid with demo Halo Flashpoint cards. 1 column x 2 rows = 2 cards per page.
          </Text>
          <div className="bg-gray-800 p-6 rounded-lg overflow-auto">
            <PrintCardGrid
              gameSlug="halo-flashpoint"
              paperSize="a4"
              printSize={[127, 89]}
              bleedSize={[133, 95]}
              excludedIds={new Set()}
              haloCards={[
                { id: 'h1', unitName: 'Spartan-IV', keywords: 'UNSC, Spartan', ra: 3, fi: 3, sv: 4, advanceValue: 4, sprintValue: 6, ar: 2, hp: 4, pointsCost: 150, portraitUrl: null, portraitStyle: null, avatarUrl: null, weapons: [{ name: 'MA40 Assault Rifle', type: 'Ranged', range: '18"', ap: '-', keywords: 'Rapid Fire' }] },
                { id: 'h2', unitName: 'ODST', keywords: 'UNSC, ODST', ra: 4, fi: 4, sv: 5, advanceValue: 4, sprintValue: 6, ar: 3, hp: 3, pointsCost: 100, portraitUrl: null, portraitStyle: null, avatarUrl: null, weapons: [{ name: 'M7S SMG', type: 'Ranged', range: '12"', ap: '-', keywords: 'Suppressive' }] },
                { id: 'h3', unitName: 'Elite Minor', keywords: 'Covenant, Elite', ra: 4, fi: 3, sv: 4, advanceValue: 4, sprintValue: 6, ar: 2, hp: 3, pointsCost: 120, portraitUrl: null, portraitStyle: null, avatarUrl: null, weapons: [{ name: 'Plasma Rifle', type: 'Ranged', range: '18"', ap: '1', keywords: 'Rapid Fire' }] },
              ]}
              rules={[
                { id: 'r1', title: 'Energy Shield', description: 'When this unit takes damage, reduce the damage by the shield value.' },
              ]}
            />
          </div>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          BUILDER SHELL — Card-builder layout primitives shared across
          every game (Halo, Starcraft, Blood Bowl, …). Game pages compose
          these with `useCardBuilder` instead of duplicating frame markup.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-builder-shell" title="Builder Shell / Composed">
        <BuilderShellDemo />
      </GallerySection>

      <GallerySection title="Builder Shell / CardListPanel">
        <div className="w-64 h-[480px] flex flex-col bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <CardListPanel
            deckName="UNSC Strike Team"
            editingDeckName={false}
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
            <UnitListEntry status="complete" unitName="Spartan CQB" active />
            <UnitListEntry status="complete" unitName="ODST Demolition" />
            <UnitListEntry status="complete" unitName="Marine Squad" />
            <UnitListEntry status="blank" />
          </CardListPanel>
        </div>

        {/* With a header action slot (e.g. edit-mode toggle) */}
        <div className="w-64 h-[480px] flex flex-col bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <CardListPanel
            deckName="Banished Vanguard"
            editingDeckName={false}
            inputRef={{ current: null }}
            onStartEdit={() => {}}
            onCommit={() => {}}
            onCancelEdit={() => {}}
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
            <UnitListEntry status="complete" unitName="Elite Honor Guard" />
            <UnitListEntry status="complete" unitName="Brute Chieftain" active />
            <UnitListEntry status="complete" unitName="Jackal Sniper" />
          </CardListPanel>
        </div>
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
          <EditorPanel title="Edit Rule">
            <Input label="Rule Title" placeholder="e.g. Assault" value="Energy Shield" onChange={() => {}} />
            <p className="font-body text-xs text-gray-400">Description and rich-text body would go here in a real builder.</p>
          </EditorPanel>
        </div>
      </GallerySection>

      <GallerySection title="Builder Shell / CenterViewport">
        <div className="w-full max-w-2xl h-[420px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col bg-gray-950">
          <CenterViewport
            logo={<img src={logoHaloFlashpoint} alt="Halo Flashpoint" className="h-10 w-auto" />}
          >
            <div className="flex-1 min-h-0 w-full flex items-center justify-center text-gray-500 font-body text-sm">
              [ CardCarousel ]
            </div>
          </CenterViewport>
        </div>

        {/* mobilePanelOpen=true — logo hides, main collapses to flex-none */}
        <div className="w-full max-w-2xl h-[420px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col bg-gray-950">
          <CenterViewport
            logo={<img src={logoHaloFlashpoint} alt="Halo Flashpoint" className="h-10 w-auto" />}
            mobilePanelOpen
          >
            <div className="w-full h-32 flex items-center justify-center text-gray-500 font-body text-sm border border-dashed border-gray-700 m-3">
              mobilePanelOpen — logo hidden, main collapsed
            </div>
          </CenterViewport>
        </div>
      </GallerySection>

      </div>{/* end sm:ml-64 content wrapper */}
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
 * Used only in ComponentGallery — not a reusable app component.
 */
interface IconEntry {
  name: string;
  outline: React.ReactNode;
  /** Pass null if no solid variant exists for this icon */
  solid: React.ReactNode | null;
}

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
          <div title="outline">{outline}</div>
          {/* Solid variant — greyed out dash if unavailable */}
          <div title={solid ? 'solid' : 'no solid variant'} className={solid ? '' : 'text-gray-300 dark:text-gray-700'}>
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
 * Used only in ComponentGallery — not a reusable app component.
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

// ── GallerySection ────────────────────────────────────────────────────────────

/**
 * GallerySection — Wrapper for each component group
 *
 * Renders a labelled section with a divider, keeping the gallery
 * organised as the number of components grows.
 *
 * Props:
 * - title:    Section heading (e.g. "Buttons", "Unit Cards")
 * - children: Component previews to display inside the section
 */
const GallerySection = ({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) => {
  return (
    <section id={id} className="mb-14">

      {/* Section title + divider */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="font-body text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {title}
        </h2>
        <div className="h-px bg-gray-200 dark:bg-gray-800 flex-1" />
      </div>

      {/* Component previews */}
      <div className="flex flex-wrap gap-4">
        {children}
      </div>

    </section>
  );
};

export { GallerySection };
export default ComponentGallery;
