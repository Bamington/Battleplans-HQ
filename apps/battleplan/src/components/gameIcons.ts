import iconBloodBowl  from '../../../../packages/ui/src/assets/games/icons/blood-bowl.png';
import iconHalo       from '../../../../packages/ui/src/assets/games/icons/halo.png';
import iconKillTeam   from '../../../../packages/ui/src/assets/games/icons/kill-team.png';
import iconRyg        from '../../../../packages/ui/src/assets/games/icons/ryg.svg';
import iconStarcraft  from '../../../../packages/ui/src/assets/games/icons/starcraft.svg';

/** Maps a game slug to its thumbnail icon. */
export const GAME_ICONS: Record<string, string> = {
  'blood-bowl':      iconBloodBowl,
  'halo-flashpoint': iconHalo as string,
  'kill-team':       iconKillTeam,
  'ryg':             iconRyg as string,
  'starcraft':       iconStarcraft as string,
};
