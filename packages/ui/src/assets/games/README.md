# Game artwork

Two assets per game, both keyed by the game **slug** (the `games.slug` column):

| File | Purpose | Consumed as |
|---|---|---|
| `icons/<slug> icon.png` | Small thumbnail (game picker, booking cards) | `GAME_ICONS[slug]` |
| `logos/<slug>.png` | Full-size banner / logo | `GAME_BANNERS[slug]` |

Both maps are built automatically by `apps/battleplan/src/components/gameIcons.ts`
via `import.meta.glob` — **drop the files in and they just work**, no code change.

## Naming

The slug is derived from the filename, so naming is forgiving:

- A `logo-` prefix and an ` icon` / `-icon` / `_icon` suffix are stripped.
- Anything under `icons/` is treated as an icon; anything else as a banner.
- The remainder is slugified (lowercase, apostrophes dropped, any run of
  non-alphanumerics becomes `-`). So `Blood Bowl icon.png` and
  `blood-bowl icon.png` both resolve to `blood-bowl`.

Accepted extensions: `.png`, `.svg`, `.jpg`, `.jpeg`, `.webp`.

**Careful:** four games have a slug that does *not* match their display name.
Prefer naming those files by slug; `SLUG_ALIASES` in `gameIcons.ts` covers them
either way:

| Display name | slug |
|---|---|
| Warhammer 40,000: Kill Team | `kill-team` |
| Starcraft: The Miniatures Game | `starcraft` |
| Halo: Flashpoint | `halo-flashpoint` |
| Repent Ye Foolish Gods | `ryg` |

If two files resolve to the same slug, the dev build logs a duplicate warning
and the later file wins — replace the old asset rather than adding alongside it.

> Note: `icons/{blood-bowl,halo,kill-team,ryg,starcraft}` and `logos/logo-*` are
> imported by path in battlecards (`AppHome.tsx`, `ImportListModal.tsx`).
> Don't rename or delete those five pairs — overwrite them in place instead.

## Slugs (75 games)

| Game | slug |
|---|---|
| Aeronautica | `aeronautica` |
| Age of Fantasy | `age-of-fantasy` |
| Age of Fantasy Quest | `age-of-fantasy-quest` |
| Age of Fantasy Regiments | `age-of-fantasy-regiments` |
| Age of Fantasy Skirmish | `age-of-fantasy-skirmish` |
| Age of Sigmar | `age-of-sigmar` |
| Arsenal | `arsenal` |
| Battlefleet Gothic | `battlefleet-gothic` |
| Battletech | `battletech` |
| Battlezone Commander | `battlezone-commander` |
| Blackstone Fortress | `blackstone-fortress` |
| Blood Bowl | `blood-bowl` |
| Bolt Action | `bolt-action` |
| Bot War | `bot-war` |
| Bushido | `bushido` |
| Carnevale | `carnevale` |
| Conquest | `conquest` |
| Conquest First Blood | `conquest-first-blood` |
| Cursed City | `cursed-city` |
| Custom Game | `custom-game` |
| Drop Bears | `drop-bears` |
| Dropfleet Commander | `dropfleet-commander` |
| Dropzone Commander | `dropzone-commander` |
| Dungeons and Dragons | `dungeons-and-dragons` |
| Flames of War | `flames-of-war` |
| Frostgrave | `frostgrave` |
| Gloomhaven | `gloomhaven` |
| Grimdark Future | `grimdark-future` |
| Grimdark Future Firefight | `grimdark-future-firefight` |
| Grimdark Future Warfleets | `grimdark-future-warfleets` |
| Gundam Assemble | `gundam-assemble` |
| Half Tilt | `half-tilt` |
| Halo: Flashpoint | `halo-flashpoint` |
| Hero Forge | `hero-forge` |
| Horizon: Zero Dawn | `horizon-zero-dawn` |
| Horus Heresy | `horus-heresy` |
| Imperial Assault | `imperial-assault` |
| Infinity | `infinity` |
| Infinity Code One | `infinity-code-one` |
| Inquisitor | `inquisitor` |
| Konflict '47 | `konflict-47` |
| Marvel Crisis Protocol | `marvel-crisis-protocol` |
| Marvel United | `marvel-united` |
| Middle Earth Strategy Battle Game | `middle-earth-strategy-battle-game` |
| Mordheim | `mordheim` |
| Necromunda | `necromunda` |
| Other | `other` |
| Relics | `relics` |
| Repent Ye Foolish Gods | `ryg` |
| Rising Sun | `rising-sun` |
| Rumbleslam | `rumbleslam` |
| Song of Ice and Fire | `song-of-ice-and-fire` |
| Star Trek Adventures | `star-trek-adventures` |
| Star Wars Legion | `star-wars-legion` |
| Star Wars Shatterpoint | `star-wars-shatterpoint` |
| Star Wars X-Wing | `star-wars-x-wing` |
| Starcraft: The Miniatures Game | `starcraft` |
| Stargrave | `stargrave` |
| Stormlight Miniatures | `stormlight-miniatures` |
| Striketeam Commander | `striketeam-commander` |
| Super Fantasy Brawl | `super-fantasy-brawl` |
| Test Game | `test-game` |
| This Quar's War | `this-quars-war` |
| Titanicus | `titanicus` |
| Trench Crusade | `trench-crusade` |
| Unsettled | `unsettled` |
| Warcrow | `warcrow` |
| Warcrow Adventures | `warcrow-adventures` |
| Warcry | `warcry` |
| Warhammer 40,000 | `warhammer-40-000` |
| Warhammer 40,000: Kill Team | `kill-team` |
| Warhammer Fantasy | `warhammer-fantasy` |
| Warhammer Old World | `warhammer-old-world` |
| Warhammer Underworlds | `warhammer-underworlds` |
| Warmachine | `warmachine` |
