import { supabase } from '@battleplans/ui';

// The people list itself is shared with BattleBench (painters) — it lives in
// @battleplans/ui. Only the battle links are Battleplan's own.
export { useOpponents, resolveOpponentIds } from '@battleplans/ui';
export type { Opponent, SelectedOpponent } from '@battleplans/ui';

/** Replace a battle's opponent links with exactly `opponentIds`. */
export async function setBattleOpponents(battleId: number, opponentIds: string[]): Promise<void> {
  await supabase.from('battle_opponents').delete().eq('battle_id', battleId);
  if (opponentIds.length) {
    await supabase.from('battle_opponents')
      .insert(opponentIds.map(opponent_id => ({ battle_id: battleId, opponent_id })));
  }
}
