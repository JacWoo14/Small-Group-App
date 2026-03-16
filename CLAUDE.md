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

### Navigation Structure
```
RootNavigator (Stack)
  ├─ AuthScreen
  ├─ OnboardingScreen
  └─ MainTabNavigator (Bottom Tabs)
      ├─ Today (TodayScreen)
      ├─ Groups (GroupStackNavigator)
      │    ├─ GroupList, GroupDetails, CreateGroup, JoinGroup, ImportPlan
      ├─ Progress (ProgressScreen)
      └─ Settings (SettingsScreen)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/services/supabase.ts` | Supabase client (SecureStore adapter, `detectSessionInUrl: Platform.OS === 'web'`) |
| `src/services/auth.ts` | `signInWithEmail`, `createUserProfile`, profile helpers |
| `src/services/groups.ts` | `createGroup`, `joinGroup`, `getGroupDetails`, `leaveGroup`, `getAvailablePlans` |
| `src/services/completions.ts` | `markComplete`, `getTodaysReadings`, `getGroupCompletionsForDate` |
| `src/services/stats.ts` | `getUserStreak`, `getYesterdayGroupRecap` |
| `src/services/plans.ts` | `parsePlanText`, `importReadingPlan` |
| `src/hooks/useGroups.ts` | React Query hooks for all group + plan operations |
| `src/hooks/useProgress.ts` | `useUserStreak`, `useYesterdayRecap` |
| `src/context/AuthContext.tsx` | `useAuth()` — session, user, profile, deep link handler |
| `src/constants/theme.ts` | Colors, Typography, Spacing — single source of truth for styling |
| `src/types/index.ts` | All TypeScript interfaces |

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
Tab-separated, one reading per line:
```
Genesis 1	3-16-2026
Genesis 2	3-17-2026
```
Dates in `M-D-YYYY` format are normalized to `YYYY-MM-DD` by the parser.

## Styling Conventions
- Always use `src/constants/theme.ts` — never hardcode colors or spacing
- Spread theme objects: `...Typography.h2` (not `fontSize: Typography.h2.fontSize`)
- Navigation header style: `backgroundColor: Colors.primary`, `tintColor: Colors.white`

## Android Gotchas
1. `expo-notifications` causes crash if added without full setup — excluded until Phase 4
2. `expo-dev-client` in `app.json` plugins causes Gradle failure — only add for dev builds
3. `newArchEnabled: true` causes crashes — keep `false`
4. Do NOT use `react-native-url-polyfill` — RN 0.81 has native URL support, polyfill interferes
5. Supabase free tier **pauses after ~1 week of inactivity** — unpause from dashboard if requests fail

## What's Not Built Yet
- Push notifications (Phase 4) — `expo-notifications` not installed
- App Store submission
