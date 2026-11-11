/**
 * painters.ts — who painted a model.
 *
 * A model is painted by me unless I say otherwise. Off, I can name who painted
 * it; on, I can name someone I painted it FOR. Either person comes from the
 * shared people list (Battleplan's opponents, plus Friends), and a Friend sees
 * the model read-only in their own My Models — see the model_painters
 * migration.
 */

import { useEffect, useState } from 'react';
import { supabase, resolveOpponentIds, type SelectedOpponent } from '@battleplans/ui';

/** The person a model credits, as embedded from `opponents`. */
export interface PainterPerson { id: string; name: string; linked_user_id: string | null }

/** The form's state: the two switches and the one person. */
export interface PainterValue {
  paintedByMe: boolean;
  /** "Painted for someone else" — only meaningful while paintedByMe. */
  forSomeone: boolean;
  /** The painter (not by me) or the recipient (for someone); null = not named. */
  person: SelectedOpponent | null;
}

/** The columns a PainterValue saves as. */
export interface PainterColumns {
  painted_by_me: boolean;
  painter_id: string | null;
  painted_for_id: string | null;
}

export const PAINTED_BY_ME: PainterValue = { paintedByMe: true, forSomeone: false, person: null };

const asPick = (p: PainterPerson): SelectedOpponent => ({ id: p.id, name: p.name, linkedUserId: p.linked_user_id });

export function painterValueOf(paintedByMe: boolean | null | undefined, painter: PainterPerson | null, paintedFor: PainterPerson | null): PainterValue {
  if (paintedByMe === false) return { paintedByMe: false, forSomeone: false, person: painter ? asPick(painter) : null };
  return { paintedByMe: true, forSomeone: !!paintedFor, person: paintedFor ? asPick(paintedFor) : null };
}

/** A model's current painter, for forms that open without the full detail. */
export async function fetchModelPainter(modelId: string): Promise<PainterValue> {
  const { data } = await supabase.from('models')
    .select('painted_by_me, painter:opponents!models_painter_id_fkey ( id, name, linked_user_id ), ' +
            'painted_for:opponents!models_painted_for_id_fkey ( id, name, linked_user_id )')
    .eq('id', modelId).single();
  const r = data as unknown as { painted_by_me: boolean; painter: PainterPerson | null; painted_for: PainterPerson | null } | null;
  return r ? painterValueOf(r.painted_by_me, r.painter, r.painted_for) : PAINTED_BY_ME;
}

/** The @username of a person linked to a real account, for a profile link —
 *  null for a typed name, or while loading. */
export function useLinkedHandle(userId: string | null | undefined): string | null {
  const [handle, setHandle] = useState<string | null>(null);
  useEffect(() => {
    setHandle(null);
    if (!userId) return;
    let cancelled = false;
    supabase.from('public_profiles').select('handle').eq('id', userId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setHandle((data as { handle: string | null } | null)?.handle ?? null); });
    return () => { cancelled = true; };
  }, [userId]);
  return handle;
}

/** One line describing it, e.g. "Painted by Sam" — null when painted by me for no one. */
export function painterLine(v: PainterValue): string | null {
  if (!v.paintedByMe) return v.person ? `Painted by ${v.person.name}` : 'Painted by someone else';
  return v.forSomeone && v.person ? `Painted for ${v.person.name}` : null;
}

/**
 * The columns to save, creating the person in the user's list first if they're
 * new (a typed name, or a Friend picked for the first time).
 */
export async function painterColumns(userId: string, v: PainterValue): Promise<PainterColumns> {
  const named = v.person && (v.paintedByMe ? v.forSomeone : true) ? v.person : null;
  const [id = null] = named ? await resolveOpponentIds(userId, [named]) : [];
  return v.paintedByMe
    ? { painted_by_me: true,  painter_id: null, painted_for_id: id }
    : { painted_by_me: false, painter_id: id,   painted_for_id: null };
}
