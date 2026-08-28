# Battleplans HQ — Claude Instructions

Rules that apply across the whole monorepo. Each app also has its own
`apps/<app>/CLAUDE.md` for things specific to it — including its version number.

## Welcome flows — announcing changes and onboarding users

Every app mounts one `<WelcomeModal>`, and what it shows is a **welcome flow**
passed in by that app. This is the standard way to say something to every user
on sign-in, and the standard way to collect a profile detail we now need.

A flow is defined in `packages/ui/src/components/WelcomeModal.tsx` as:

```ts
{
  key: 'battleplan-venue-regions',   // permanent, never reused
  steps: [{ title, body, cta }, …],  // ALWAYS at least one
  fields?: { username: true, … },    // OPTIONAL second half
}
```

**Always at least one intro step. The form step is optional.** That gives two
shapes, and both are legitimate:

| Shape | Use it for |
|---|---|
| `steps` only | An announcement. Explains a change, asks for nothing, records that it was read. |
| `steps` + `fields` | Onboarding. Explains *why*, then collects it. |

### The form asks only for what's missing

`fields` declares what a flow **may** ask for. What any given user sees is that
list narrowed to what their profile hasn't got — so someone who already has a
name and a home venue, meeting a flow about locations, gets a country and a
postcode and nothing else. A user who has everything gets no form step at all,
and the flow ends on its last intro step.

This is why **the intro copy and the form must agree**. If the copy says "add
your country and postcode", the form must not also demand a display name and a
preferred venue — asking for more than the intro promised reads as a bait and
switch. Write the copy for what the flow actually collects.

### Where flows live

- Used by more than one app → `packages/ui/src/lib/welcomeFlows.ts`
- Used by one app → that app's `src/welcomeFlows.tsx`

Never define a flow inline in `App.tsx`. Copy that every user is forced to read
belongs in one reviewable place, not buried in a route tree.

### Rules for keys

`key` is written to `user_profiles.seen_welcome_flows` when the flow finishes,
and it is the only thing deciding whether a user has already been through it.

- **Never reuse a key** for new copy. Everyone who finished the old flow would
  silently never see the new wording.
- **Never change an existing key** unless you intend to re-show that flow to
  every user, including people who already read it.
- **A new announcement gets a new flow with a new key.** Leave the old flow
  definition in place as a record of what was said — nothing renders a flow that
  isn't mounted.
- Copy under an existing key may be *corrected* (a typo, a wrong link). It may
  not be *repurposed* into a different message.

### Before adding a flow, check it is worth blocking for

The modal is blocking — no close button, and the backdrop doesn't dismiss it.
That is the right weight for "we need your postcode before venues make sense",
and the wrong weight for "here is what shipped this week". Routine release notes
belong in **News & Updates** (`UpdateModal`), which the user opens when they
choose to. Use a welcome flow when the change alters something the user must
understand to keep using the app, or when we need data back from them.

## Version changes

Each app's `CLAUDE.md` carries the rule for bumping its `package.json` version
before a production deploy.

**Whenever you bump a version, ask whether they want an accompanying update
note** — a News & Updates entry, published through Manage Updates and shown via
`UpdateModal`. Ask; do not assume either way, and do not write one unprompted.
If the change is one users must understand before carrying on, ask whether it
warrants a welcome flow instead of (or as well as) an update note.

## Database migrations

One Supabase database sits behind production **and** every preview deploy.

- Only ever apply **backward-compatible** migrations ahead of a production
  deploy: additive columns, new tables, nullable fields with defaults. Never
  drop or rename a column the deployed build still reads.
- Run `supabase migration list --linked` before `db push` — concurrent sessions
  collide on timestamps and the push silently no-ops.
- `user_profiles` grants `UPDATE` **per column**. A new column the client needs
  to write requires an explicit
  `grant update (col) on public.user_profiles to authenticated;` or saves fail
  with a permission error rather than a validation one.

## UI components

- **Use existing components first.** Check `packages/ui/src/components/`, then
  the app's own `src/components/`, before writing any UI.
- **Never create a new UI component without asking.** If a task needs one that
  doesn't exist, stop and ask first.
- **Extending an existing component beats adding a near-duplicate.** If the only
  thing stopping a component from fitting is a missing prop, add the prop.
- **Compose from existing components** — `<Button>` inside a new modal, and so
  on. Don't reinvent primitives.
- **Decide where it lives before building it.** Two apps would use it →
  `packages/ui`. One app → that app's `src/components/`.
- **Always add new components to the gallery**, with every meaningful variant
  and state, plus a matching nav entry:
  - `packages/ui/src/components/` → `packages/ui/src/gallery/SharedSections.tsx`
    (`SHARED_GALLERY_NAV`)
  - an app's `src/components/` → that app's `ComponentGallery.tsx` (`LOCAL_NAV`)

## Deploying

Never merge to `main` or deploy to production without explicit approval.
