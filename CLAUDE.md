# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is a **React Native + Expo** mobile app for Bible reading accountability, migrated from a Next.js web app (located in `../Reference/bible-reading-plan/`). The migration reused ~70% of the business logic while adapting UI for mobile.

**Key Migration Principle**: All browser-specific code (localStorage, window, document) has been replaced with React Native equivalents (AsyncStorage). When migrating components from the reference project, always convert HTML elements to React Native components and Tailwind CSS to StyleSheet.

## Development Commands

```bash
# Start development server (shows QR code for Expo Go)
npm start

# Run on specific platform
npm run ios        # iOS simulator (macOS only)
npm run android    # Android emulator
npm run web        # Web (limited functionality)

# Clear Metro bundler cache
npx expo start -c

# Type checking
npx tsc --noEmit
```

## Architecture Overview

### Offline-First Data Flow

This app follows an **offline-first architecture** where all data operations must work without internet:

1. **User action** → Update AsyncStorage immediately
2. **Update UI** → Optimistic update (instant feedback)
3. **Queue sync** → Add to sync queue (when backend is implemented)
4. **Background sync** → Upload to Supabase when online

**Critical**: All storage operations in `src/utils/storage.ts` are async. Always `await` them.

### Layer Separation

```
Screens (src/screens/)
    ↓ use
Components (src/components/)
    ↓ use
Utils (src/utils/)
    ↓ use
Types (src/types/)
```

**Services layer** (to be implemented in `src/services/`) will handle backend communication (Supabase).

### State Management Strategy

**Current**: Local state + AsyncStorage (no global state yet)
**Planned**: React Context for auth/groups, migrate to Zustand if performance issues arise

When implementing features:
- Keep local data in AsyncStorage as source of truth
- Backend is sync layer, not primary storage
- UI must work offline

## Key File Responsibilities

### src/utils/storage.ts
**Central data persistence layer**. All AsyncStorage operations go through here.

- `saveProgress()` / `loadProgress()` - Reading progress (supports multi-plan)
- `saveNote()` / `loadNotes()` - Personal notes
- `saveUser()` / `loadUser()` - User profile
- Handles migration from old single-plan format to multi-plan format automatically

**Pattern**: All functions are async, include error handling, and update in-memory caches where appropriate.

### src/utils/customPlans.ts
Manages user-created reading plans with **cache-first pattern**:
- Call `initializeCustomPlans()` on app startup to populate cache
- `getCustomPlans()` is synchronous (reads from cache)
- Save operations update cache + AsyncStorage atomically

### src/constants/theme.ts
**Single source of truth for all styling**. Contains:
- `Colors` - Palette from web app (Sacred Gold #C4941D, Deep Earth #5A4A3B, etc.)
- `Typography` - Predefined text styles (use spreading: `...Typography.h2`)
- `CommonStyles` - Reusable component styles
- `Spacing`, `BorderRadius`, `Shadows` - Design tokens

**When styling**: Always import and use theme constants instead of hardcoding values.

### src/types/index.ts
All TypeScript interfaces. Organized in sections:
1. **Core types** (migrated from web app): `ReadingPlan`, `Progress`, `Note`, etc.
2. **New mobile features**: `User`, `Group`, `NotificationPayload`, etc.

## Migration Patterns

### Converting Web Components to Mobile

**Reference project components** (`../Reference/bible-reading-plan/components/`) need conversion:

```tsx
// WEB (Tailwind + HTML)
<div className="bg-white rounded-lg p-4 shadow-md">
  <h2 className="text-2xl font-bold">Title</h2>
  <p className="text-gray-600">Description</p>
</div>

// MOBILE (StyleSheet + React Native)
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, CommonStyles, Spacing } from '../constants/theme';

<View style={styles.card}>
  <Text style={styles.title}>Title</Text>
  <Text style={styles.description}>Description</Text>
</View>

const styles = StyleSheet.create({
  card: {
    ...CommonStyles.card,  // Includes backgroundColor, borderRadius, padding, shadow
  },
  title: Typography.h3,
  description: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});
```

### Navigation Structure

```
RootNavigator (Stack)
  └─ MainTabNavigator (Bottom Tabs)
      ├─ Today (HomeScreen) - Daily reading
      ├─ Plans (PlansScreen) - Browse/select plans
      ├─ Groups (GroupsScreen) - Accountability groups [NEW]
      ├─ Progress (ProgressScreen) - Stats/streaks
      └─ Settings (SettingsScreen) - User preferences
```

**To add screens**: Create in `src/screens/`, import in navigator, add to appropriate stack/tab.

## Data Models

### Multi-Plan Progress
Users can have multiple plans active simultaneously. Progress is stored as:

```typescript
MultiPlanProgress {
  userId: string
  currentPlanId: string  // Active plan
  planProgress: {
    [planId]: PlanProgress  // Progress per plan
  }
}
```

**When working with progress**: Always use helper functions from `storage.ts`:
- `getCurrentPlanProgress()` - Get active plan's progress
- `getPlanProgress(multiProgress, planId)` - Get specific plan
- `switchPlan()` - Change active plan (preserves all progress)

### Reading Plans
Plans are either:
1. **Default plans**: Static JSON in `src/data/plans.json`
2. **Custom plans**: User-created, stored in AsyncStorage

Use `getAllPlans()` from `src/utils/readingPlans.ts` to get merged list.

## Important Conventions

### AsyncStorage Keys
All keys prefixed with `@bible_reading:` to avoid conflicts:
- `@bible_reading:progress`
- `@bible_reading:notes`
- `@bible_reading:user`
- `@bible_reading:custom_plans`

**Never access AsyncStorage directly** - use functions in `src/utils/storage.ts`.

### Date Handling
Use `date-fns` for all date operations (already imported in `src/utils/dateUtils.ts`).

Key functions:
- `calculateCurrentDay(startDate)` - Returns day number (1-indexed) based on plan start
- `hasReadToday(completedDates)` - Boolean check if reading completed today
- `calculateStreak(completedDates)` - Returns { current, longest } streak

Dates stored as **ISO strings**. Always use `startOfDay()` when comparing dates to avoid time zone issues.

## Planned Features (Not Yet Implemented)

When implementing these, refer to detailed designs in `ARCHITECTURE.md`:

1. **Authentication** (`src/services/authService.ts`)
   - Use Supabase Auth
   - Store tokens in Expo SecureStore (not AsyncStorage)
   - Create `src/context/AuthContext.tsx` for global state

2. **Groups** (`src/services/groupService.ts`)
   - Real-time sync via Supabase subscriptions
   - Schema defined in ARCHITECTURE.md (tables: groups, group_members, member_progress)
   - Subscribe to group updates when screen is visible, unsubscribe on blur

3. **Push Notifications** (`src/services/notificationService.ts`)
   - Use expo-notifications
   - Schedule daily reminders at user's preferred time
   - Support notification actions (mark complete without opening app)

4. **Plan Import** (`src/services/importService.ts`)
   - Support formats: JSON, CSV, YouVersion, Bible Gateway
   - Validate with `validateCustomPlan()` before saving
   - Parsers in `src/utils/planParsers.ts`

## Testing Approach

When adding tests (not yet set up):
- Unit test utils (`src/utils/`) - Pure functions, easy to test
- Integration test services - Mock AsyncStorage and Supabase
- E2E test critical flows - Use Detox or Maestro

## Common Gotchas

1. **AsyncStorage is always async** - Don't forget `await`, or use cached values when available
2. **Custom plans cache** - Call `initializeCustomPlans()` before using `getCustomPlans()`
3. **Multi-plan support** - Old single-plan format auto-migrates, but always work with `MultiPlanProgress`
4. **Theme usage** - Spread theme objects, don't destructure (`...Typography.h2`, not `fontSize: Typography.h2.fontSize`)
5. **Navigation types** - React Navigation needs typed navigators (see examples in `src/navigation/`)

## Reference Documentation

- **ARCHITECTURE.md** - Detailed technical design for new features (auth, groups, notifications)
- **MIGRATION_PLAN.md** - What's been migrated, what's pending, file-by-file breakdown
- **GETTING_STARTED.md** - Quick start for new developers
- **../Reference/bible-reading-plan/** - Original web app for reference when migrating components
