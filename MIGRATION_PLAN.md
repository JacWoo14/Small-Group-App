# Migration Plan: Web App to React Native

This document outlines the migration from the Next.js web app to React Native mobile app.

## ✅ Completed Migrations

### 1. TypeScript Types & Interfaces
**Source**: `Reference/bible-reading-plan/types/index.ts`
**Destination**: `src/types/index.ts`
**Status**: ✅ Complete + Enhanced

**Enhancements**:
- Added new types for user authentication (`User`, `NotificationSettings`)
- Added group functionality types (`Group`, `GroupMember`, `GroupProgress`, etc.)
- Added notification types (`NotificationPayload`, `ScheduledNotification`)
- Added import/export types (`ImportedPlan`, `ExportData`)
- Added API response types (`ApiResponse`, `PaginatedResponse`)

### 2. Data Files
**Source**: `Reference/bible-reading-plan/data/`
**Destination**: `src/data/`
**Status**: ✅ Complete

**Migrated Files**:
- ✅ `plans.json` - All reading plans
- ✅ `studyTags.json` - Study tags and themes

### 3. Utility Functions
**Status**: ✅ Complete + Adapted for React Native

#### dateUtils.ts
**Source**: `Reference/bible-reading-plan/lib/dateUtils.ts`
**Destination**: `src/utils/dateUtils.ts`
**Changes**:
- ✅ Direct migration (no browser dependencies)
- ✅ Added `formatTimeForNotification()` for notification scheduling
- ✅ Added `parseNotificationTime()` for parsing notification times

#### readingPlans.ts
**Source**: `Reference/bible-reading-plan/lib/readingPlans.ts`
**Destination**: `src/utils/readingPlans.ts`
**Changes**:
- ✅ Updated import paths for React Native
- ✅ Added `searchPlans()` function
- ✅ Added `getPlansByType()` function

#### customPlans.ts
**Source**: `Reference/bible-reading-plan/lib/customPlans.ts`
**Destination**: `src/utils/customPlans.ts`
**Changes**:
- ✅ Replaced `localStorage` with `AsyncStorage`
- ✅ Added cache for synchronous access
- ✅ All functions now async where needed
- ✅ Added `initializeCustomPlans()` for app startup

#### storage.ts
**Source**: `Reference/bible-reading-plan/lib/storage.ts`
**Destination**: `src/utils/storage.ts`
**Changes**:
- ✅ Complete rewrite using `AsyncStorage` instead of `localStorage`
- ✅ All storage functions now async
- ✅ Added user management functions
- ✅ Maintained migration logic for old data formats
- ✅ Added `saveUser()` and `loadUser()` functions

### 4. Theme & Design System
**Source**: `Reference/bible-reading-plan/tailwind.config.ts`
**Destination**: `src/constants/theme.ts`
**Status**: ✅ Complete

**Migrated Elements**:
- ✅ Color palette (Sacred Gold, Deep Earth, Spiritual Blue, etc.)
- ✅ Spacing system
- ✅ Border radius values
- ✅ Font sizes and weights
- ✅ Typography styles
- ✅ Shadow definitions
- ✅ Common component styles

---

## 📋 Pending Migrations

### 5. React Components
**Source**: `Reference/bible-reading-plan/components/`
**Destination**: `src/components/`
**Status**: ⏳ Pending

**Components to Migrate**:
- [ ] `Navigation.tsx` → Adapt to React Navigation
- [ ] `PlanSelector.tsx` → Convert to mobile UI
- [ ] `ProgressStreak.tsx` → Convert to mobile UI
- [ ] `TodayReading.tsx` → Convert to mobile UI with native checkboxes

**Required Changes**:
- Replace HTML elements with React Native components (`<div>` → `<View>`, `<p>` → `<Text>`, etc.)
- Replace Tailwind CSS with StyleSheet or styled-components
- Use theme constants from `src/constants/theme.ts`
- Adapt for touch interactions (larger tap targets)

### 6. Screen Components
**Source**: `Reference/bible-reading-plan/app/*/page.tsx`
**Destination**: `src/screens/`
**Status**: ⏳ Pending

**Screens to Migrate**:
- [ ] `app/page.tsx` → `src/screens/HomeScreen.tsx`
- [ ] `app/plans/page.tsx` → `src/screens/PlansScreen.tsx`
- [ ] `app/progress/page.tsx` → `src/screens/ProgressScreen.tsx`
- [ ] `app/settings/page.tsx` → `src/screens/SettingsScreen.tsx`
- [ ] `app/plan-view/page.tsx` → `src/screens/PlanViewScreen.tsx`
- [ ] `app/create-plan/page.tsx` → `src/screens/CreatePlanScreen.tsx`

**New Screens Needed**:
- [ ] `src/screens/AuthScreen.tsx` - Login/signup
- [ ] `src/screens/GroupsScreen.tsx` - View all groups
- [ ] `src/screens/GroupDetailScreen.tsx` - Individual group view
- [ ] `src/screens/CreateGroupScreen.tsx` - Create new group
- [ ] `src/screens/ProfileScreen.tsx` - User profile

---

## 🆕 New Features to Implement

### 1. User Authentication
**Priority**: High
**Status**: Not Started

**Requirements**:
- Email/password authentication
- Social auth (Google, Apple)
- User profile management
- Secure token storage

**Recommended Tools**:
- Firebase Authentication or Supabase Auth
- Expo SecureStore for token storage

### 2. Group Functionality
**Priority**: High
**Status**: Not Started

**Requirements**:
- Create/join groups
- Invite members via code
- View group progress dashboard
- Group settings management

**Backend Needed**:
- Group database (Firestore/Supabase)
- Real-time progress sync
- Member management

### 3. Push Notifications
**Priority**: High
**Status**: Not Started

**Requirements**:
- Daily reading reminders (scheduled at user's preferred time)
- Group activity notifications
- Encouragement messages
- Ability to mark reading complete from notification

**Implementation**:
- Use `expo-notifications`
- Schedule daily notifications
- Handle notification interactions (deep linking)
- Background task for notification updates

### 4. Plan Import
**Priority**: Medium
**Status**: Not Started

**Supported Formats**:
- JSON (direct format)
- CSV (custom format)
- YouVersion plans (API integration)
- Bible Gateway plans (scraping/API)

**Implementation**:
- File picker for local imports
- URL import for online plans
- Format validation
- Preview before import

---

## 🏗️ Architecture Decisions

### State Management
**Decision**: Start with React Context, migrate to Redux/Zustand if needed

**Rationale**:
- App is relatively simple initially
- Context API sufficient for auth, groups, progress
- Can add Redux later for complex group syncing

### Backend/Database
**Recommendation**: **Supabase** (PostgreSQL + Real-time)

**Rationale**:
- Free tier generous for MVP
- Real-time subscriptions for group updates
- Built-in authentication
- PostgreSQL for complex queries
- Row-level security

**Alternative**: Firebase (Firestore + Auth)

### Navigation
**Decision**: React Navigation (Bottom Tabs + Stack)

**Structure**:
```
Root Navigator (Stack)
├─ Auth Stack (if not logged in)
│  └─ AuthScreen
└─ Main Navigator (Bottom Tabs)
   ├─ Today (Stack)
   │  ├─ HomeScreen
   │  └─ ReadingDetailScreen
   ├─ Plans (Stack)
   │  ├─ PlansScreen
   │  ├─ PlanViewScreen
   │  └─ CreatePlanScreen
   ├─ Groups (Stack)
   │  ├─ GroupsScreen
   │  ├─ GroupDetailScreen
   │  └─ CreateGroupScreen
   ├─ Progress (Stack)
   │  └─ ProgressScreen
   └─ Settings (Stack)
      ├─ SettingsScreen
      └─ ProfileScreen
```

---

## 📦 Dependencies Summary

### Already Installed
- ✅ `@react-navigation/native`
- ✅ `@react-navigation/bottom-tabs`
- ✅ `@react-navigation/native-stack`
- ✅ `date-fns`
- ✅ `react-native-screens`
- ✅ `react-native-safe-area-context`
- ✅ `@react-native-async-storage/async-storage`
- ✅ `expo-notifications`
- ✅ `expo-device`
- ✅ `expo-constants`

### To Be Installed (As Needed)
- [ ] `@supabase/supabase-js` - Backend/database
- [ ] `expo-secure-store` - Secure token storage
- [ ] `expo-document-picker` - File imports
- [ ] `expo-sharing` - Export functionality
- [ ] `react-native-gesture-handler` - Better touch interactions
- [ ] `react-native-reanimated` - Smooth animations

---

## 🚀 Next Steps

1. **Set up Navigation** (High Priority)
   - Configure React Navigation
   - Create basic screen components
   - Implement tab navigator

2. **Migrate Core Screens** (High Priority)
   - HomeScreen (Today's reading)
   - PlansScreen (Browse/select plans)
   - ProgressScreen (Stats and streaks)

3. **Implement Authentication** (High Priority)
   - Set up Supabase/Firebase
   - Create auth screens
   - Implement auth flow

4. **Add Push Notifications** (High Priority)
   - Configure expo-notifications
   - Implement daily reminders
   - Add notification actions

5. **Build Group Features** (Medium Priority)
   - Design group database schema
   - Create group screens
   - Implement real-time sync

6. **Add Plan Import** (Medium Priority)
   - Support JSON/CSV import
   - Add format converters
   - Create import UI

---

## 📝 Notes

- The reference project uses Next.js App Router - screens are in `app/` directory
- All `'use client'` directives can be removed (not needed in React Native)
- Browser-specific code (window, document) already removed from utilities
- LocalStorage migrations handled automatically in storage.ts
- Theme colors and design system preserved from original

---

## 🎯 Migration Progress: ~40% Complete

**Completed**:
- ✅ Project setup
- ✅ Types and interfaces
- ✅ Utility functions
- ✅ Data files
- ✅ Theme system

**In Progress**:
- 🔄 Navigation structure
- 🔄 Component migrations

**Not Started**:
- ⏳ Screen components
- ⏳ Authentication
- ⏳ Groups
- ⏳ Notifications
- ⏳ Plan imports
