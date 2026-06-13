# TODOS

Work items deferred from plan reviews. Use this as the source of truth for upcoming phases.

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
**Depends on:** Push notifications (P1) — don't submit before notifications work

---

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

## Completed

- [x] Phase 1: Auth (magic link, onboarding, SecureStore)
- [x] Phase 2: Groups (create, join, leave, member list, today's reading, mark complete)
- [x] Phase 3: Plan import (dated + dateless), ownership transfer, recap bug fixes, Sentry, tests
- [x] Phase 4: Push notifications — `push_token` on users table, `send-daily-reminders` Edge Function (every 15 min), SettingsScreen permission UI, dismiss on mark-complete
