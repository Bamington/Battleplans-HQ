/**
 * api/profile-og.ts — link preview for a /@name profile page in BattlePlan.
 * The logic is shared by every app: see packages/ui/src/server/profileOg.ts.
 */
import { profileOgHandler } from '../../../packages/ui/src/server/profileOg.js';

export const config = { runtime: 'edge' };

export default function handler(req: Request): Promise<Response> {
  return profileOgHandler(req, 'BattlePlan');
}
