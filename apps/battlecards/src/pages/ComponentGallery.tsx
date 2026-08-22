/**
 * ComponentGallery.tsx — BattleCards Component Gallery
 *
 * A living reference for every UI component in the app.
 * This page is a development tool only — not a screen users will see.
 *
 * HOW IT IS PUT TOGETHER:
 * The chrome (<GalleryShell>) and every demo for a shared @battleplans/ui
 * component (<SharedGallerySections>) live in packages/ui, so all three apps
 * show the same thing. This file only holds the sections for components that
 * live in apps/battlecards/src/components.
 *
 * ADDING A COMPONENT: when you create a component in this app, add a
 * <GallerySection> for it below showing every meaningful variant and state, and
 * add a matching entry to LOCAL_NAV. If the component belongs in packages/ui
 * instead, add its demo to packages/ui/src/gallery/SharedSections.tsx.
 *
 * Navigate to this page at: http://localhost:5173/gallery
 */

import React, { useState } from 'react';
import {
  GalleryShell,
  GallerySection,
  GalleryNote,
  SharedGallerySections,
  SHARED_GALLERY_NAV,
  type GalleryNavItem,
} from '@battleplans/ui';
import { Button, Counter, Input, Text, MarkdownBody } from '@battleplans/ui';
import { BuilderShell, ListPanel, EditorPanel } from '@battleplans/ui';
import { AddCircle, FileText, Pen2, Shield, Star, UserRounded, Widget2, Gallery, Bookmark, ListCheck, Play, Filter } from '@battleplans/ui';

// ── Local component imports ──────────────────────────────────────────────────
import AppNavbar from '../components/AppNavbar';
import ZoomControls from '../components/ZoomControls';
import UnitListEntry from '../components/UnitListEntry';
import DeckCardList from '../components/DeckCardList';
import DeckPanelMenu from '../components/DeckPanelMenu';
import ShareDeckSheet from '../components/ShareDeckSheet';
import PlaySessionPrompt from '../components/PlaySessionPrompt';
import BloodBowlCard from '../components/BloodBowlCard';
import StarPlayerCard from '../components/StarPlayerCard';
import HaloFlashpointCard from '../components/HaloFlashpointCard';
import HaloFlashpointRuleCard from '../components/HaloFlashpointRuleCard';
import StarcraftCard from '../components/StarcraftCard';
import StarcraftPhaseFrame from '../components/StarcraftPhaseFrame';
import KillTeamCard from '../components/KillTeamCard';
import KillTeamRuleCard from '../components/KillTeamRuleCard';
import AddonInfoModal from '../components/AddonInfoModal';
import Card3DWrapper from '../components/Card3DWrapper';
import DeckListItem from '../components/DeckListItem';
import PackListItem from '../components/PackListItem';
import AddToPackModal from '../components/AddToPackModal';
import AddonListItem from '../components/AddonListItem';
import AddAddonModal, { type AddonFormProps } from '../components/AddAddonModal';
import AddKeywordModal from '../components/AddKeywordModal';
import KeywordInfoModal from '../components/KeywordInfoModal';
import WeaponInfoModal from '../components/WeaponInfoModal';
import ImportListModal from '../components/ImportListModal';
import SaveTemplateModal from '../components/SaveTemplateModal';
import NewCardModal, { type NewCardModalTemplate } from '../components/NewCardModal';
import BlogEntryPreview from '../components/BlogEntryPreview';
import UploadPhotoModal from '../components/UploadPhotoModal';
import GamePickerItem from '../components/GamePickerItem';
import PlaySubnav, { type PlayTab } from '../components/PlaySubnav';
import EditSubnav from '../components/EditSubnav';
import CenterViewport from '../components/CenterViewport';
import TokenMenu from '../components/TokenMenu';
import TokenOverlay from '../components/TokenOverlay';
import PrintCardGrid from '../components/PrintCardGrid';
import HaloCardForm from '../components/HaloCardForm';
import BloodBowlCardForm from '../components/BloodBowlCardForm';
import KillTeamCardForm from '../components/KillTeamCardForm';
import StarcraftCardForm from '../components/StarcraftCardForm';
import RygCard, { type RygWeapon, type RygArmor, type RygItem, type RygSpell } from '../components/RygCard';
import GodCard from '../components/GodCard';
import SeptCard from '../components/SeptCard';
import CardCarousel from '../components/CardCarousel';
import AttachedAddonRow from '../components/AttachedAddonRow';
import AddRuleModal from '../components/AddRuleModal';
import CustomTokenModal, { type CustomTokenFormValue } from '../components/CustomTokenModal';
import TokenBadge from '../components/TokenBadge';
import TokenBar from '../components/TokenBar';
import StarcraftSupplyTiersModal from '../components/StarcraftSupplyTiersModal';
import StarcraftAddKeywordModal from '../components/StarcraftAddKeywordModal';
// Addon forms — all conform to AddonFormProps, so the harness below can mount any of them.
import HaloWeaponForm from '../components/HaloWeaponForm';
import KillTeamAbilityForm from '../components/KillTeamAbilityForm';
import KillTeamWeaponForm from '../components/KillTeamWeaponForm';
import StarcraftAbilityForm from '../components/StarcraftAbilityForm';
import StarcraftWeaponForm from '../components/StarcraftWeaponForm';
import RygDestinyForm from '../components/RygDestinyForm';
import RygGodForm from '../components/RygGodForm';
import RygSeptBenefitForm from '../components/RygSeptBenefitForm';
import RygSeptForm from '../components/RygSeptForm';
import RygSimpleAddonForm from '../components/RygSimpleAddonForm';
import RygSpellForm from '../components/RygSpellForm';
import RygTalentForm from '../components/RygTalentForm';
import RygWarriorTypeForm from '../components/RygWarriorTypeForm';
import RygWeaponForm from '../components/RygWeaponForm';
import { paletteFromHex } from '../lib/tokenColorSets';
import type { TokenDefinition, StarcraftSupplyTier } from '../lib/database.types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path contains spaces, TS path resolver struggles but Vite handles fine
import iconBloodBowl from '../../../../packages/ui/src/assets/games/icons/blood-bowl.png';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import iconHalo from '../../../../packages/ui/src/assets/games/icons/halo.png';
import logoBloodBowl from '../../../../packages/ui/src/assets/games/logos/logo-blood-bowl.png';
import logoHaloFlashpoint from '../../../../packages/ui/src/assets/games/logos/logo-halo-flashpoint.png';

/** A real release note, used to demo markdown rendering + clamping. */
const MARKDOWN_SAMPLE = [
  '**Features**',
  '- You can now display the model images in a collection as their cover.',
  '- Sort models alphabetically, by painted status, or by date added.',
  '',
  '**Bug Fixes**',
  '- Fixed an issue where only 10 collections would show.',
].join('\n');

// ── Demo data for the RYG cards ──────────────────────────────────────────────

const DEMO_RYG_WEAPONS: RygWeapon[] = [
  { id: 'w1', name: 'Chain Flail',   damage: '2',   range: 1, cost: 3, keywords: 'Reach, Brutal' },
  { id: 'w2', name: 'Censer Pistol', damage: '1+1', range: 8, cost: 4, keywords: 'Loud' },
];

const DEMO_RYG_ARMOR: RygArmor[] = [
  { id: 'a1', name: 'Penitent Plate', cost: 5, description: '+2 Defense. Fate tests suffer -1.' },
];

const DEMO_RYG_ITEMS: RygItem[] = [
  { id: 'i1', name: 'Vial of Ash', cost: 1, description: 'Once per battle, ignore a single wound.' },
];

const DEMO_RYG_SPELLS: RygSpell[] = [
  { id: 's1', name: 'Whisper of Rust', spellType: 'Hex', fateModifier: '-1', description: 'Target weapon loses 1 Damage until the end of the round.' },
];

// ── Demo data for the carousel ───────────────────────────────────────────────

const CAROUSEL_ITEMS = [
  { id: 'c1', name: 'Spartan CQB' },
  { id: 'c2', name: 'ODST Demolition' },
  { id: 'c3', name: 'Elite Honor Guard' },
  { id: 'c4', name: 'Grunt Squad Leader' },
];

// ── AddonFormHarness ─────────────────────────────────────────────────────────

/**
 * Every addon form implements the same AddonFormProps contract, which is what
 * lets AddAddonModal mount any of them as its "create" step. Rather than
 * repeat a near-identical demo per form, this harness mounts one at a time in
 * exactly the shape the modal would — creating (editingAddon = null), with a
 * save that resolves to a stub id instead of writing to Supabase.
 */
const AddonFormHarness = ({
  forms,
}: {
  forms: { label: string; Form: React.ComponentType<AddonFormProps> }[];
}) => {
  const [active, setActive] = useState(forms[0].label);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const Form = forms.find(f => f.label === active)!.Form;

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {forms.map(f => (
          <Button
            key={f.label}
            size="sm"
            variant={f.label === active ? 'filled' : 'outline'}
            color={f.label === active ? 'primary' : 'secondary'}
            onClick={() => { setActive(f.label); setLastSaved(null); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <GalleryNote>
        Mounted the way AddAddonModal mounts it: <code>editingAddon</code> is null
        (create mode) and <code>onSave</code> resolves to a stub id rather than
        writing to Supabase, so Save exercises the form's own validation without
        persisting. Forms that look up keywords or rules will still hit the
        network for those lists.
        {lastSaved && ` Last save returned: ${lastSaved}.`}
      </GalleryNote>

      <div className="w-full max-w-2xl rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <Form
          editingAddon={null}
          saving={false}
          onCancel={() => setLastSaved('(cancelled)')}
          onSave={async name => {
            setLastSaved(`"${name}" → stub-addon-id`);
            return 'stub-addon-id';
          }}
        />
      </div>
    </div>
  );
};

/** The per-game addon forms. */
const GAME_ADDON_FORMS = [
  { label: 'Halo — Weapon',        Form: HaloWeaponForm },
  { label: 'Kill Team — Weapon',   Form: KillTeamWeaponForm },
  { label: 'Kill Team — Ability',  Form: KillTeamAbilityForm },
  { label: 'StarCraft — Weapon',   Form: StarcraftWeaponForm },
  { label: 'StarCraft — Ability',  Form: StarcraftAbilityForm },
];

/** Repent Ye Foolish Gods has the largest family of addon forms. */
const RYG_ADDON_FORMS = [
  { label: 'Weapon',        Form: RygWeaponForm },
  { label: 'Talent',        Form: RygTalentForm },
  { label: 'Spell',         Form: RygSpellForm },
  { label: 'Sept',          Form: RygSeptForm },
  { label: 'Sept Benefit',  Form: RygSeptBenefitForm },
  { label: 'God',           Form: RygGodForm },
  { label: 'Destiny',       Form: RygDestinyForm },
  { label: 'Warrior Type',  Form: RygWarriorTypeForm },
  { label: 'Simple Addon',  Form: RygSimpleAddonForm },
];

// ── AddToPackModalGalleryDemo ────────────────────────────────────────────────

/** Live AddToPackModal preview. The picker hits Supabase with stubbed
 *  pack/game IDs, so the list will be empty unless you happen to be
 *  signed in as a user who owns packs with matching IDs — which won't
 *  happen with these constants. The point is to see the modal chrome
 *  (header, "New X" button, OR divider, search, empty state, CTAs). */
const AddToPackModalGalleryDemo = () => {
  const [open, setOpen] = useState(false);
  const STUB_ID = '00000000-0000-0000-0000-000000000000';
  return (
    <div className="flex items-center gap-3">
      <Button onClick={() => setOpen(true)}>Open Add to Pack Modal</Button>
      <p className="font-body text-xs text-gray-400 dark:text-gray-500">
        Picker uses stub IDs — list will show the "nothing to copy" empty state.
      </p>
      <AddToPackModal
        open={open}
        onClose={() => setOpen(false)}
        entityType="keyword"
        gameId={STUB_ID}
        targetPackId={STUB_ID}
        title="Add Keyword to Pack"
        newButtonLabel="New Keyword"
        onCreateNew={() => alert('New keyword flow')}
        onAdded={() => setOpen(false)}
      />
    </div>
  );
};

// ── ZoomControlsGalleryDemo ──────────────────────────────────────────────────

/** Live ZoomControls preview. Outline + labels at md+, secondary icon-only
 *  below md — resize the window to see the mobile treatment. Buttons disable
 *  at the 0.5 / 1.0 bounds. */
const ZoomControlsGalleryDemo = () => {
  const [zoom, setZoom] = useState(0.7);
  return (
    <div className="flex flex-col gap-2">
      <ZoomControls
        zoomLevel={zoom}
        onZoomOut={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
        onZoomIn={() => setZoom(z => Math.min(1.0, +(z + 0.1).toFixed(1)))}
      />
      <p className="font-body text-xs text-gray-400 dark:text-gray-500">
        Zoom level: {zoom.toFixed(1)} · resize below 768px (md) for the mobile icon-only style.
      </p>
    </div>
  );
};

// ── PlaySessionPromptGalleryDemo ─────────────────────────────────────────────

/** The prompt shown when Play mode opens on a deck whose game was last played
 *  on an earlier day. Both wordings are covered: a dated game, and the fallback
 *  when the timestamp is unknown. A game from today never triggers this — the
 *  deck goes straight into Play instead. */
const PlaySessionPromptGalleryDemo = () => {
  const [open, setOpen]     = useState(false);
  const [dated, setDated]   = useState(true);
  const [choice, setChoice] = useState<string>('—');

  // Three days back, so the demo exercises the "N days ago" wording.
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { setDated(true); setOpen(true); }}>
          Open (played 3 days ago)
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setDated(false); setOpen(true); }}>
          Open (date unknown)
        </Button>
      </div>

      <PlaySessionPrompt
        open={open}
        lastPlayed={dated ? threeDaysAgo : null}
        onContinue={() => { setChoice('Continued the old game'); setOpen(false); }}
        onStartFresh={() => { setChoice('Started a new game'); setOpen(false); }}
        onClose={() => { setChoice('Dismissed — stays in Edit'); setOpen(false); }}
      />

      <p className="font-body text-xs text-gray-400 dark:text-gray-500">
        Last choice: {choice}
      </p>
    </div>
  );
};

// ── DeckPanelMenuGalleryDemo ─────────────────────────────────────────────────

/** Both states of the card-list header action: the ⋯ menu at rest, and the
 *  tick button it becomes while the deck is being edited. Stateful so the
 *  swap between them is demonstrable. */
const DeckPanelMenuGalleryDemo = () => {
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-6 items-center">
        <div className="flex flex-col gap-1 items-center">
          <DeckPanelMenu
            editMode={editMode}
            onToggleEdit={() => setEditMode(m => !m)}
            onShare={() => {}}
          />
          <p className="font-body text-xs text-gray-400 dark:text-gray-500">
            {editMode ? 'Editing — tick to finish' : 'At rest — ⋯ menu'}
          </p>
        </div>

        <div className="flex flex-col gap-1 items-center">
          <DeckPanelMenu
            editMode={false}
            onToggleEdit={() => {}}
            onShare={() => {}}
            editLabel="Reorder warriors"
          />
          <p className="font-body text-xs text-gray-400 dark:text-gray-500">
            Custom editLabel (RYG)
          </p>
        </div>
      </div>

      <p className="font-body text-xs text-gray-400 dark:text-gray-500">
        Open the ⋯ menu and pick the edit entry to see it swap to the tick.
      </p>
    </div>
  );
};

// ── ShareDeckSheetGalleryDemo ────────────────────────────────────────────────

/** The share sheet reads its state from the deck it's given, so a gallery demo
 *  can only show the shape — pointed at an id that doesn't exist, it renders
 *  the "couldn't check" path. The shared and not-yet-shared states need a real
 *  deck, in a builder. */
const ShareDeckSheetGalleryDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" className="self-start" onClick={() => setOpen(true)}>
        Open share sheet
      </Button>
      <ShareDeckSheet
        open={open}
        onClose={() => setOpen(false)}
        deckId="00000000-0000-0000-0000-000000000000"
        deckName="Imperial Nobility 11's Team"
      />
      <p className="font-body text-xs text-gray-400 dark:text-gray-500">
        Bound to a placeholder deck id, so this shows the error state. Its real
        states — "create share link" and a live link with copy / stop sharing —
        appear on a deck you own, via ⋯ → Share in any builder.
      </p>
    </div>
  );
};

// ── BuilderShellDemo ──────────────────────────────────────────────────────────

/** Inline preview of <CenterViewport> in its real setting — the shared
 *  <BuilderShell> + <ListPanel> + <EditorPanel>, with BattleCards' own centre
 *  column and unit-list rows. The shell pieces have their own demos in the
 *  shared gallery; this one exists to show the local centre column in context.
 *  Stateful so the deck-name rename and mobile panel toggles are demonstrable. */
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
        navbar={<AppNavbar fixed={false} />}
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
          <ListPanel
            title={deckName}
            editingTitle={editingName}
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
          </ListPanel>
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

// ── Local nav ────────────────────────────────────────────────────────────────

/** Sidebar entries for this app's own sections, appended after the shared ones. */
const LOCAL_NAV: GalleryNavItem[] = [
  { href: '#nav-navbar',                label: 'Navbar',                icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-zoom-controls',         label: 'Zoom Controls',         icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-unit-list-entry',       label: 'Unit List Entry',       icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-deck-card-list',        label: 'Deck Card List',        icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-bb-card',               label: 'BB Card',               icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-bb-star-card',          label: 'BB Star Card',          icon: <Star className="w-5 h-5" /> },
  { href: '#nav-halo-card',             label: 'Halo Card',             icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-sc-card',               label: 'SC Card',               icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-sc-phase-frame',        label: 'SC Phase Frame',        icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-kill-team-card',        label: 'KT Card',               icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-kill-team-rule-card',   label: 'KT Rule Card',          icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-ryg-card',              label: 'RYG Card',              icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-god-card',              label: 'God Card',              icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-sept-card',             label: 'Sept Card',             icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-card-carousel',         label: 'Card Carousel',         icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-addon-info-modal',      label: 'Addon Info Modal',      icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-card-3d',               label: 'Card 3D Wrapper',       icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-deck-list-item',        label: 'Deck List Item',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-pack-list-item',        label: 'Pack List Item',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-add-to-pack-modal',     label: 'Add to Pack Modal',     icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-addon-list-item',       label: 'Addon List Item',       icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-attached-addon-row',    label: 'Attached Addon Row',    icon: <ListCheck className="w-5 h-5" /> },
  { href: '#nav-add-addon-modal',       label: 'Add Addon Modal',       icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-add-keyword-modal',     label: 'Add Keyword Modal',     icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-add-rule-modal',        label: 'Add Rule Modal',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-keyword-info-modal',    label: 'Keyword Info Modal',    icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-weapon-info-modal',     label: 'Weapon Info Modal',     icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-blog-entry-preview',    label: 'Blog Entry Preview',    icon: <FileText className="w-5 h-5" /> },
  { href: '#nav-upload-photo-modal',    label: 'Upload Photo Modal',    icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-game-picker-item',      label: 'Game Picker Item',      icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-import-list-modal',     label: 'Import List Modal',     icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-save-template-modal',   label: 'Save Template Modal',   icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-new-card-modal',        label: 'New Card Modal',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-play-subnav',           label: 'Play Subnav',           icon: <Play className="w-5 h-5" /> },
  { href: '#nav-edit-subnav',           label: 'Edit Subnav',           icon: <Pen2 className="w-5 h-5" /> },
  { href: '#nav-token-menu',            label: 'Token Menu',            icon: <Filter className="w-5 h-5" /> },
  { href: '#nav-token-overlay',         label: 'Token Overlay',         icon: <Filter className="w-5 h-5" /> },
  { href: '#nav-token-badge',           label: 'Token Badge & Bar',     icon: <Shield className="w-5 h-5" /> },
  { href: '#nav-custom-token-modal',    label: 'Custom Token Modal',    icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-sc-supply-tiers',       label: 'SC Supply Tiers',       icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-sc-add-keyword',        label: 'SC Add Keyword',        icon: <Gallery className="w-5 h-5" /> },
  { href: '#nav-print-card-grid',       label: 'Print Card Grid',       icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-center-viewport',       label: 'Center Viewport',       icon: <Widget2 className="w-5 h-5" /> },
  { href: '#nav-card-forms',            label: 'Card Forms',            icon: <Pen2 className="w-5 h-5" /> },
  { href: '#nav-addon-forms',           label: 'Addon Forms',           icon: <Pen2 className="w-5 h-5" /> },
  { href: '#nav-ryg-forms',             label: 'RYG Forms',             icon: <Pen2 className="w-5 h-5" /> },
  { href: '#nav-print-mixed',           label: 'Print Mixed Types',     icon: <Bookmark className="w-5 h-5" /> },
  { href: '#nav-play-session-prompt',   label: 'Play Session Prompt',   icon: <Play className="w-5 h-5" /> },
  { href: '#nav-deck-panel-menu',       label: 'Deck Panel Menu',       icon: <Pen2 className="w-5 h-5" /> },
  { href: '#nav-share-deck-sheet',      label: 'Share Deck Sheet',      icon: <Gallery className="w-5 h-5" /> },
];

// ── Gallery page ─────────────────────────────────────────────────────────────

const ComponentGallery = () => {
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
  const [selectedAddonId,    setSelectedAddonId]    = useState<string | null>(null);
  const [pickedGame,         setPickedGame]         = useState<string | null>(null);
  const [carouselActive,     setCarouselActive]     = useState(CAROUSEL_ITEMS[1].id);
  const [tokenBarValue,      setTokenBarValue]      = useState(4);
  const [customTokenOpen,    setCustomTokenOpen]    = useState(false);
  const [customTokenEditing, setCustomTokenEditing] = useState<CustomTokenFormValue | null>(null);
  const [addRuleOpen,        setAddRuleOpen]        = useState(false);
  const [supplyTiersOpen,    setSupplyTiersOpen]    = useState(false);
  const [scKeywordOpen,      setScKeywordOpen]      = useState(false);
  const [scKeywordCreateOnly,setScKeywordCreateOnly]= useState(false);
  const [supplyTiers,        setSupplyTiers]        = useState<StarcraftSupplyTier[]>([
    { maxModels: 2, supply: 1 },
    { maxModels: 4, supply: 2 },
    { maxModels: 6, supply: 3 },
  ]);

  const galleryTemplates: NewCardModalTemplate[] = [
    { id: 't1', name: 'Spartan Sergeant' },
    { id: 't2', name: 'Elite Honor Guard' },
    { id: 't3', name: 'ODST Demolition' },
    { id: 't4', name: 'Grunt Squad Leader' },
    { id: 't5', name: 'Jackal Sniper' },
    { id: 't6', name: 'Brute Chieftain' },
  ];

  return (
    <GalleryShell appName="BattleCards" nav={[...SHARED_GALLERY_NAV, ...LOCAL_NAV]}>

      {/* Every @battleplans/ui component — see packages/ui/src/gallery/SharedSections.tsx */}
      <SharedGallerySections appName="BattleCards" />

      {/* ════════════════════════════════════════════════════════════════
          Everything below is a BattleCards-only component.
      ════════════════════════════════════════════════════════════════ */}

      <GallerySection id="nav-navbar" title="Navbar / Default">

        {/* Preview wrapper — simulates a page viewport at reduced size */}
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">

          {/* Navbar rendered with fixed=false so it stays inside the preview */}
          <AppNavbar fixed={false} />

          {/* Simulated page body beneath the navbar */}
          <div className="h-24 bg-gray-50 dark:bg-gray-950 flex items-center
                          justify-center px-4">
            <p className="font-body text-xs text-gray-400 italic">
              Page content sits here
            </p>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-zoom-controls" title="Zoom Controls / Default">
        <ZoomControlsGalleryDemo />
      </GallerySection>

      <GallerySection id="nav-unit-list-entry" title="Unit List Entry">
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

          {/* Number badge — e.g. Blood Bowl jersey numbers */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Number badge</p>
            <div className="space-y-1">
              <UnitListEntry status="complete" number="7"  unitName="Griff Oberwald" unitType="Blitzer" />
              <UnitListEntry status="complete" number="12" active unitName="Karla von Kill" unitType="Blitzer" />
            </div>
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-deck-card-list" title="Deck Card List">
        <div className="w-full max-w-sm space-y-6">

          {/* Edit mode — one flat list in deck order; rules are inline
              entries (kind: 'rule'), not a separate section. */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Edit mode — flat deck order</p>
            <div className="space-y-1">
              <DeckCardList
                entries={[
                  { id: 'u1', kind: 'unit', status: 'complete', name: 'Jane-664',        type: 'Spartan ZVEZDA', dragIndex: 0, deleteDisabled: false },
                  { id: 'u2', kind: 'unit', status: 'pending',  name: 'Mk. VII Warrior', type: 'UNSC Marine',    dragIndex: 1 },
                  { id: 'r1', kind: 'rule', status: 'complete', name: 'Flashpoint Objectives', type: 'Faction Rule' },
                ]}
                activeId="u1"
                editMode
                playMode={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onDuplicate={() => {}}
              />
            </div>
          </div>

          {/* Play mode — grouped: non-activated units, an "Activated"
              sub-section, then rules pinned to the bottom. */}
          <div>
            <p className="font-body text-xs text-gray-400 dark:text-gray-500 mb-2">Play mode — grouped</p>
            <div className="space-y-1">
              <DeckCardList
                entries={[
                  { id: 'u1', kind: 'unit', status: 'complete', name: 'Jane-664',        type: 'Spartan ZVEZDA', activated: false },
                  { id: 'u2', kind: 'unit', status: 'complete', name: 'Mk. VII Warrior', type: 'UNSC Marine',    activated: true },
                  { id: 'r1', kind: 'rule', status: 'complete', name: 'Flashpoint Objectives', type: 'Faction Rule' },
                ]}
                activeId="u1"
                editMode={false}
                playMode
                onSelect={() => {}}
              />
            </div>
          </div>

        </div>
      </GallerySection>

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

      <GallerySection id="nav-bb-star-card" title="Blood Bowl Star Player Card / Default">
        <div className="flex flex-wrap gap-8 items-start">

          {/* Empty / placeholder state */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Empty state (default props)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 278, height: Math.round(1100 * (278 / 750)) }}>
              <div style={{ transform: `scale(${278 / 750})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <StarPlayerCard />
              </div>
            </div>
          </div>

          {/* Filled — single special rule (Skitter Stab-Stab) */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Filled — one special rule
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 278, height: Math.round(1100 * (278 / 750)) }}>
              <div style={{ transform: `scale(${278 / 750})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <StarPlayerCard
                  teamName="Underworld Challenge"
                  unitName="Skitter Stab-Stab"
                  playerRole="Runner"
                  cost="170,000"
                  ma={9}
                  st={2}
                  ag={2}
                  pa={4}
                  av={8}
                  skills="Dodge, Loner (4+), Prehensile Tail, Shadowing, Stab"
                  specialRules={[
                    { label: 'Master Assassin', name: 'Master Assassin', description: 'Once per game, when Skitter performs a Stab Special Action, he may choose to re-roll the Armour Roll.' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Filled — multiple special rules (overflow / flow check) */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Filled — multiple special rules
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 278, height: Math.round(1100 * (278 / 750)) }}>
              <div style={{ transform: `scale(${278 / 750})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <StarPlayerCard
                  teamName="Old World Classic"
                  unitName="Griff Oberwald"
                  playerRole="Blitzer"
                  cost="280,000"
                  ma={7}
                  st={4}
                  ag={2}
                  pa={3}
                  av={9}
                  skills="Block, Dodge, Fend, Loner (4+), Sprint, Sure Feet"
                  specialRules={[
                    { label: 'Consummate Professional', name: 'Consummate Professional', description: 'Once per turn, Griff may re-roll any single dice roll he has just made (but not one made for him by another player).' },
                    { label: 'Fan Favourite', name: 'Fan Favourite', description: 'Add 1 to any Prayers to Nuffle roll made by a team that has hired Griff for this game.' },
                  ]}
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

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
                  forceLayout="desktop"
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

          {/* Mobile layout — play mode with a horizontal wound bar beneath
              the card. Demonstrates the bar-tracker placement and the
              outer wrapper growing to host bars on mobile. */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Mobile layout / Play mode (bar tracker)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 356, height: Math.round(1390 * (356 / 890)) }}>
              <div style={{ transform: `scale(${356 / 890})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <KillTeamCard
                  forceLayout="mobile"
                  operativeName="Nasty Monster Bug 5"
                  role="Venomspitter"
                  tags="Ravener, Great Devourer, Tyranid, Venomspitter"
                  actions={3}
                  movement={3}
                  save={3}
                  wounds={20}
                  baseSize={20}
                  weapons={[
                    { name: 'Tall Blade',     meleeOrRanged: 'melee',  attack: 4, hit: '3+', damage: '3/4', keywords: 'Range [3], Rending, Silent' },
                    { name: 'Pincer Tail',    meleeOrRanged: 'ranged', attack: 4, hit: '3+', damage: '3/4', keywords: 'Range 8", Blast 2, Poison*' },
                  ]}
                  abilities={[
                    { name: 'Hypersensory Hunter', apCost: 0, keywords: '', description: 'This operative can perform the Charge action while it has a Conceal order if it performed the Burrow action during the same activation/ counteraction.' },
                  ]}
                  tokenOverlay={{
                    definitions: [{
                      id: 'demo-wounds',
                      game_id: 'kill-team',
                      name: 'Wounds',
                      description: null,
                      icon: null,
                      icon_off: null,
                      is_toggle: false,
                      keyword_name: null,
                      keyword_value_role: null,
                      stat_key: 'wounds',
                      stat_role: 'max',
                      starting_value: 0,
                      min_value: 0,
                      max_value: null,
                      refresh_on_turn: 0,
                      is_activation_token: false,
                      sort_order: 0,
                      deck_id: null,
                      display_color: '#22c55e',
                      display_glyph: null,
                      color_set: 'Green',
                      display_style: 'bar',
                      label_on: null,
                      label_off: null,
                      created_at: '2026-01-01T00:00:00Z',
                    }],
                    unitKeywords: [],
                    state: { 'demo-wounds': 7 },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Mobile layout (forced) — portrait 890×1270, defaults to this on
              viewports ≤ 767px. Forced here so it displays alongside the
              desktop demos regardless of the gallery's own viewport. */}
          <div className="flex flex-col gap-2 items-center">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Mobile layout (forced)
            </p>
            <div className="relative overflow-hidden shrink-0" style={{ width: 356, height: Math.round(1270 * (356 / 890)) }}>
              <div style={{ transform: `scale(${356 / 890})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <KillTeamCard
                  forceLayout="mobile"
                  operativeName="Nasty Monster Bug 5"
                  role="Venomspitter"
                  tags="Ravener, Great Devourer, Tyranid, Venomspitter"
                  actions={3}
                  movement={3}
                  save={3}
                  wounds={20}
                  baseSize={20}
                  weapons={[
                    { name: 'Tall Blade',                       meleeOrRanged: 'melee',  attack: 4, hit: '3+', damage: '3/4', keywords: 'Range [3], Rending, Silent' },
                    { name: 'Scything Talons & Rending Blows',  meleeOrRanged: 'melee',  attack: 5, hit: '3+', damage: '4/5', keywords: 'Rending' },
                    { name: 'Venom bolt (Focused)',             meleeOrRanged: 'ranged', attack: 4, hit: '3+', damage: '3/5', keywords: 'Range 8", Piercing 1, Poison*' },
                    { name: 'Pincer Tail',                      meleeOrRanged: 'ranged', attack: 4, hit: '3+', damage: '3/4', keywords: 'Range 8", Blast 2, Poison*' },
                  ]}
                  abilities={[
                    { name: 'Hypersensory Hunter', apCost: 0, keywords: '', description: 'This operative can perform the Charge action while it has a Conceal order if it performed the Burrow action during the same activation/ counteraction.' },
                    { name: 'Ability 2',           apCost: 1, keywords: '', description: 'Until this operative has shot with its venom bolt, until it performs this action again, or until it performs the Burrow action (whichever comes first), all profiles of its venom bolt have the Lethal 5+ weapon rule, have 1 added to their Atk stat and the Range 8" weapon rule removed.' },
                  ]}
                />
              </div>
            </div>
          </div>

        </div>
      </GallerySection>

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

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">With duplicate + delete actions (⋯ menu)</p>
            <DeckListItem
              name="Imperial Nobility 11's Team"
              cardCount={3}
              thumbnailBg="bg-[#15417e]"
              thumbnail={<img src={iconBloodBowl} alt="" className="size-full object-cover" />}
              onDuplicate={() => {}}
              onDelete={() => {}}
            />
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-pack-list-item" title="Pack List Item">
        {/* Constrain to ~342px so the demo matches its real-world width. */}
        <div className="w-full max-w-[342px] space-y-6">

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Public pack — Download CTA, no menu</p>
            <PackListItem
              name="Black Orc Player Cards"
              gameName="Blood Bowl"
              thumbnailBg="bg-[#15417e]"
              thumbnail={<img src={iconBloodBowl} alt="" className="size-full object-cover" />}
              badges={[
                { label: '8 Units',   icon: <UserRounded className="size-3.5" /> },
                { label: '14 Skills', icon: <Star        className="size-3.5" /> },
              ]}
              description="All the Black Orc players from Season 3 of Blood Bowl, including all skills and traits."
              cta={{ label: 'Download Pack', icon: <AddCircle className="size-4" />, onClick: () => {} }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Owned pack — Edit CTA + ⋯ menu with Delete</p>
            <PackListItem
              name="My Custom Spartans"
              gameName="Halo: Flashpoint"
              thumbnailBg="bg-gradient-to-b from-[#252525] to-[#181d24]"
              thumbnail={<img src={iconHalo} alt="" className="size-full object-cover" />}
              badges={[
                { label: '6 Units',   icon: <UserRounded className="size-3.5" /> },
                { label: '8 Weapons', icon: <Star        className="size-3.5" /> },
              ]}
              description="A custom Spartan strike team I made for our home league."
              onDelete={() => {}}
              deleteLabel="Delete Pack"
              cta={{ label: 'Edit Pack', icon: <Pen2 className="size-4" />, onClick: () => {} }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Imported pack — ⋯ menu with Uninstall, no CTA</p>
            <PackListItem
              name="Spartan Strike Team"
              gameName="Halo: Flashpoint"
              thumbnailBg="bg-gradient-to-b from-[#252525] to-[#181d24]"
              thumbnail={<img src={iconHalo} alt="" className="size-full object-cover" />}
              badges={[
                { label: '6 Units',   icon: <UserRounded className="size-3.5" /> },
                { label: '8 Weapons', icon: <Star        className="size-3.5" /> },
                { label: '3 Rules',   icon: <FileText    className="size-3.5" /> },
              ]}
              description="A starter pack imported from the community."
              onDelete={() => {}}
              deleteLabel="Uninstall Pack"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">No description (header + badges only)</p>
            <PackListItem
              name="Quick Reference"
              gameName="Blood Bowl"
              thumbnailBg="bg-[#15417e]"
              thumbnail={<img src={iconBloodBowl} alt="" className="size-full object-cover" />}
              badges={[
                { label: '4 Skills', icon: <Star className="size-3.5" /> },
              ]}
              cta={{ label: 'Download Pack', icon: <AddCircle className="size-4" />, onClick: () => {} }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">No badges (header + description only)</p>
            <PackListItem
              name="Lore Compendium"
              gameName="Halo: Flashpoint"
              thumbnailBg="bg-gradient-to-b from-[#252525] to-[#181d24]"
              thumbnail={<img src={iconHalo} alt="" className="size-full object-cover" />}
              description="Background lore for every faction in Halo: Flashpoint. No game content — just flavour text."
              cta={{ label: 'Download Pack', icon: <AddCircle className="size-4" />, onClick: () => {} }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Minimal (header only — no menu, no download, no badges, no description)</p>
            <PackListItem
              name="Imported Pack"
              gameName="Blood Bowl"
              thumbnailBg="bg-[#15417e]"
              thumbnail={<img src={iconBloodBowl} alt="" className="size-full object-cover" />}
            />
          </div>

        </div>
      </GallerySection>

      <GallerySection id="nav-add-to-pack-modal" title="Add to Pack Modal">
        <AddToPackModalGalleryDemo />
      </GallerySection>

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
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">Body clamped to 5 lines (long text)</p>
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

          <div className="flex flex-col gap-2">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              Markdown body (how News &amp; Updates renders it) — SM Regular, clamped to 5 lines
            </p>
            <BlogEntryPreview
              title="Collection Covers"
              body={<MarkdownBody>{MARKDOWN_SAMPLE}</MarkdownBody>}
              onRead={() => {}}
            />
          </div>

        </div>
      </GallerySection>

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

      <GallerySection id="nav-play-subnav" title="PlaySubnav / Units &amp; Rules">
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
          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">
              With a game in progress — turn counter and End game. The end
              button asks to confirm in place before it throws the board away.
            </Text>
            <PlaySubnav tab="units" onTabChange={() => {}} turn={3} onEndGame={() => {}} />
          </div>
          <div className="flex flex-col gap-3">
            <Text size="sm" color="secondary">
              Turn shown without an end control (builder without persistence)
            </Text>
            <PlaySubnav tab="units" onTabChange={() => {}} turn={1} />
          </div>
        </div>
      </GallerySection>

      <GallerySection id="nav-edit-subnav" title="EditSubnav / Card List &amp; Editor (tablet + mobile)">
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
              card={{ stats: { hp: 3 }, unitKeywords: [{ keywordName: 'Energy Shield', paramValue: 2 }] }}
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
                gameSlug="halo-flashpoint"
                tokenDefinitions={[
                  { id: 'demo-damage', game_id: '', name: 'Damage', description: null, icon: 'Token Type=Damage, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: 'hp', stat_role: 'max', starting_value: 0, min_value: 0, max_value: null, sort_order: 1, created_at: '' },
                  { id: 'demo-shield', game_id: '', name: 'Shield', description: null, icon: 'Token Type=Shield, State=Default', icon_off: 'Token Type=Shield, State=Off', is_toggle: true, keyword_name: 'Energy Shield', keyword_value_role: 'max', stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: null, sort_order: 2, created_at: '' },
                  { id: 'demo-crouch', game_id: '', name: 'Crouching', description: null, icon: 'Token Type=Crouch, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: 1, sort_order: 3, created_at: '' },
                  { id: 'demo-pinned', game_id: '', name: 'Pinned', description: null, icon: 'Token Type=Pinned, State=Default', icon_off: null, is_toggle: false, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: null, min_value: 0, max_value: 1, sort_order: 4, created_at: '' },
                  { id: 'demo-activated', game_id: '', name: 'Activated', description: null, icon: 'Token Type=Activated, State=Default', icon_off: 'Token Type=Activated, State=Off', is_toggle: true, keyword_name: null, keyword_value_role: null, stat_key: null, stat_role: null, starting_value: 1, min_value: 0, max_value: 1, sort_order: 5, created_at: '' },
                ] as TokenDefinition[]}
                card={{ stats: { hp: 4 }, unitKeywords: [{ keywordName: 'Energy Shield', paramValue: 3 }] }}
                tokenState={{ 'demo-activated': 1, 'demo-crouch': 0, 'demo-pinned': 0, 'demo-damage': 2, 'demo-shield': 2 }}
              />
            </div>
          </div>
        </div>
      </GallerySection>

      <GallerySection id="nav-print-card-grid" title="PrintCardGrid / Blood Bowl (A4)">
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

      <GallerySection id="nav-center-viewport" title="Center Viewport">
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

      {/* The centre column in its real setting. <BuilderShell>, <ListPanel> and
          <EditorPanel> are shared — their own demos are in the shared gallery
          above — so this section is about what BattleCards puts between them. */}
      <GallerySection title="Center Viewport / In the builder shell">
        <BuilderShellDemo />
      </GallerySection>

      <GallerySection id="nav-card-forms" title="Card Forms / Halo Flashpoint">
        <p className="font-body text-sm text-gray-400 mb-4">
          Phase 1 stats form — fills in card stats and creates the row in the DB before proceeding to weapons/keywords.
          Phase 2 (content) opens after create. Cancel/Done are non-functional in the gallery.
        </p>
        <div className="max-w-xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <HaloCardForm packId="" gameId="" addonTypes={[]} onSaved={() => {}} onCancel={() => {}} />
        </div>
      </GallerySection>

      <GallerySection title="Card Forms / Blood Bowl">
        <div className="max-w-xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <BloodBowlCardForm packId="" gameId="" onSaved={() => {}} onCancel={() => {}} />
        </div>
      </GallerySection>

      <GallerySection title="Card Forms / Kill Team — Operative">
        <div className="max-w-xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <KillTeamCardForm packId="" gameId="" addonTypes={[]} cardType="operative" onSaved={() => {}} onCancel={() => {}} />
        </div>
      </GallerySection>

      <GallerySection title="Card Forms / Kill Team — Rule Card">
        <div className="max-w-xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <KillTeamCardForm packId="" gameId="" addonTypes={[]} cardType="rule" onSaved={() => {}} onCancel={() => {}} />
        </div>
      </GallerySection>

      <GallerySection title="Card Forms / StarCraft">
        <div className="max-w-xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <StarcraftCardForm packId="" gameId="" addonTypes={[]} onSaved={() => {}} onCancel={() => {}} />
        </div>
      </GallerySection>


      {/* ════════════════════════════════════════════════════════════════
          REPENT YE FOOLISH GODS — CARDS
          The three RYG card faces. RygCard is the warrior card and takes
          inline-edit callbacks; omit them and it renders read-only, which
          is what the gallery shows.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-ryg-card" title="RYG Card / Warrior">
        <RygCard
          warriorName="Hesper of the Ashen Vow"
          type="Zealot"
          sept="Sept of the Broken Chain"
          offense={4}
          defense={3}
          life={5}
          tactics={2}
          fate={3}
          talents="Fanatic, Unyielding, Zealous Charge"
          specialAbilityDesc="Once per battle, Hesper may re-roll every failed Fate test in a single activation."
          weapons={DEMO_RYG_WEAPONS}
          armor={DEMO_RYG_ARMOR}
          items={DEMO_RYG_ITEMS}
          spells={DEMO_RYG_SPELLS}
        />
        <GalleryNote>
          Read-only: the onChange* callbacks are omitted, so the editable fields
          render as plain text. Pass <code>talentList</code> plus{' '}
          <code>onTalentClick</code> instead of the flat <code>talents</code>{' '}
          string to make talent names clickable in the builder.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-god-card" title="RYG God Card">
        <div className="flex flex-wrap gap-6">
          <GodCard
            godName="Vhorr, the Sundered"
            specialAbility="Followers of Vhorr may ignore the first wound suffered each round."
            minions="Chain-thrall, Ash Cur"
            servants="Flagellant, Bone Piper"
            lieutenants="Herald of Rust"
            champions="The Sundering Hand"
          />
          {/* Empty state — every field is optional, so a blank god card is valid */}
          <GodCard />
        </div>
        <GalleryNote>
          Every field is optional; the second card is the blank state a new god
          starts in.
        </GalleryNote>
      </GallerySection>

      <GallerySection id="nav-sept-card" title="RYG Sept Card">
        <div className="flex flex-wrap gap-6">
          <SeptCard
            septName="Sept of the Broken Chain"
            prohibited="Firearms, Mounts"
            required="One Flagellant per three models"
            restricted="Spells of the Third Circle"
            benefits={[
              { name: 'Unbowed',   description: 'Re-roll failed Tactics tests while within 3" of a Champion.' },
              { name: 'Iron Will', description: 'Immune to Fear caused by unbroken enemies.' },
            ]}
            destinyName="The Chain Unmade"
            destinyDesc="Destroy every enemy Champion before the fourth round."
            destinyCurse="If the Destiny fails, all friendly models lose 1 Fate for the rest of the battle."
          />
          {/* Minimal — only the name is required */}
          <SeptCard septName="Sept of Quiet Hours" />
        </div>
        <GalleryNote>
          Only <code>septName</code> is required; the second card shows a sept with
          no benefits or destiny yet.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CARD CAROUSEL
          The centre of every builder: a zoomable, swipeable strip showing
          the previous / active / next card. Generic over any item with an
          id, so each builder passes its own card component to renderItem.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-card-carousel" title="Card Carousel">
        <div className="w-full h-[620px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <CardCarousel
            items={CAROUSEL_ITEMS}
            activeId={carouselActive}
            onActiveChange={setCarouselActive}
            cardWidth={340}
            cardHeight={520}
            renderItem={(item, role) => (
              <div
                className={`w-[340px] h-[520px] rounded-2xl border-2 flex flex-col items-center justify-center gap-3
                            ${role === 'active'
                              ? 'border-primary-500 bg-gray-100 dark:bg-gray-900'
                              : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950'}`}
              >
                <Shield className={`w-16 h-16 ${role === 'active' ? 'text-primary-500' : 'text-gray-400'}`} />
                <p className="font-heading text-xl text-gray-900 dark:text-white">{item.name}</p>
                <p className="font-body text-xs uppercase tracking-widest text-gray-400">{role}</p>
              </div>
            )}
          />
        </div>
        <GalleryNote>
          Active card: {CAROUSEL_ITEMS.find(i => i.id === carouselActive)?.name}. Swipe
          or drag to page; the zoom controls sit bottom-right unless you pass{' '}
          <code>hideZoomControls</code>. <code>bottomLeftSlot</code> /{' '}
          <code>bottomRightSlot</code> are where builders hang their own actions.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          ATTACHED ADDON ROW
          A row in an editor panel's "attached" list — click to open, X to
          detach.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-attached-addon-row" title="Attached Addon Row">
        <div className="w-full max-w-md flex flex-col gap-2">
          <AttachedAddonRow
            name="Plasma Rifle"
            subtitle="Rng 12 · Dmg 3 · Overheat"
            onClick={() => alert('Open Plasma Rifle')}
            onRemove={() => alert('Detach Plasma Rifle')}
          />
          <AttachedAddonRow
            name="Energy Sword"
            subtitle="Melee · Dmg 4 · Lethal"
            onClick={() => alert('Open Energy Sword')}
            onRemove={() => alert('Detach Energy Sword')}
          />
          {/* No onClick — the row is display-only, but still detachable */}
          <AttachedAddonRow
            name="Camouflage"
            subtitle="Ability"
            onRemove={() => alert('Detach Camouflage')}
            removeAriaLabel="Remove Camouflage"
          />
        </div>
        <GalleryNote>
          Omit <code>onClick</code> and the row is display-only — the third row
          here — but the remove control stays.
        </GalleryNote>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          TOKENS
          Play-mode counters. TokenBadge is one circular token; TokenBar is
          the segmented wound/ammo track drawn beside a card.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-token-badge" title="Token Badge & Bar">
        <div className="w-full flex flex-wrap gap-10 items-start">

          <div className="flex flex-col gap-3">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">TokenBadge — sizes</p>
            <div className="flex items-end gap-3">
              <TokenBadge color="#ef4444" glyph="W" size={28} />
              <TokenBadge color="#3b82f6" glyph="A" size={40} />
              <TokenBadge color="#22c55e" glyph="S" size={56} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              With a count, and with a shadow
            </p>
            <div className="flex items-end gap-3">
              <TokenBadge color="#a855f7" glyph="F" size={44} count={3} />
              <TokenBadge color="#f59e0b" glyph="P" size={44} count={12} />
              <TokenBadge color="#64748b" glyph="X" size={44} shadow />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">
              TokenBar — vertical (click a segment to change it)
            </p>
            <div className="flex items-end gap-6 h-40">
              <TokenBar
                max={6}
                current={tokenBarValue}
                palette={paletteFromHex('#ef4444')}
                width={22}
                height={150}
                onChange={setTokenBarValue}
              />
              <TokenBar max={4} current={4} palette={paletteFromHex('#22c55e')} width={22} height={150} />
              <TokenBar max={4} current={0} palette={paletteFromHex('#3b82f6')} width={22} height={150} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-body text-xs text-gray-400 dark:text-gray-500">TokenBar — horizontal</p>
            <TokenBar
              max={8}
              current={5}
              palette={paletteFromHex('#a855f7')}
              width={200}
              height={22}
              orientation="horizontal"
            />
          </div>

          <GalleryNote>
            Bar value: {tokenBarValue} / 6. Palettes come from{' '}
            <code>paletteFromColorSet</code> (a named Tailwind set) or{' '}
            <code>paletteFromHex</code> (a token's own display colour) — the demos
            above use the hex form. Omit <code>onChange</code> for a read-only bar.
          </GalleryNote>
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          CUSTOM TOKEN MODAL
          Create or edit a user-defined play-mode token.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-custom-token-modal" title="Custom Token Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { setCustomTokenEditing(null); setCustomTokenOpen(true); }}>
            New custom token
          </Button>
          <Button
            variant="outline"
            color="secondary"
            onClick={() => {
              setCustomTokenEditing({ name: 'Overwatch', description: 'This model may fire out of sequence.', color: '#3b82f6', glyph: 'O' });
              setCustomTokenOpen(true);
            }}
          >
            Edit an existing one
          </Button>
          <GalleryNote>
            Passing <code>editing</code> switches it to edit mode and reveals the
            delete action (wired to <code>onDelete</code>). Saving here just closes
            the modal.
          </GalleryNote>
          <CustomTokenModal
            open={customTokenOpen}
            onClose={() => setCustomTokenOpen(false)}
            editing={customTokenEditing}
            onSave={() => setCustomTokenOpen(false)}
            onDelete={customTokenEditing ? () => setCustomTokenOpen(false) : undefined}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          ADD RULE MODAL
          Pick a rule from the library, or create one inline. Talks to
          Supabase for the picker list.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-add-rule-modal" title="Add Rule Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setAddRuleOpen(true)}>Open Add Rule Modal</Button>
          <GalleryNote>
            The picker loads this game's rules from Supabase, so signed out (or on a
            game with no rules) you land on the empty state and the "create a rule"
            step — which is the more interesting half anyway. Pass{' '}
            <code>editingRule</code> to open straight into edit mode.
          </GalleryNote>
          <AddRuleModal
            open={addRuleOpen}
            onClose={() => setAddRuleOpen(false)}
            gameSlug="halo-flashpoint"
            onRuleSelected={() => setAddRuleOpen(false)}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          STARCRAFT — SUPPLY TIERS & KEYWORDS
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-sc-supply-tiers" title="StarCraft Supply Tiers Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setSupplyTiersOpen(true)}>Open Supply Tiers Modal</Button>
          <GalleryNote>
            Edits the model-count → supply-cost ladder shown on a StarCraft card.
            Purely local state, so this demo is fully interactive.
          </GalleryNote>
          <StarcraftSupplyTiersModal
            open={supplyTiersOpen}
            tiers={supplyTiers}
            onSave={t => { setSupplyTiers(t); setSupplyTiersOpen(false); }}
            onClose={() => setSupplyTiersOpen(false)}
          />
        </div>
      </GallerySection>

      <GallerySection id="nav-sc-add-keyword" title="StarCraft Add Keyword Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { setScKeywordCreateOnly(false); setScKeywordOpen(true); }}>
            Pick or create
          </Button>
          <Button variant="outline" color="secondary" onClick={() => { setScKeywordCreateOnly(true); setScKeywordOpen(true); }}>
            Create only
          </Button>
          <GalleryNote>
            Like Add Rule, the picker reads from Supabase. <code>createOnly</code>{' '}
            skips the picker entirely — used where there is nothing to pick from
            yet. A StarCraft keyword can carry a value, which adds a third
            "set value" step after you choose one.
          </GalleryNote>
          <StarcraftAddKeywordModal
            open={scKeywordOpen}
            onClose={() => setScKeywordOpen(false)}
            createOnly={scKeywordCreateOnly}
            onKeywordSelected={() => setScKeywordOpen(false)}
          />
        </div>
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          ADDON FORMS
          Every addon form implements the same AddonFormProps contract so
          AddAddonModal can mount any of them as its "create" step. That
          shared shape is why one harness can demo them all — pick a form
          and it renders exactly as the modal would mount it.
      ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-addon-forms" title="Addon Forms / Halo, Kill Team & StarCraft">
        <AddonFormHarness forms={GAME_ADDON_FORMS} />
      </GallerySection>

      <GallerySection id="nav-ryg-forms" title="Addon Forms / Repent Ye Foolish Gods">
        <AddonFormHarness forms={RYG_ADDON_FORMS} />
      </GallerySection>

      <GallerySection id="nav-print-mixed" title="PrintCardGrid / RYG mixed types (A4)">
        <div className="flex flex-col gap-4 w-full overflow-auto">
          <Text size="sm" color="secondary">
            Warriors, a sept and a god all print at 69×95 mm, so they share one
            set of pages rather than starting a fresh sheet per type. Pages are
            grouped by slot size; background art and card size stay per-card.
          </Text>
          <div className="bg-gray-800 p-6 rounded-lg overflow-auto">
            <PrintCardGrid
              gameSlug="ryg"
              paperSize="a4"
              printSize={[63, 89]}
              bleedSize={[69, 95]}
              excludedIds={new Set()}
              rygCards={[
                { id: 'rw1', warriorName: 'Kael the Sworn', type: 'Warrior', sept: 'Ashborn', offense: 4, defense: 3, life: 8, tactics: 2, fate: 3, talents: 'Cleave', talentList: [], specialAbilityDesc: '', weapons: [], armor: [], items: [], spells: [], portrait: null, avatarUrl: null },
                { id: 'rw2', warriorName: 'Mora Quickstep', type: 'Scout', sept: 'Ashborn', offense: 3, defense: 4, life: 6, tactics: 4, fate: 2, talents: 'Evade', talentList: [], specialAbilityDesc: '', weapons: [], armor: [], items: [], spells: [], portrait: null, avatarUrl: null },
                { id: 'rw3', warriorName: 'Brenn Ironhand', type: 'Warrior', sept: 'Ashborn', offense: 5, defense: 2, life: 9, tactics: 1, fate: 2, talents: 'Bulwark', talentList: [], specialAbilityDesc: '', weapons: [], armor: [], items: [], spells: [], portrait: null, avatarUrl: null },
              ]}
              rygSeptCard={{ id: 'rs1', septName: 'Ashborn', prohibited: 'Necromancy', required: 'Fire rites', restricted: 'Heavy armour', benefits: [{ name: 'Emberblood', description: 'Ignore the first burn each battle.' }], destinyName: 'The Long Ash', destinyDesc: 'Endure to be remembered.', destinyCurse: 'Never rest twice in one place.' }}
              rygGodCard={{ id: 'rg1', godName: 'Vashk the Unlit', specialAbility: 'Once per battle, reroll a fate die.', minions: 'Cinder rats', servants: 'Ash wardens', lieutenants: 'The Quenched', champions: 'Vessel of Smoke' }}
            />
          </div>
        </div>
      </GallerySection>

      <GallerySection id="nav-play-session-prompt" title="Play Session Prompt">
        <PlaySessionPromptGalleryDemo />
      </GallerySection>

      {/* ════════════════════════════════════════════════════════════════
          DECK SHARING
          ════════════════════════════════════════════════════════════════ */}
      <GallerySection id="nav-deck-panel-menu" title="Deck Panel Menu">
        <DeckPanelMenuGalleryDemo />
      </GallerySection>

      <GallerySection id="nav-share-deck-sheet" title="Share Deck Sheet">
        <ShareDeckSheetGalleryDemo />
      </GallerySection>

    </GalleryShell>
  );
};

export default ComponentGallery;
