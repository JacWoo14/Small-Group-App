# TODOS

Work items deferred from plan reviews. Use this as the source of truth for upcoming phases.

---

## P0 — Run immediately after merge

### Run IDOR-fix migrations against production Supabase
**What:** Run `supabase/migrations/20260616_get_all_todays_readings_add_date_param.sql` and `supabase/migrations/20260718_fix_get_all_todays_readings_idor.sql` against the live database via the Supabase SQL Editor (this repo applies migrations manually, no automated runner).
**Why:** Surfaced by /ship adversarial review (2026-08-10). Until these run, `get_all_todays_readings` (SECURITY DEFINER) trusts the caller-supplied `user_uuid` with no check that it matches the authenticated caller — any authenticated user could pass another user's UUID and read their group names, invite codes, reading plans, and completion status. "Merged to main" does not mean "deployed" for this repo's manual-migration workflow.
**How:** Supabase Dashboard → SQL Editor → run both files in order. Verify with a quick probe: authenticate as user A, call the RPC with user B's UUID, confirm zero rows returned.
**Effort:** XS (a few minutes)
**Depends on:** Nothing — do this first, before anything else in this release

---

## P1 — Must ship before real users onboard

---

## P2 — Important before public launch

### Play Store Submission
**What:** Publish to Google Play Store (internal test track first, then production).
**Why:** Required for real users to install the app.
**How:**
- App icon (1024x1024 adaptive icon)
- Store listing: description, screenshots (at least 2 phone screenshots required)
- Privacy policy URL (required for apps that collect any user data)
- EAS Build preview APK → internal testing → production release
- `google-services.json` already configured via EAS env vars
**Effort:** L
**Depends on:** Nothing — push notifications shipped in Phase 4

---

## Plans Tab + Default Reading Plan Templates (agreed 2026-09-19)

Agreed after a planning session covering default reading plans, individual (non-group) use, and a Plans-tab IA rework. Phases are ordered by dependency.

### Phase 1 — Foundation (data model, no UI yet) — ✅ Done (2026-09-19)

#### Add `plan_templates` + `plan_template_readings` tables
**What:** New tables, separate from `reading_plans`/`plan_readings` — day-number based (no `scheduled_date`), never referenced directly by `groups.reading_plan_id`. Pure catalog data.
**Why:** Keeps the date-first model and the security-sensitive `get_all_todays_readings` RPC untouched — templates only ever produce ordinary `reading_plans` rows via instantiation, so there's no new IDOR surface to re-audit.
**How:** New SQL migration file under `supabase/migrations/`, applied manually via the Supabase SQL Editor per this repo's existing workflow.
**Effort:** S
**Depends on:** Nothing

#### `instantiateTemplate(templateId, startDate, userId, groupName)` service function
**What:** Clones a template's readings into a fresh `reading_plans` (+ `plan_readings`, dated sequentially from `startDate`) row, then creates the group exactly like `createGroup` does today.
**Why:** Functionally `parseDatelessPlanText` → `importReadingPlan`, just fed from a stored template instead of a pasted textbox.
**Effort:** S-M
**Depends on:** `plan_templates` tables above

#### Add `groups.is_personal` boolean, set explicitly at creation
**What:** A stored flag, set by which leaf of the New Plan decision tree was used — not derived from member count. "Show group chrome" is computed as `!is_personal || member_count > 1`, so a personal plan that later gets someone invited naturally upgrades to group presentation.
**Why:** This is the mechanism behind the Personal/Group tag in the list, which screen variant renders, and whether the invite code is exposed.
**Effort:** XS
**Depends on:** Nothing

### Phase 2 — Plans tab IA rework — ✅ Done (2026-09-19)

#### Rename Groups → Plans (tab, screens, and internal identifiers)
**What:** `GroupStackNavigator` → `PlanStackNavigator`, `GroupsScreen` → `PlansScreen`, etc. — a real identifier rename, done as its own contained PR before new features build on top of it, not just a tab-label swap.
**Why:** The app's primary object is "what plan am I following," not "who am I coordinating with" — a personal user opening a tab called "Groups" is asked to think in the wrong frame. A cosmetic-only rename would leave permanent confusion between file names and what they represent.
**Effort:** M
**Depends on:** Nothing (but should land before the items below)

#### New Plan decision-tree flow: Individual/Group → Custom/Default
**What:** Individual leaf reuses `instantiateTemplate`/`createGroup` under the hood with `is_personal: true`, skips invite-code display and member-list UI. Group leaf is today's `CreateGroupScreen`, largely unchanged.
**Effort:** M
**Depends on:** Phase 1 `is_personal` flag, Plans rename above

#### Personal/Group tag in the Plans list
**What:** Each row shows a small badge (e.g. "Personal" vs the group name/member count) using `is_personal` + live member count.
**Effort:** XS-S
**Depends on:** Plans rename, `is_personal` flag

#### Gate invite code behind an explicit "Invite others to this plan" action
**What:** Personal-plan detail screen hides the invite code by default; revealing it is a deliberate action, at which point the screen presents as a normal group.
**Effort:** S
**Depends on:** New Plan decision-tree flow

### Phase 3 — Default plan content & browsing

#### Curate initial template catalog
**What:** A small starting set of built-in plans.
**Why:** Stick to public-domain/classic plan structures for v1 (M'Cheyne, a standard chronological ordering, a Gospels-in-30-days, a Psalms/Proverbs plan) — passage-and-day lists are factual/functional, but avoid lifting a named plan's exact schedule wholesale from a specific modern publisher/app without checking.
**Effort:** S-M (mostly content work, not engineering)
**Depends on:** `plan_templates` tables

#### Template picker UI
**What:** Replaces the flat list currently in `CreateGroupScreen` for the Default leaf — browse/preview before selecting, showing first few days, total length, and category.
**Effort:** M
**Depends on:** Curated template catalog, New Plan decision-tree flow

### Explicitly out of scope for this epic
Custom-creation overhaul and outside-plan import — the `plan_templates` table this epic builds is the intended foundation for both later (custom creation becomes "build your own template"; outside-plan import becomes "parse an external source into the same template shape").

---

## P3 — Code health

### Streak calc uses stale signup-time timezone, not device-live timezone
**What:** `getUserStreak` converts `completed_at` to local dates using `users.timezone` (captured once at signup), while `reading_date`/"today" throughout the app is derived from the device's live current timezone. The new same-day-only streak logic (this branch) compares the two.
**Why:** Surfaced by /ship red-team review (2026-08-10). A user who signs up in one timezone then travels without re-onboarding could complete a reading on the correct calendar day but have it silently excluded from their streak, since the stored `users.timezone` and the device's live timezone disagree. Narrow edge case (active cross-timezone travel) for a small closed-group app — not blocking, but worth fixing properly rather than patching.
**How:** Either refresh `users.timezone` on each login (e.g. in `handleProfileLoaded`) so it tracks the device's current zone, or unify the timezone source used by `filterSameDayCompletions` with the one used for `reading_date`/`todayString()` elsewhere.
**Effort:** S-M
**Depends on:** Nothing

### Consolidate duplicated "today" date-string helper
**What:** `format(new Date(), 'yyyy-MM-dd')` is computed independently in `src/utils/dateNav.ts`, `src/screens/TodayScreen.tsx`, and twice in `src/hooks/useGroups.ts`.
**Why:** Surfaced during /ship pre-landing review (2026-08-10). Not a current bug — all 4 copies compute the same thing consistently today — but future changes to "today" logic (e.g. more precise timezone handling) would need to touch all 4 spots, and it's easy to miss one.
**How:** Export a single `todayString()` helper (already exists locally in TodayScreen.tsx) from `src/utils/dateNav.ts` and import it everywhere else.
**Effort:** S
**Depends on:** Nothing

## P3 — Phase 4 polish

### Group Streak Counter
**What:** Show consecutive days ALL members completed together as a shared "group streak" on Today screen and Group Details.
**Why:** Creates shared identity and motivates the whole group. When the group streak is at 7 days, no one wants to be the one who breaks it.
**How:** Server-side query or client-side calculation using existing completions data. Display in the group card header.
**Effort:** S
**Depends on:** Nothing — all data already fetched

### Plan Completion State
**What:** When a group's reading plan has no more scheduled readings (plan ended), Today screen should show a congratulations card instead of an empty/broken reading card.
**Why:** Plan completion should feel like a milestone, not a broken state. The card should say something like "Your group finished [Plan Name]! Ready for a new plan?" with a direct link to Group Details > Change Plan.
**How:** Detect `passages.length === 0` in TodayReading and distinguish between "no reading today" (gap day) vs "plan ended" (no future readings either). The latter needs an extra query or a flag from the RPC.
**Effort:** S-M
**Depends on:** N+1 RPC fix (easier to add this info in one RPC)

---

## P3 — Theme picker follow-ups (from /autoplan review, 2026-07-18)

### Whole-App Accessibility Audit
**What:** Screen reader (VoiceOver/TalkBack) and keyboard-nav pass across the whole app.
**Why:** No stated a11y testing practice exists anywhere in the codebase; surfaced while reviewing the theme picker but applies app-wide, not just to that feature.
**Effort:** M
**Depends on:** Nothing

### Theme Picker: Haptic Feedback + Selection Animation
**What:** Add haptic tap feedback and a scale/bounce animation when selecting a theme swatch in Settings.
**Why:** Small delight touch identified during CEO scope-expansion scan; not requested, not blocking.
**Effort:** S
**Depends on:** Theme picker Supabase-sync work landing first

### Theme Picker: Auto-Suggest from System Light/Dark Mode
**What:** Suggest a theme preset based on the device's system light/dark mode setting.
**Why:** Delight idea from expansion scan.
**Effort:** S-M
**Depends on:** Nothing blocking

### Theme Picker: "Surprise Me" Random Button
**What:** A button that randomly picks one of the 4 theme presets.
**Why:** Whimsy idea from expansion scan, fits a personal/learning project.
**Effort:** S
**Depends on:** Nothing

### Theme Picker: Live Mini-Preview in Swatch Row
**What:** Show a small live preview card in the swatch row before the user commits to a theme.
**Why:** UX polish idea from expansion scan.
**Effort:** S
**Depends on:** Nothing

### Theme Picker: Member Color Identity Rings (Approach C)
**What:** Show each group member's chosen theme color as a ring/accent on their avatar in GroupDetailsScreen and GroupsScreen.
**Why:** Turns theme_id into a small-group social identity cue once it's Supabase-synced — flagged by the independent second opinion during /office-hours as the "coolest version not yet considered." Near-zero extra infra once the Supabase sync work lands (same column, existing member-list queries).
**Effort:** M
**Depends on:** Confirming the `users` RLS SELECT policy allows a group member to read another member's `theme_id` (not verified — no local migration file found for this check).

### Theme Picker: Fix Every-Launch Cold-Start Flash
**What:** Paint the last-known theme immediately on app launch, before Supabase/Auth resolves, instead of briefly showing the default.
**Why:** Currently happens on every app open (not just first login), undercutting the feature's "this is mine" premise — flagged by the Design phase's independent review.
**Effort:** S-M
**Depends on:** Theme picker Supabase-sync work landing first

### Run /design-consultation for a Formal DESIGN.md
**What:** Produce a proper design system document for this app.
**Why:** No DESIGN.md currently exists; the theme.ts consolidation in this PR is a small step toward one, but a real system would benefit every future screen, not just Settings.
**Effort:** M
**Depends on:** Nothing

## Completed

- [x] Phase 1: Auth (magic link, onboarding, SecureStore)
- [x] Phase 2: Groups (create, join, leave, member list, today's reading, mark complete)
- [x] Phase 3: Plan import (dated + dateless), ownership transfer, recap bug fixes, Sentry, tests
- [x] Phase 4: Push notifications — `push_token` on users table, `send-daily-reminders` Edge Function (every 15 min), SettingsScreen permission UI, dismiss on mark-complete
