# Quick Reference Guide

Quick copy-paste commands and code snippets you'll use frequently during development.

---

## 🚀 COMMON COMMANDS

### Start Development
```bash
npm start                 # Start Expo dev server
npm run ios              # Run on iOS simulator (Mac only)
npm run android          # Run on Android emulator
npm run web              # Run in web browser (limited)
```

### Clear Cache (when things break)
```bash
npx expo start -c        # Clear Metro bundler cache
rm -rf node_modules      # Delete node_modules
npm install              # Reinstall dependencies
```

### Database Management
```bash
# Generate TypeScript types from Supabase
npx supabase login
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

### Testing
```bash
npm test                 # Run Jest tests
npx tsc --noEmit        # Type check without compiling
```

---

## 📊 SUPABASE QUERIES

### Fetch User Profile
```typescript
const { data: user, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

### Fetch User's Groups
```typescript
const { data: groups, error } = await supabase
  .from('group_members')
  .select(`
    groups (
      *,
      reading_plans (*)
    )
  `)
  .eq('user_id', userId)
  .eq('is_active', true);
```

### Fetch Group with Members
```typescript
const { data: group, error } = await supabase
  .from('groups')
  .select(`
    *,
    reading_plans (*),
    group_members!inner (
      *,
      users (
        id,
        display_name,
        email
      )
    )
  `)
  .eq('id', groupId)
  .eq('group_members.is_active', true)
  .single();
```

### Fetch Today's Completions for Group
```typescript
const today = format(new Date(), 'yyyy-MM-dd');

const { data: completions, error } = await supabase
  .from('reading_completions')
  .select(`
    *,
    users (
      display_name
    )
  `)
  .eq('group_id', groupId)
  .eq('reading_date', today);
```

### Mark Reading Complete
```typescript
const { error } = await supabase
  .from('reading_completions')
  .insert({
    user_id: userId,
    group_id: groupId,
    reading_date: format(new Date(), 'yyyy-MM-dd'),
    notes: optionalNotes,
  });
```

### Create Group
```typescript
// 1. Generate invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// 2. Insert group
const { data: group, error } = await supabase
  .from('groups')
  .insert({
    name: groupName,
    reading_plan_id: planId,
    start_date: format(startDate, 'yyyy-MM-dd'),
    invite_code: generateInviteCode(),
    created_by: userId,
  })
  .select()
  .single();

// 3. Add creator as member
await supabase
  .from('group_members')
  .insert({
    group_id: group.id,
    user_id: userId,
  });
```

### Join Group by Invite Code
```typescript
// 1. Find group
const { data: group, error } = await supabase
  .from('groups')
  .select('*')
  .eq('invite_code', inviteCode.toUpperCase())
  .single();

if (!group) throw new Error('Invalid invite code');

// 2. Add user as member
await supabase
  .from('group_members')
  .insert({
    group_id: group.id,
    user_id: userId,
  });
```

---

## 📅 DATE UTILITIES

### Get Today's Reading for Group
```typescript
import { differenceInDays } from 'date-fns';

function getTodaysReadingDayNumber(group: Group): number {
  const today = new Date();
  const startDate = new Date(group.start_date);
  const daysSinceStart = differenceInDays(today, startDate);

  // Handle plan cycling (day 366 of 365-day plan = day 1)
  const totalDays = group.reading_plan.total_days;
  const dayInPlan = (daysSinceStart % totalDays) + 1;

  return dayInPlan;
}

// Then fetch the reading:
const dayNumber = getTodaysReadingDayNumber(group);
const { data: reading } = await supabase
  .from('plan_readings')
  .select('*')
  .eq('plan_id', group.reading_plan_id)
  .eq('day_number', dayNumber)
  .single();
```

### Format Date for Display
```typescript
import { format } from 'date-fns';

// Full date: "Friday, February 14, 2026"
format(new Date(), 'EEEE, MMMM d, yyyy');

// Short date: "Feb 14"
format(new Date(), 'MMM d');

// Database format: "2026-02-14"
format(new Date(), 'yyyy-MM-dd');

// Time: "7:00 AM"
const time = new Date();
time.setHours(7, 0);
format(time, 'h:mm a');
```

### Calculate Streak
```typescript
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

function calculateStreak(completions: ReadingCompletion[]): StreakData {
  if (completions.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Sort by date descending
  const sortedDates = completions
    .map(c => parseISO(c.reading_date))
    .sort((a, b) => b.getTime() - a.getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  // Check if today or yesterday is included for current streak
  const today = startOfDay(new Date());
  const mostRecentDate = sortOfDay(sortedDates[0]);
  const daysSinceLast = differenceInDays(today, mostRecentDate);

  if (daysSinceLast <= 1) {
    currentStreak = 1;

    // Count consecutive days
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = differenceInDays(sortedDates[i - 1], sortedDates[i]);
      if (diff === 1) {
        currentStreak++;
        tempStreak++;
      } else {
        break;
      }
    }
  }

  // Find longest streak
  tempStreak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = differenceInDays(sortedDates[i - 1], sortedDates[i]);
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return { current: currentStreak, longest: longestStreak };
}
```

---

## 🔔 NOTIFICATION UTILITIES

### Request Permissions
```typescript
import * as Notifications from 'expo-notifications';

async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}
```

### Schedule Daily Notification
```typescript
import * as Notifications from 'expo-notifications';

async function scheduleDailyNotification(
  user: User,
  groups: Group[]
) {
  // Cancel existing notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Parse user's preferred time
  const [hours, minutes] = user.preferred_notification_time.split(':');

  // Format readings for all groups
  const readingsText = groups
    .map(g => {
      const reading = getTodaysReadingForGroup(g);
      const passages = formatPassages(reading.passages);
      return `${passages} (${g.name})`;
    })
    .join(' • ');

  // Schedule notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Today's Reading",
      body: readingsText,
      data: {
        type: 'daily_reminder',
        groups: groups.map(g => g.id),
      },
    },
    trigger: {
      hour: parseInt(hours),
      minute: parseInt(minutes),
      repeats: true,
    },
  });
}
```

### Format Passages
```typescript
function formatPassages(passages: Passage[]): string {
  return passages
    .map(p => {
      const chapters = p.chapters || p.chapter;
      return `${p.book} ${chapters}`;
    })
    .join(', ');
}

// Example output: "Genesis 1-2, Matthew 5, Psalm 1"
```

---

## 🎨 COMMON UI PATTERNS

### Loading State
```typescript
function MyScreen() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  async function fetchData() {
    setLoading(true);
    try {
      const result = await supabase.from('table').select();
      setData(result.data);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <View>{/* Your content */}</View>;
}
```

### Pull to Refresh
```typescript
import { RefreshControl } from 'react-native';

function MyScreen() {
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Your content */}
    </ScrollView>
  );
}
```

### Error Handling
```typescript
try {
  const { data, error } = await supabase.from('table').select();

  if (error) throw error;

  // Success - use data
} catch (error: any) {
  // User-friendly error message
  Alert.alert(
    'Error',
    error.message || 'Something went wrong. Please try again.'
  );
}
```

---

## 🧪 TESTING TIPS

### Test Magic Link Locally
1. Start app: `npm start`
2. Note your computer's IP (shown in terminal)
3. In Supabase, add redirect URL: `exp://YOUR_IP:8081`
4. Enter email in app
5. Check email on phone
6. Click link → should open app

### Test Notifications Locally
```typescript
// Send test notification immediately
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Test Notification',
    body: 'This is a test',
  },
  trigger: null, // null = send immediately
});
```

### Debug Supabase Queries
```typescript
// Enable verbose logging
const { data, error } = await supabase
  .from('table')
  .select()
  .eq('id', 'test');

console.log('Data:', JSON.stringify(data, null, 2));
console.log('Error:', error);
```

### Check RLS Policies
```sql
-- In Supabase SQL Editor
-- Test as specific user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'user-uuid-here';

-- Now run your query
SELECT * FROM users;
```

---

## 🐛 COMMON ERRORS & FIXES

### "row level security policy" error
**Fix:** Check RLS policies allow the operation. Use Supabase SQL Editor to test queries.

### "duplicate key value violates unique constraint"
**Fix:** Trying to insert duplicate data (e.g., same user joining group twice). Check uniqueness before inserting.

### "invalid input syntax for type uuid"
**Fix:** Passing wrong type for UUID field. Make sure you're passing string UUIDs, not objects.

### "relation does not exist"
**Fix:** Table not created. Run `schema.sql` in Supabase SQL Editor.

### Magic link not working
**Fix:** Check redirect URL in Supabase matches your dev URL. Use IP address, not localhost.

### Notification not firing
**Fix:**
1. Check permissions granted
2. Test on real device (not simulator)
3. Don't force-quit app (iOS won't fire notifications)
4. Use `trigger: null` to test immediately

---

## 📱 PLATFORM-SPECIFIC NOTES

### iOS
- Notifications require real device for testing
- Magic links work better on device than simulator
- Time picker shows wheel UI

### Android
- Notifications work on emulator
- Deep links may need manual config
- Time picker shows clock UI

---

## 🔗 USEFUL LINKS

- Supabase Dashboard: https://app.supabase.com/project/_/editor
- Expo Docs: https://docs.expo.dev/
- React Navigation Docs: https://reactnavigation.org/
- date-fns Docs: https://date-fns.org/
- TypeScript Handbook: https://www.typescriptlang.org/docs/

---

## 💾 GIT COMMANDS

```bash
# After each working feature
git add .
git commit -m "feat: implement user authentication"
git push

# Create branch for new feature
git checkout -b feature/groups
# ... work on feature ...
git add .
git commit -m "feat: add group creation"
git push -u origin feature/groups

# Return to main
git checkout main
```

---

**Bookmark this file! You'll reference it constantly during development.**
