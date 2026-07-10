# BattleBox — Claude Instructions

These rules apply to every command in this project.

## Deploying to Production

Before every production deploy, bump the version in `package.json`:
- **Patch** (bug fixes, copy tweaks): `2.0.0` → `2.0.1`
- **Minor** (new features, new pages): `2.0.0` → `2.1.0`
- **Major** (breaking changes, full redesigns): `2.0.0` → `3.0.0`

The build date and version shown in the app are injected automatically at build time from `package.json` — no other files need updating.
