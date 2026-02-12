# Getting Started with Bible Accountability App

Quick start guide for developers new to the project.

## 🎯 Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd bible-accountability-app
npm install
```

### 2. Start Development Server
```bash
npm start
```

This will:
- Start the Metro bundler
- Show a QR code
- Give you options to run on iOS/Android/Web

### 3. Run on Your Device

**Option A: Physical Device**
1. Install "Expo Go" from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in terminal
3. App will load on your device

**Option B: Simulator/Emulator**
```bash
npm run ios     # iOS Simulator (macOS only)
npm run android # Android Emulator (requires Android Studio)
```

## 📖 Understanding the Codebase

### Key Files to Know

1. **App.tsx** - Entry point, loads navigation
2. **src/navigation/RootNavigator.tsx** - Main navigation setup
3. **src/constants/theme.ts** - All colors, spacing, typography
4. **src/types/index.ts** - TypeScript type definitions
5. **src/utils/storage.ts** - Data persistence layer

### Current Status

**✅ Ready to Use:**
- TypeScript types for all features
- Utility functions (date handling, storage, reading plans)
- Theme and design system
- Basic navigation structure
- Placeholder screens

**🚧 To Be Implemented:**
- Screen UI components
- User authentication
- Group features
- Push notifications
- Backend integration

## 🔨 Your First Task

### Option 1: Migrate a Screen from Reference Project

**Goal**: Convert the web HomeScreen to mobile

**Steps**:
1. Read the reference screen: `Reference/bible-reading-plan/app/page.tsx`
2. Convert to React Native components
3. Use theme constants from `src/constants/theme.ts`
4. Update `src/screens/HomeScreen.tsx`

**Example Conversion**:
```tsx
// Web (React + Tailwind)
<div className="bg-white rounded-lg p-4">
  <h2 className="text-2xl font-bold text-gray-900">Title</h2>
</div>

// Mobile (React Native)
<View style={styles.card}>
  <Text style={styles.title}>Title</Text>
</View>

const styles = StyleSheet.create({
  card: {
    ...CommonStyles.card,  // From theme.ts
  },
  title: {
    ...Typography.h3,       // From theme.ts
  },
});
```

### Option 2: Build a New Component

**Goal**: Create a reusable card component

**Steps**:
1. Create `src/components/Card.tsx`
2. Use theme constants
3. Make it reusable with props
4. Export for use in screens

**Example**:
```tsx
// src/components/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { CommonStyles } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: CommonStyles.card,
});
```

### Option 3: Set Up Authentication

**Goal**: Integrate Supabase authentication

**Steps**:
1. Create Supabase project (free tier)
2. Install Supabase client: `npm install @supabase/supabase-js`
3. Create `src/services/authService.ts`
4. Implement sign in/sign up functions
5. Create `src/context/AuthContext.tsx`
6. Build `src/screens/AuthScreen.tsx`

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed auth flow.

## 🧭 Navigation Structure

```
RootNavigator
  └─ MainTabNavigator (bottom tabs)
      ├─ Today Tab → HomeScreen
      ├─ Plans Tab → PlansScreen
      ├─ Groups Tab → GroupsScreen
      ├─ Progress Tab → ProgressScreen
      └─ Settings Tab → SettingsScreen
```

**To add a new screen:**
1. Create screen file in `src/screens/`
2. Import in navigator
3. Add to stack or tab configuration

## 🎨 Using the Theme

Import and use theme constants:

```tsx
import { Colors, Typography, Spacing, CommonStyles } from '../constants/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.parchment,
    padding: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: Colors.deepEarth,
  },
  card: {
    ...CommonStyles.card,
    marginBottom: Spacing.md,
  },
});
```

## 🗂️ Data Flow

### Local-First Approach

1. **User Action** (e.g., complete reading)
   ↓
2. **Update AsyncStorage** (immediate)
   ↓
3. **Update UI** (instant feedback)
   ↓
4. **Add to Sync Queue** (when backend is ready)
   ↓
5. **Sync to Backend** (background)

### Key Utils

**Storage**:
```tsx
import { saveProgress, loadProgress } from '../utils/storage';

// Save progress
await saveProgress(progressData);

// Load progress
const progress = await loadProgress();
```

**Reading Plans**:
```tsx
import { getAllPlans, getPlanById } from '../utils/readingPlans';

// Get all plans
const plans = getAllPlans();

// Get specific plan
const plan = getPlanById('nt-90');
```

**Date Utils**:
```tsx
import { calculateCurrentDay, hasReadToday } from '../utils/dateUtils';

// Calculate current day of plan
const day = calculateCurrentDay(startDate);

// Check if read today
const completed = hasReadToday(completedDates);
```

## 🧪 Testing Your Changes

### Quick Manual Test

1. **Start app**: `npm start`
2. **Navigate** to your screen
3. **Test functionality**
4. **Check on both iOS and Android** (if possible)

### Check for TypeScript Errors

```bash
npx tsc --noEmit
```

### Run Linter

```bash
npx eslint . --ext .ts,.tsx
```

## 📝 Common Tasks

### Add a New Screen

1. Create file: `src/screens/YourScreen.tsx`
2. Copy template from existing screen
3. Add to navigator
4. Implement UI

### Add a New Utility Function

1. Choose appropriate file in `src/utils/`
2. Add function with JSDoc comments
3. Export function
4. Use TypeScript types

### Modify Theme

1. Edit `src/constants/theme.ts`
2. Changes apply app-wide
3. Use theme constants in components

## 🚨 Common Issues

### Metro Bundler Cache Issues
```bash
npx expo start -c
```

### Node Modules Issues
```bash
rm -rf node_modules package-lock.json
npm install
```

### iOS Simulator Not Opening
```bash
npx expo run:ios
```

### Android Build Errors
```bash
cd android && ./gradlew clean
cd .. && npm run android
```

## 📚 Learning Resources

### React Native Basics
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)

### Navigation
- [React Navigation](https://reactnavigation.org/)
- [Navigation Patterns](https://reactnavigation.org/docs/hello-react-navigation)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### State Management
- [React Context](https://react.dev/learn/passing-data-deeply-with-context)
- [Zustand (if we migrate)](https://github.com/pmndrs/zustand)

## 🎯 Next Steps

1. **Familiarize yourself** with the codebase structure
2. **Read** [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for roadmap
3. **Choose a task** from the migration plan
4. **Start coding** and have fun!

## 💬 Need Help?

- Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- Check [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for context
- Look at reference project for inspiration
- Ask questions in issues or PRs

---

**Happy coding! 🚀**
