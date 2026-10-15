# TODOS

Work items deferred from plan reviews. Use this as the source of truth for upcoming phases.

---

## P0 — Run immediately after merge

### ~~Run IDOR-fix migrations against production Supabase~~ — ✅ Done (2026-09-20)
Confirmed via `pg_get_functiondef` on `get_all_todays_readings` in the SQL Editor: both the `p_date` parameter (from `20260616_get_all_todays_readings_add_date_param.sql`) and the `(user_uuid = auth.uid() OR auth.role() = 'service_role')` check (from `20260718_fix_get_all_todays_readings_idor.sql`) are present in the deployed function. The caller-supplied-UUID IDOR is fixed in production.

### ~~Run stale-seed-plan-removal migration against production Supabase~~ — ✅ Done (2026-09-20)
Ran `supabase/migrations/20260919_remove_stale_seed_reading_plans.sql` successfully. Deleted the 4 leftover pre-migration seed plans ("30-Day Psalms", "7-Day Gospels Sampler", "90-Day New Testament", "One Year Bible" — broken `scheduled_date: null` data superseded by `plan_templates`) plus the one group that referenced one of them, confirmed by the app owner to be their own test group, not a real user.

### ~~Run plan_templates dedupe migration against production Supabase~~ — ✅ Done (2026-09-20)
Ran `supabase/migrations/20260920_dedupe_plan_templates.sql` successfully. Removed the duplicate rows caused by re-running `20260920_seed_plan_templates_catalog.sql` more than once while iterating on catalog content, and added a `UNIQUE` constraint on `plan_templates.name` so a re-run can't silently duplicate again.

### ~~Run placeholder plan_templates removal migration against production Supabase~~ — ✅ Done (2026-10-04)
Ran `supabase/migrations/20261004_remove_placeholder_plan_templates.sql` successfully. Removed the 5 leftover placeholder/test rows ("7-Day Introduction to Jesus", "Genesis in 50 Days", "Gospel of John", "Proverbs in a Month", "Psalms: The First 30") that predated the Phase 3 real-content seeding. `plan_templates` now holds exactly the 8 intended catalog plans — confirmed complete (no partial inserts) via a `reading_rows` vs `total_days` audit before this ran.

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

## Plans Tab + Default Reading Plan Templates (agreed 2026-09-19) — ✅ Done (2026-09-20)

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

### Phase 3 — Default plan content & browsing — ✅ Done (2026-09-20)

#### Remove stale seed reading plans — ✅ Done (2026-09-20)
Deleted the 4 leftover pre-migration `is_public=true` seed plans from `reading_plans`/`plan_readings` (`supabase/migrations/20260919_remove_stale_seed_reading_plans.sql`), plus the one test group that referenced one of them. They predated the date-first model (`scheduled_date` always null) and old-format `passages`, so any group on one had a permanently empty Today screen. Superseded by the template catalog below.

#### Curate initial template catalog — ✅ Done (2026-09-20)
**What:** `supabase/migrations/20260920_seed_plan_templates_catalog.sql` seeds 8 real, named, sourced plans (the original 4 computed/generic ones were replaced outright, not layered, since that draft never ran in prod):
- **M'Cheyne Reading Plan** (365d) — 4 daily readings, OT once + NT/Psalms twice
- **Chronological Bible in a Year** (365d) — scripture in historical order
- **Navigators Bible Reading Plan** (300d) — formerly Discipleship Journal's, 4 tracks, 5-day/week with catch-up days
- **Two Year Chronological** (730d) — OT weekdays / NT weekends
- **A Chapter a Day: Bible in 3 Years** (1095d) — Celebration Church, stitched from 12 quarterly sub-plans
- **Whole Bible in Under 2 Years** (683d) — Life.Church, OT chronological + daily NT passage, weekly reflection day
- **The One Year Bible** (365d) — Tyndale House's classic branded plan, daily 4-way OT/NT/Psalms/Proverbs interleave
- **The Bible Recap** (365d) — Tara-Leigh Cobble's chronological plan tied to her podcast/book

**Why:** User feedback (2026-09-20): the original computed plans "were sort of already there in some flavor" (echoing the deleted stale seed data) and lacked real recognition. Re-sourced via background research agents and direct browser-driven fetches of live YouVersion/publisher schedules (citations only, no copied commentary) rather than reconstructing from memory — cross-checked against a second independent source where possible. Two research dead-ends handled without fabricating: Tim LaHaye's 3-year plan had no real day-by-day chart in its only free source (just pace descriptions + a blank journal template), so Celebration Church's plan was used instead; a background research agent got stuck making no progress on the Celebration Church fetch (9+ silent "still waiting" cycles with no file ever written) and was killed, then re-done directly via browser `fetch()` calls, which is also how the 3 later additions (Life.Church, Tyndale, Bible Recap) were fetched — faster and more controllable than delegating to another agent. Also decided: **the template catalog is scoped to long-term/complex plans only** — short, single-book, or simple plans stay in scope for custom plan creation (a separate, out-of-scope-for-this-epic feature), not the curated catalog.
**How:** Run the migration file via the Supabase SQL Editor. Sanity-check afterward: `SELECT name, total_days, (SELECT COUNT(*) FROM plan_template_readings WHERE template_id = plan_templates.id) AS reading_rows FROM plan_templates;` — `reading_rows` should equal `total_days` for all 8 (365/365/300/730/1095/683/365/365).
**Effort:** S-M (mostly content work, not engineering)
**Depends on:** `plan_templates` tables

#### Template picker UI — ✅ Done (2026-09-20)
**What:** New `TemplatePickerScreen` (`src/screens/plans/TemplatePickerScreen.tsx`), inserted into the New Plan flow between `ChoosePlanSource`'s "A Default Plan" option and `CreateGroupScreen`. Lists all 8 catalog templates (shortest to longest), each with a category badge; tapping a card expands it to preview the first 3 days via a new `getTemplatePreview` service fn / `useTemplatePreview` hook; "Start This Plan" calls `instantiateTemplate` and hands off to `CreateGroupScreen` with `preselectedPlanId` set, reusing the same pattern `ImportPlanScreen` already used for custom plans.
**Why it wasn't just editing `CreateGroupScreen`'s existing list in place:** that screen's list is fed by `useAvailablePlans` (`reading_plans.is_public OR created_by=user`), which is the right data source for the final "confirm and name" step but not for template browsing — mirroring `ImportPlanScreen`'s existing "separate browse/prepare screen → land in CreateGroupScreen with a preselected plan" pattern kept both flows (custom paste, default catalog) architecturally consistent instead of overloading one screen with two data sources.
**Verified:** `npx tsc --noEmit` clean; confirmed rendering with real data in the Android Studio emulator (2026-09-20).
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
