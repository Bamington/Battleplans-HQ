/**
 * SharedDeck.tsx — read-only view of a deck someone shared by link
 *
 * Route: /d/:token — public, deliberately outside ProtectedRoute. Someone sent
 * this link to a person who may well not have an account yet, so the deck has
 * to render for a signed-out visitor; only copying needs an account.
 *
 * The deck belongs to somebody else, so it can't be read with the app's normal
 * client. Everything here goes through a share-token client (shareClient.ts),
 * which unlocks exactly the one deck the token names — see
 * migration_deck_sharing.sql for how RLS is scoped.
 *
 * Cards are loaded and rendered with the same code the print preview uses
 * (loadPrintableDeck + the per-game card components), so a shared deck looks
 * like the deck its owner sees rather than a second-class copy.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Button, Text, supabase } from '@battleplans/ui';
import { Copy } from '@battleplans/ui';
import CardCarousel from '../components/CardCarousel';
import BloodBowlCard from '../components/BloodBowlCard';
import HaloFlashpointCard from '../components/HaloFlashpointCard';
import HaloFlashpointRuleCard from '../components/HaloFlashpointRuleCard';
import KillTeamCard from '../components/KillTeamCard';
import KillTeamRuleCard from '../components/KillTeamRuleCard';
import RygCard from '../components/RygCard';
import SeptCard from '../components/SeptCard';
import GodCard from '../components/GodCard';
import {
  createShareClient,
  loadSharedDeckMeta,
  copySharedDeck,
  type SharedDeckMeta,
} from '../lib/shareClient';
import { loadPrintableDeck, type PrintableDeck } from '../lib/loadPrintableDeck';
import type {
  PrintableBloodBowlCard,
  PrintableHaloCard,
  PrintableRule,
  PrintableKillTeamCard,
  PrintableKillTeamRule,
  PrintableRygCard,
  PrintableRygSept,
  PrintableRygGod,
} from '../components/PrintCardGrid';

// ── Card sizing ──────────────────────────────────────────────────────────────
//
// Native pixel canvas per card type, mirroring PrintCardGrid's table. The
// carousel wants one bounding box for the whole deck, so mixed decks (a Kill
// Team deck holds landscape operatives and portrait rule cards) take the max
// of both axes and each card sits centred in that slot.

type ItemType =
  | 'blood-bowl' | 'halo-unit' | 'halo-rule'
  | 'kt-unit' | 'kt-rule'
  | 'ryg-warrior' | 'ryg-sept' | 'ryg-god';

const NATIVE: Record<ItemType, { w: number; h: number }> = {
  'blood-bowl':  { w: 750,  h: 1100 },
  'halo-unit':   { w: 1270, h: 890  },
  'halo-rule':   { w: 1270, h: 890  },
  'kt-unit':     { w: 1270, h: 890  },
  'kt-rule':     { w: 700,  h: 1200 },
  'ryg-warrior': { w: 890,  h: 1270 },
  'ryg-sept':    { w: 890,  h: 1270 },
  'ryg-god':     { w: 890,  h: 1270 },
};

interface DeckItem {
  id:   string;
  type: ItemType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

/** Flatten a loaded deck into carousel items, in the order the owner sees. */
function itemsFor(deck: PrintableDeck): DeckItem[] {
  const items: DeckItem[] = [];

  if (deck.gameSlug === 'blood-bowl') {
    for (const c of deck.bloodBowlCards) items.push({ id: c.id, type: 'blood-bowl', data: c });
  } else if (deck.gameSlug === 'kill-team') {
    for (const c of deck.killTeamCards) items.push({ id: c.id, type: 'kt-unit', data: c });
    for (const r of deck.killTeamRules) items.push({ id: r.id, type: 'kt-rule', data: r });
  } else if (deck.gameSlug === 'ryg') {
    for (const c of deck.rygCards) items.push({ id: c.id, type: 'ryg-warrior', data: c });
    if (deck.rygSeptCard) items.push({ id: deck.rygSeptCard.id, type: 'ryg-sept', data: deck.rygSeptCard });
    if (deck.rygGodCard)  items.push({ id: deck.rygGodCard.id,  type: 'ryg-god',  data: deck.rygGodCard });
  } else {
    for (const c of deck.haloCards) items.push({ id: c.id, type: 'halo-unit', data: c });
    for (const r of deck.rules)     items.push({ id: r.id, type: 'halo-rule', data: r });
  }

  return items;
}

/** Render one item with the same props PrintCardGrid passes. */
function renderCard(item: DeckItem) {
  switch (item.type) {
    case 'blood-bowl': {
      const c = item.data as PrintableBloodBowlCard;
      return (
        <BloodBowlCard
          teamName={c.teamName}
          unitName={c.unitName}
          playerRole={c.playerRole}
          cost={c.cost}
          skills={c.skills}
          primaryAttribute={c.primaryAttribute}
          secondaryAttribute={c.secondaryAttribute}
          portrait={c.portraitUrl ?? undefined}
          ma={c.ma} st={c.st} ag={c.ag} pa={c.pa} av={c.av}
        />
      );
    }
    case 'halo-unit': {
      const c = item.data as PrintableHaloCard;
      return (
        <HaloFlashpointCard
          unitName={c.unitName}
          keywords={c.keywords}
          ra={c.ra} fi={c.fi} sv={c.sv}
          advanceValue={c.advanceValue}
          sprintValue={c.sprintValue}
          ar={c.ar} hp={c.hp}
          portrait={c.portraitUrl ?? undefined}
          portraitStyle={c.portraitStyle}
          weapons={c.weapons}
        />
      );
    }
    case 'halo-rule': {
      const r = item.data as PrintableRule;
      return <HaloFlashpointRuleCard title={r.title} description={r.description} />;
    }
    case 'kt-unit': {
      const c = item.data as PrintableKillTeamCard;
      return (
        <KillTeamCard
          operativeName={c.operativeName}
          role={c.role}
          teamName={c.teamName}
          tags={c.tags}
          actions={c.actions}
          movement={c.movement}
          save={c.save}
          wounds={c.wounds}
          baseSize={c.baseSize}
          portrait={c.portraitUrl ?? undefined}
          weapons={c.weapons}
          abilities={c.abilities}
        />
      );
    }
    case 'kt-rule': {
      const r = item.data as PrintableKillTeamRule;
      return <KillTeamRuleCard title={r.title} description={r.description} ability={r.ability} />;
    }
    case 'ryg-warrior': {
      const c = item.data as PrintableRygCard;
      return (
        <RygCard
          warriorName={c.warriorName}
          type={c.type}
          sept={c.sept}
          offense={c.offense}
          defense={c.defense}
          life={c.life}
          tactics={c.tactics}
          fate={c.fate}
          talents={c.talents}
          talentList={c.talentList}
          specialAbilityDesc={c.specialAbilityDesc}
          weapons={c.weapons}
          armor={c.armor}
          items={c.items}
          spells={c.spells}
          portrait={c.portrait ?? undefined}
        />
      );
    }
    case 'ryg-sept': {
      const s = item.data as PrintableRygSept;
      return (
        <SeptCard
          septName={s.septName}
          prohibited={s.prohibited}
          required={s.required}
          restricted={s.restricted}
          benefits={s.benefits}
          destinyName={s.destinyName}
          destinyDesc={s.destinyDesc}
          destinyCurse={s.destinyCurse}
        />
      );
    }
    case 'ryg-god': {
      const g = item.data as PrintableRygGod;
      return (
        <GodCard
          godName={g.godName}
          specialAbility={g.specialAbility}
          minions={g.minions}
          servants={g.servants}
          lieutenants={g.lieutenants}
          champions={g.champions}
        />
      );
    }
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

const SharedDeck = () => {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();

  const [meta,      setMeta]      = useState<SharedDeckMeta | null>(null);
  const [deck,      setDeck]      = useState<PrintableDeck | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [signedIn,  setSignedIn]  = useState(false);
  const [activeId,  setActiveId]  = useState('');
  const [copying,   setCopying]   = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setError('That link is missing its deck.'); setLoading(false); return; }

    let cancelled = false;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setSignedIn(!!session);

      const client = createShareClient(token, session?.access_token);

      const loadedMeta = await loadSharedDeckMeta(client);
      if (cancelled) return;
      if (!loadedMeta) {
        // Revoked and never-existed are deliberately the same message —
        // there's nothing useful (or safe) to tell a stranger about which.
        setError('This deck is no longer shared, or the link is wrong.');
        setLoading(false);
        return;
      }
      setMeta(loadedMeta);

      const result = await loadPrintableDeck(client, loadedMeta.deckId);
      if (cancelled) return;
      if (!result.ok) setError(result.error);
      else setDeck(result.deck);

      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [token]);

  const items = useMemo(() => deck ? itemsFor(deck) : [], [deck]);

  // Start on the first card once the deck arrives.
  useEffect(() => {
    if (items.length > 0 && !activeId) setActiveId(items[0].id);
  }, [items, activeId]);

  // One bounding box for the whole deck — see NATIVE above.
  const [cardW, cardH] = useMemo(() => {
    if (items.length === 0) return [1270, 890];
    return [
      Math.max(...items.map(i => NATIVE[i.type].w)),
      Math.max(...items.map(i => NATIVE[i.type].h)),
    ];
  }, [items]);

  // ── Copy ──────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!token) return;

    if (!signedIn) {
      navigate('/login');
      return;
    }

    setCopying(true);
    setCopyError(null);
    try {
      const newDeckId = await copySharedDeck(token);
      navigate(`/app/builder/${meta?.gameSlug}?deckId=${newDeckId}`);
    } catch (err) {
      console.error('[BattleCards] Failed to copy shared deck:', err);
      setCopyError("Couldn't copy this deck. Please try again.");
      setCopying(false);
    }
  }, [token, signedIn, meta, navigate]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="font-body text-sm text-gray-400">Loading deck…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col gap-4 items-center justify-center bg-gray-950 p-6 text-center">
        <Text variant="h5">Deck unavailable</Text>
        <Text variant="paragraph" size="sm" color="secondary">{error}</Text>
        <Button variant="outline" size="sm" onClick={() => navigate('/app')}>
          Go to BattleCards
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">

      {/* ── Header — whose deck this is, and the way to take a copy ───────── */}
      <header className="shrink-0 flex flex-wrap gap-3 items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex gap-3 items-center min-w-0">
          <Avatar
            src={meta?.ownerAvatarUrl ?? undefined}
            alt={meta?.ownerName ?? 'Shared by'}
            size="sm"
          />
          <div className="min-w-0">
            <p className="font-heading text-lg leading-6 text-white truncate">
              {meta?.name}
            </p>
            <p className="font-body text-xs leading-4 text-gray-400 truncate">
              Shared by {meta?.ownerName ?? 'a BattleCards user'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            leftIcon={<Copy className="size-4" />}
            loading={copying}
            onClick={handleCopy}
          >
            {signedIn ? 'Copy to my decks' : 'Sign in to copy'}
          </Button>
          {copyError && (
            <Text variant="paragraph" size="xs" className="text-red-400">{copyError}</Text>
          )}
        </div>
      </header>

      {/* ── The deck itself ───────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <Text variant="paragraph" size="sm" color="secondary">
            This deck doesn't have any cards yet.
          </Text>
        </div>
      ) : (
        <CardCarousel
          items={items}
          activeId={activeId}
          onActiveChange={setActiveId}
          cardWidth={cardW}
          cardHeight={cardH}
          renderItem={renderCard}
          className="w-full flex-1 min-h-0"
        />
      )}
    </div>
  );
};

export default SharedDeck;
