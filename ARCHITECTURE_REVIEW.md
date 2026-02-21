# Architecture Review & Technical Decisions

## ✅ OVERALL ASSESSMENT: **APPROVED with Recommendations**

Your simplified architecture is **much better** than the over-engineered approach. Here's my detailed review:

---

## 🎯 KEY ARCHITECTURAL DECISIONS

### 1. **Database Schema: EXCELLENT ✅**

**What's Right:**
- Date-based tracking (not day numbers) - simpler queries, clearer logic
- User-configurable notification time stored in DB - essential for scheduling
- Invite codes for low-friction joining - perfect for small groups
- JSONB for passages - flexible, queryable, appropriate for PostgreSQL

**Improvements Made in schema.sql:**
- ✅ Linked `users.id` to `auth.users(id)` - critical for Supabase auth
- ✅ Added `is_active` to `group_members` - allows soft "leaving" without data loss
- ✅ Added RLS policies from the start - security first
- ✅ Added database function `get_todays_reading()` - offload calculation to DB
- ✅ Added more indexes for common query patterns

**Why This Works:**
- Small dataset (500 users max) - indexes will be fast
- Simple queries - no complex joins
- PostgreSQL JSONB - fast, flexible, perfect for passages array

---

### 2. **Notification Architecture: APPROVED with Caveats ⚠️**

**Your Approach: User-Configurable Times**

**Pros:**
- ✅ User flexibility - people read at different times (morning, lunch, evening)
- ✅ Higher engagement - notifications at preferred time = more likely to complete
- ✅ Simple to implement - Expo notifications supports this well

**Cons:**
- ⚠️ One notification per group - could be spammy if user joins 5 groups
- ⚠️ Background limitations - iOS restricts background tasks

**RECOMMENDATION: Combined Notification Approach**

Instead of one notification per group, send **ONE combined notification** at user's preferred time:

```
Title: "Today's Reading"
Body: "Genesis 1-2 (Bible Study Group) • Matthew 5 (Church Group)"
Action: "Mark All Complete" or "View Groups"
```

**Why?**
- Less intrusive - one notification instead of 3-5
- Still shows all readings - user sees everything at a glance
- Simpler scheduling - one scheduled notification per user
- Better iOS compliance - fewer background tasks

**Implementation Strategy:**
```typescript
// Schedule ONE notification per user (not per group)
async function scheduleDailyNotification(user: User) {
  const userGroups = await getUserGroups(user.id);

  // Get today's reading for each group
  const readings = userGroups.map(group => ({
    groupName: group.name,
    passages: getTodaysReadingForGroup(group)
  }));

  // Format: "Genesis 1-2 (Study Group) • Psalm 1 (Prayer Group)"
  const body = readings
    .map(r => `${formatPassages(r.passages)} (${r.groupName})`)
    .join(' • ');

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Today's Reading",
      body: body,
      data: { groups: userGroups.map(g => g.id) }
    },
    trigger: {
      hour: user.preferred_notification_time.hour,
      minute: user.preferred_notification_time.minute,
      repeats: true
    }
  });
}
```

**If user taps notification:**
- Opens app to TodayScreen
- Shows all groups with mark-complete buttons
- Can mark one, some, or all

**Alternative: Quick Actions (iOS/Android)**
```typescript
// iOS: 3D Touch / Long Press
// Android: Long Press
categories: [{
  identifier: 'reading',
  actions: [
    { identifier: 'mark_all', title: 'Mark All Complete' },
    { identifier: 'view', title: 'View Readings' }
  ]
}]
```

---

### 3. **"Group Recap In-App Only" Decision: BRILLIANT ✅**

This is a **smart UX decision**. Here's why:

**Problem with recap in notifications:**
- Timing conflicts (what if notification fires before others complete?)
- Stale data (notification shows outdated info)
- Complexity (when to send? How to update?)

**Solution: In-app recap:**
- ✅ Always accurate (queries current data)
- ✅ No timing issues (updates when user opens app)
- ✅ Shows both yesterday (complete) and today (live)
- ✅ Simpler code (no notification scheduling logic)

**Keep this approach!**

---

### 4. **Date-Based Tracking vs Day Numbers: EXCELLENT ✅**

This was the right call. Comparison:

| Aspect | Day Numbers (old) | Dates (new) |
|--------|------------------|-------------|
| Query complexity | High (calculate day from start) | Low (just use date) |
| Multiple groups | Confusing (different day numbers) | Clear (same date) |
| Streaks | Complex calculation | Simple date comparison |
| User understanding | "What's day 45?" | "February 14" - obvious |
| Timezones | Complex | Handled by PostgreSQL |

**Implementation is straightforward:**
```sql
-- Old approach (complex):
SELECT * FROM completions
WHERE user_id = $1
  AND day_number = (CURRENT_DATE - group.start_date)

-- New approach (simple):
SELECT * FROM completions
WHERE user_id = $1
  AND reading_date = CURRENT_DATE
```

---

## 🔧 TECHNICAL DECISIONS

### **1. RLS Policies: IMPLEMENT NOW ✅**

**Answer: Yes, implement RLS from the start.**

**Why:**
- Security by default - prevent accidental data leaks
- Easier to add now than retrofit later
- Supabase makes it easy - already done in schema.sql
- You're learning - better to learn correct patterns

**I've included all necessary RLS policies in the schema.** Key ones:
- Users can only see/edit their own profile
- Group members can only see their group's data
- Reading completions visible within groups only

---

### **2. State Management: React Context is SUFFICIENT ✅**

**Answer: Use React Context for MVP. Skip Redux/Zustand.**

**Why:**
- Small dataset - fetching from Supabase is fast
- Simple state - user, groups, completions
- React Context handles this easily
- You're learning - keep it simple

**Recommended structure:**
```typescript
// src/context/AuthContext.tsx - Global auth state
// src/hooks/useGroups.ts - Fetch user's groups
// src/hooks/useCompletions.ts - Fetch group completions
// Local state in components for UI (loading, errors)
```

**When to switch to Zustand:**
- App becomes slow (unlikely with 500 users max)
- Complex cross-screen state management
- Need dev tools for debugging state

**For now: Context + React Query (or SWR) for data fetching**

---

### **3. Offline Support: ONLINE-FIRST is FINE ✅**

**Answer: Online-first with simple AsyncStorage cache is acceptable.**

**Why:**
- Users need internet to sync group progress anyway
- Notifications work offline (scheduled locally)
- Can mark complete offline, sync when online
- Simpler code - no sync queue complexity

**Recommended approach:**
```typescript
// Mark complete flow
async function markComplete(groupId, date) {
  try {
    // Try to sync to Supabase
    await supabase.from('reading_completions').insert({
      user_id: currentUser.id,
      group_id: groupId,
      reading_date: date
    });

    // Also cache locally for instant UI update
    await cacheCompletion(groupId, date);

  } catch (error) {
    // Network error - save to local queue
    await saveToSyncQueue({ groupId, date });

    // Still update UI optimistically
    await cacheCompletion(groupId, date);

    // Retry when app reopens or network returns
  }
}
```

**When to add full offline queue:**
- Users report frequent sync failures
- You have time to build it properly
- NOT for MVP

---

### **4. Testing Strategy: MINIMAL for MVP ✅**

**Answer: Focus on utils tests + manual E2E testing.**

**What to test:**
- ✅ Utils functions (date calculations, streak logic) - easy to test, high value
- ✅ Manual testing of critical flows (sign up, join group, mark complete, notifications)
- ❌ Skip component tests for now - overkill for MVP
- ❌ Skip integration tests - manual testing is faster

**Example test structure:**
```typescript
// src/utils/__tests__/dateUtils.test.ts
describe('getTodaysReadingForGroup', () => {
  it('calculates day 1 for group starting today', () => {
    const group = { start_date: new Date(), reading_plan: { total_days: 365 } };
    const result = getTodaysReadingForGroup(group);
    expect(result.day_number).toBe(1);
  });

  it('handles plan cycling (day 366 of 365-day plan)', () => {
    const startDate = subDays(new Date(), 365);
    const group = { start_date: startDate, reading_plan: { total_days: 365 } };
    const result = getTodaysReadingForGroup(group);
    expect(result.day_number).toBe(1); // Wraps back to day 1
  });
});
```

---

### **5. TypeScript: STRICT from the start ✅**

**Answer: Be strict. Use types, not `any`.**

**Why:**
- You're learning - types teach you the API
- Catch errors early - typos, wrong params, etc.
- Supabase has great TypeScript support
- Easier to refactor later

**Generated types from Supabase:**
```bash
# Generate TypeScript types from your database
npx supabase gen types typescript --project-id your-project-id > src/types/database.ts
```

Then use them:
```typescript
import { Database } from './types/database';

type User = Database['public']['Tables']['users']['Row'];
type GroupInsert = Database['public']['Tables']['groups']['Insert'];
```

**When you don't know a type, use `unknown` (not `any`), then narrow it:**
```typescript
// Bad
const data: any = await fetchData();

// Good
const data: unknown = await fetchData();
if (isUser(data)) {
  // TypeScript now knows data is User
}
```

---

## 📱 MULTIPLE GROUPS & NOTIFICATIONS

### **Decision: ONE combined notification ✅**

**Why:**
- Less intrusive (1 notification vs 5)
- Simpler scheduling (fewer background tasks)
- Better iOS compliance (Apple limits background notifications)
- Still shows all info

**User Flow:**

**7:00 AM - Notification arrives:**
```
🔔 Today's Reading
Genesis 1-2 (Bible Study) • Psalm 119 (Prayer Group) • John 3 (Youth Group)
[View] [Dismiss]
```

**User taps notification → Opens to TodayScreen:**
```
┌─────────────────────────────────┐
│ Today's Reading                 │
├─────────────────────────────────┤
│ Bible Study Group               │
│ Genesis 1-2                     │
│ [✓ Mark Complete]               │
├─────────────────────────────────┤
│ Prayer Group                    │
│ Psalm 119                       │
│ [✓ Mark Complete]               │
├─────────────────────────────────┤
│ Youth Group                     │
│ John 3                          │
│ [✓ Mark Complete]               │
└─────────────────────────────────┘
```

**Implementation:**
```typescript
// TodayScreen shows ALL user's groups
function TodayScreen() {
  const user = useCurrentUser();
  const groups = useUserGroups(user.id); // All groups

  return (
    <ScrollView>
      {groups.map(group => (
        <GroupReadingCard
          key={group.id}
          group={group}
          reading={getTodaysReadingForGroup(group)}
          onMarkComplete={() => markComplete(group.id)}
        />
      ))}
    </ScrollView>
  );
}
```

---

## ⚠️ BIGGEST TECHNICAL RISKS

### **1. Notification Reliability (iOS)**

**Risk:** iOS may not fire notifications reliably, especially if app is force-quit.

**Mitigation:**
- Use `expo-notifications` (built on UserNotifications framework)
- Request proper permissions (alerts, sounds, badges)
- Test on real devices, not just simulator
- Fallback: In-app reminder banner if notification didn't fire

---

### **2. Timezone Handling**

**Risk:** Group members in different timezones see different "today".

**Mitigation:**
- Store user's timezone in DB (auto-detected on signup)
- Use PostgreSQL `AT TIME ZONE` for date calculations
- Notification fires at local time (7am PST for LA user, 7am EST for NYC user)
- "Today's reading" is based on user's local date

**Example:**
```sql
-- Get today's reading for a user in their timezone
SELECT * FROM get_todays_reading(
  'group-uuid',
  'America/Los_Angeles' -- User's timezone
);
```

---

### **3. Supabase Free Tier Limits**

**Risk:** Exceed free tier (500 users, 2GB bandwidth, 500MB DB)

**Mitigation:**
- 500 users × small records = well under 500MB DB ✅
- 500 users × 1 API call/day = ~15k calls/month (free tier: 500k/month) ✅
- Optimize images (use compressed assets)
- Cache reading plans locally (don't fetch every day)

**You're safe for MVP!**

---

## 🚀 IMPLEMENTATION ROADMAP

### **Phase Validation:**

Your 4-phase plan is **realistic and well-structured**. Here's my assessment:

| Phase | Time Estimate | Realistic? | Notes |
|-------|---------------|------------|-------|
| Phase 1: Foundation | 1 week | ✅ Yes | Auth + basic reading + settings |
| Phase 2: Notifications | 1 week | ⚠️ Maybe 1.5 weeks | iOS permissions can be tricky |
| Phase 3: Groups | 1 week | ✅ Yes | QR codes + joining + recap |
| Phase 4: Polish | 1 week | ⚠️ Probably 1.5 weeks | Streaks + edge cases take time |

**Total: 3.5-4.5 weeks** (your estimate of 3-4 weeks was close!)

**Suggested Reordering:**

**No major changes needed**, but consider this tweak:

1. **Phase 1:** Auth + Settings + Basic Reading (same)
2. **Phase 2:** Groups BEFORE notifications
   - Easier to test groups without notification complexity
   - Can manually test group flow
   - Notifications depend on having groups
3. **Phase 3:** Notifications (now that groups exist)
   - Test with real groups
   - Easier to debug
4. **Phase 4:** Polish (same)

---

## 🛠️ MISSING PACKAGES/LIBRARIES

Here's what you need to add to `package.json`:

```json
{
  "dependencies": {
    // Already have: expo, react-native, typescript

    // Supabase
    "@supabase/supabase-js": "^2.39.0",

    // Auth & Security
    "expo-secure-store": "~13.0.1", // For storing auth tokens

    // Notifications
    "expo-notifications": "~0.27.0",
    "expo-device": "~6.0.0", // For device info

    // QR Code
    "react-native-qrcode-svg": "^6.3.0", // Generate QR
    "expo-barcode-scanner": "~13.0.0", // Scan QR

    // Date handling (already have date-fns?)
    "date-fns": "^3.0.0",

    // UI Components
    "@react-native-community/datetimepicker": "8.0.0", // Time picker

    // Deep Linking (already in Expo)
    "expo-linking": "~6.2.0",

    // Clipboard (for copying invite codes)
    "expo-clipboard": "~6.0.0",

    // Optional but recommended:
    "@tanstack/react-query": "^5.0.0", // Data fetching/caching
    "react-hook-form": "^7.49.0", // Form handling
    "zod": "^3.22.0" // Runtime validation
  },
  "devDependencies": {
    // Testing
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.4.0",

    // Type generation
    "supabase": "^1.142.0" // CLI for generating types
  }
}
```

**Install command:**
```bash
npx expo install expo-notifications expo-device expo-barcode-scanner @react-native-community/datetimepicker expo-linking expo-clipboard expo-secure-store react-native-qrcode-svg date-fns
npm install @supabase/supabase-js @tanstack/react-query react-hook-form zod
```

---

## 📂 PROJECT STRUCTURE REFACTOR

**Answer: Refactor folder structure NOW, implement features into clean structure.**

**Why:**
- Easier to find files as project grows
- Clearer separation of concerns
- Better for learning (you'll understand the architecture)

**Recommended structure:**

```
src/
├── components/           # Reusable UI components
│   ├── GroupReadingCard.tsx
│   ├── MemberCompletionList.tsx
│   ├── PassagesList.tsx
│   ├── TimePicker.tsx
│   └── ui/              # Generic UI (Button, Card, Input)
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Input.tsx
│
├── screens/             # Full-screen components
│   ├── auth/
│   │   ├── AuthScreen.tsx
│   │   └── OnboardingScreen.tsx
│   ├── groups/
│   │   ├── CreateGroupScreen.tsx
│   │   ├── GroupScreen.tsx
│   │   └── JoinGroupScreen.tsx
│   ├── TodayScreen.tsx
│   ├── PlansScreen.tsx
│   ├── ProgressScreen.tsx
│   └── SettingsScreen.tsx
│
├── navigation/          # Navigation setup
│   ├── RootNavigator.tsx
│   ├── MainTabNavigator.tsx
│   └── types.ts
│
├── services/            # External services
│   ├── supabase.ts     # Supabase client setup
│   ├── auth.ts         # Auth methods
│   └── notifications.ts # Notification scheduling
│
├── hooks/               # Custom React hooks
│   ├── useAuth.ts      # Auth state & methods
│   ├── useGroups.ts    # Fetch/manage groups
│   ├── useCompletions.ts
│   └── useNotifications.ts
│
├── context/             # React Context providers
│   └── AuthContext.tsx
│
├── utils/               # Pure utility functions
│   ├── dateUtils.ts    # Date calculations
│   ├── streakUtils.ts  # Streak calculations
│   ├── formatUtils.ts  # Text formatting
│   └── validation.ts   # Input validation
│
├── types/               # TypeScript types
│   ├── index.ts        # App types
│   └── database.ts     # Generated from Supabase
│
├── constants/           # Constants
│   ├── theme.ts        # Design system
│   └── config.ts       # App config
│
└── data/                # Static data (if any)
    └── plans.json      # Fallback plans (optional)
```

**Keep from current structure:**
- ✅ `src/constants/theme.ts`
- ✅ `src/types/index.ts` (update it)
- ⚠️ `src/utils/dateUtils.ts` (refactor for date-based tracking)

**Remove/simplify:**
- ❌ Complex offline sync utilities
- ❌ `src/utils/storage.ts` (replace with Supabase)
- ❌ `src/utils/customPlans.ts` (plans are now in DB)

---

## ✅ SUMMARY OF KEY DECISIONS

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Database Schema | ✅ Approved (with tweaks in schema.sql) | Date-based, simple, optimized for Supabase |
| RLS Policies | ✅ Implement now | Security first, easier than retrofitting |
| State Management | React Context + React Query | Simple, sufficient for MVP |
| Offline Support | Online-first with cache | Simpler, acceptable for group app |
| TypeScript | Strict typing, no `any` | Better learning, fewer bugs |
| Multiple Groups | ONE combined notification | Less intrusive, simpler code |
| Group Recap | In-app only (not in notification) | Always accurate, no timing issues |
| Notifications | User-configurable time | Higher engagement, user-friendly |
| Testing | Utils tests + manual E2E | Fast, sufficient for MVP |
| Folder Structure | Refactor now | Clearer organization, easier to scale |

---

## 🎯 READY FOR PHASE 1?

**YES!** Your architecture is solid. Proceed to Phase 1 implementation.

**Next steps:**
1. Install dependencies (see list above)
2. Set up Supabase project (I'll provide step-by-step)
3. Run schema.sql to create tables
4. Start building auth flow

**I'll provide detailed Phase 1 implementation in the next document.**
