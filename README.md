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
- Groups: create with invite code, join, view members, leave, change plan
- Plan import: paste tab-separated readings with dates
- Today screen: shows group's reading for today, mark complete
- Progress screen: current streak + personal best
- Group details: yesterday's recap (who completed, who missed)

## What's Not Built Yet

- Push notifications (Phase 4)
- App Store submission
