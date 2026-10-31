# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

# skills

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/plan-ceo-review`, `/plan-eng-review`, `/review`, `/ship`, `/browse`, `/qa`, `/setup-browser-cookies`, `/retro`

## Project Context

A **React Native + Expo (SDK 54)** mobile app for Bible reading accountability. Small groups follow a shared reading plan, mark daily readings complete, and see each other's progress.

**Stack**: React Native + Expo · TypeScript · Supabase (PostgreSQL + Auth) · React Query · EAS Build

## Development Commands

```bash
npm start                    # Start Metro (Expo Go / web)
npm run web                  # Web browser
npx tsc --noEmit             # Type check
npx expo start -c            # Clear cache and restart
npx eas build --platform android --profile preview --non-interactive  # Build APK
```

## Architecture

### Data Flow
All data lives in Supabase. React Query handles fetching and caching. No local AsyncStorage — Supabase is the single source of truth.

```
Screens (src/screens/)
    ↓ use hooks
Hooks (src/hooks/)          ← React Query (useQuery / useMutation)
    ↓ call
Services (src/services/)    ← Supabase queries
    ↓
Supabase (PostgreSQL)
```

### Auth Flow
- Magic link via Supabase (`signInWithOtp`)
- Tokens stored in Expo SecureStore
- Deep link handler in `AuthContext.tsx` catches `myapp://auth/callback#access_token=...`
- `emailRedirectTo` is hardcoded as `'myapp://auth/callback'` for mobile (do NOT use `Linking.createURL` — it returns the Expo Go URL even in production builds)

## Key Files

| File | Purpose |
|------|---------|
| `src/services/supabase.ts` | Supabase client (SecureStore adapter, `detectSessionInUrl: Platform.OS === 'web'`) |
| `src/services/auth.ts` | `signInWithEmail`, `createUserProfile`, profile helpers |
| `src/services/groups.ts` | `createGroup`, `joinGroup`, `getGroupDetails`, `leaveGroup`, `getAvailablePlans` |
| `src/services/completions.ts` | `markComplete`, `getTodaysReadings` (via `get_all_todays_readings` RPC), `getGroupCompletionsForDate` |
| `src/services/stats.ts` | `getUserStreak`, `getYesterdayGroupRecap`, `calculateStreakFromDates` (exported pure fn) |
| `src/services/plans.ts` | `parsePlanText`, `parseDatelessPlanText`, `detectPlanFormat`, `importReadingPlan` |
| `src/services/notifications.ts` | On-device reminders (the live path, no server): `scheduleDailyReminders` (one daily notification per group, titled with the group name, with a "Mark complete" action), `cancelDailyReminders`, `handleReminderResponse` (action press: marks today complete for that notification's group, dismisses it, reports + notifies on failure). Also `dismissTodayNotification`, `getNotificationPermissionStatus`; `registerForPushNotifications` is dormant (no callers) |
| `src/hooks/useReminderSync.ts` | Mounted in `MainTabNavigator`: reschedules reminders when groups or the preferred time change, and handles "Mark complete" presses while the app is open (invalidates readings/streak queries) |
| `src/services/reminderTask.ts` | Android background task (`expo-task-manager`) for "Mark complete" presses while the app is backgrounded/closed. Must be imported from `index.ts` so it is defined at startup. Needs a native rebuild when `expo-task-manager` changes |
| `src/hooks/useGroups.ts` | React Query hooks for all group + plan operations; `useMarkComplete` calls `dismissTodayNotification` in onSuccess |
| `src/hooks/useProgress.ts` | `useUserStreak`, `useYesterdayRecap` |
| `src/context/AuthContext.tsx` | `useAuth()` — session, user, profile, deep link handler; `handleProfileLoaded()` DRYs session/auth-state-change; registers push token on login |
| `src/context/ThemeContext.tsx` | `useTheme()` — user-selectable accent color, Supabase-synced via `users.theme_id`; optimistic write with race-guarded revert on failure |
| `src/constants/theme.ts` | Colors, Typography, Spacing, `THEMES`/`ThemeId`/`resolveThemeId` (theme presets) — single source of truth for styling |
| `src/utils/dateNav.ts` | `clampDate` — shared date-boundary clamping for TodayScreen's nav arrows and swipe gesture |
| `src/types/index.ts` | All TypeScript interfaces |
| `supabase/functions/send-daily-reminders/index.ts` | **Dormant** server push (reminders now fire on-device). Only sends to users with a `push_token`, which nothing writes anymore. Must be deployed with `--no-verify-jwt`. Revive only for group-aware notifications ("Yesterday: N/M", nudges) |

## Data Models

### Reading Plans (date-first model)
Plans store `scheduled_date` on each `plan_readings` row. Today's reading is looked up by:
```sql
WHERE plan_id = $groupPlanId AND scheduled_date = CURRENT_DATE
```
No day-number arithmetic needed. `day_number` is nullable (kept for future use).

### Passages
Stored as plain string arrays: `["Isaiah 63", "Psalm 119:1-96"]`. No structured parsing.

### Plan Import Format
Two supported formats, auto-detected by `detectPlanFormat`:

**Dated** (tab-separated date per line):
```
Genesis 1	3-16-2026
Genesis 2	3-17-2026
```
Dates in `M-D-YYYY` format are normalized to `YYYY-MM-DD` by the parser.

**Dateless** (one reading per line, no dates):
```
Genesis 1
Genesis 2
```
User picks a start date in the UI; sequential dates are assigned from that point. Daily-only — non-daily schedules are not supported.

## Styling Conventions
- Always use `src/constants/theme.ts` — never hardcode colors or spacing
- Spread theme objects: `...Typography.h2` (not `fontSize: Typography.h2.fontSize`)
- User-selectable accent color: read `theme.primary` from `useTheme()` (`src/context/ThemeContext.tsx`), not a static `Colors.primary` — that alias was removed once all 4 preset accent colors (`src/constants/theme.ts`'s `THEMES`) replaced the single hardcoded brand color. `StyleSheet.create` is static and can't reference the selected theme, so `theme.primary` is applied via an inline style merged into the `style` array at render time (see `Button.tsx`, `MainTabNavigator.tsx` for the pattern)
- Navigation header style: `backgroundColor: theme.primary`, `tintColor: Colors.white`

## Android Gotchas
1. `expo-notifications` requires full setup (device check, permission request, token registration) — partial setup causes crashes
2. `expo-dev-client` in `app.json` plugins causes Gradle failure — only add for dev builds
3. `newArchEnabled: true` causes crashes — keep `false`
4. Do NOT use `react-native-url-polyfill` — RN 0.81 has native URL support, polyfill interferes
5. Supabase free tier **pauses after ~1 week of inactivity** — unpause from dashboard if requests fail
6. Notification action presses handled by the background task (app closed) deliver `request.content.dataString` (a JSON string), not `content.data`. `handleReminderResponse` reads both; anything new that reads notification data from the task must do the same. Debug builds also need Metro running for the task to execute, and use `adb shell am kill <pkg>` (not `force-stop`, which cancels scheduled alarms) to simulate a closed app

## What's Not Built Yet
- App Store / Play Store submission
- Smarter on-device reminders: skip/cancel today's reminder once the reading is marked complete, and put the real passage in the notification body (schedule the next ~14 days from plan data, refreshed on app open)

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
