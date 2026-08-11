# Bible Accountability App

A React Native mobile app for daily Bible reading with small group accountability. Groups share a reading plan, mark readings complete, and see each other's progress.

## Stack

- React Native + Expo (SDK 54) + TypeScript
- Supabase (PostgreSQL, Auth, RLS)
- React Query for data fetching
- EAS Build for Android APKs

## Getting Started

```bash
npm install
npm start        # Metro bundler (Expo Go / web)
npm run web      # Web browser
npx tsc --noEmit # Type check
```

### Android APK

```bash
npx eas build --platform android --profile preview --non-interactive
```

Env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) must be set in the EAS dashboard under the production environment.

## Dev Tools Setup (Claude Code)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted development. To install:

```bash
git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup
```

Requires [bun](https://bun.sh) (`npm install -g bun`).

## What's Built

- Magic link auth (Supabase, no password)
- Onboarding flow
- Groups: create with invite code, join, view members, leave, change plan, transfer ownership
- Plan import: dated (tab-separated) and dateless (start-date picker) formats
- Today screen: swipeable/tappable date navigation (30 days back, 7 days forward), mark complete, retroactive completion on past dates
- Color theme picker: choose an accent color (Settings > Appearance), synced across devices via Supabase
- Push notifications: daily reading reminders, dismissed automatically on mark-complete
- Progress screen: current streak + personal best
- Group details: yesterday's recap (who completed, who missed)

## What's Not Built Yet

- App Store / Play Store submission
- Notification time picker is restricted to any-minute selection, but the reminder cron only fires every 15 minutes

See [TODOS.md](TODOS.md) for the full list of deferred work and [CHANGELOG.md](CHANGELOG.md) for release history.
