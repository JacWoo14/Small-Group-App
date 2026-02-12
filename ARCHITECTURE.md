# Architecture Design: Bible Accountability App

This document outlines the technical architecture for the new features: groups, authentication, and push notifications.

---

## 🎯 Core Features

### 1. **User Authentication**
### 2. **Group Accountability**
### 3. **Push Notifications**
### 4. **Plan Import/Export**

---

## 📱 Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│           React Native App (Expo)           │
├─────────────────────────────────────────────┤
│  Screens │ Components │ Navigation          │
├─────────────────────────────────────────────┤
│  State Management (React Context/Zustand)   │
├─────────────────────────────────────────────┤
│  Services Layer                             │
│  ├─ Auth Service                            │
│  ├─ Groups Service                          │
│  ├─ Notifications Service                   │
│  ├─ Progress Sync Service                   │
│  └─ Import/Export Service                   │
├─────────────────────────────────────────────┤
│  Local Storage (AsyncStorage)               │
│  └─ Offline-first with sync queue           │
└─────────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│         Backend (Supabase/Firebase)         │
├─────────────────────────────────────────────┤
│  Authentication                             │
│  PostgreSQL Database / Firestore            │
│  Real-time Subscriptions                    │
│  Cloud Functions / Edge Functions           │
│  Storage (for plan imports)                 │
└─────────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│       Push Notification Service             │
│         (Expo Push Notifications)           │
└─────────────────────────────────────────────┘
```

---

## 🔐 1. Authentication System

### Technology Choice: **Supabase Auth**

**Why Supabase?**
- Built-in email/password auth
- Social OAuth providers (Google, Apple)
- Row-level security (RLS)
- JWT tokens
- Free tier: 50,000 monthly active users

### Authentication Flow

```
App Launch
    ↓
Check for stored session
    ├─ Session exists → Auto-login → Home
    └─ No session → Auth Screen
            ↓
    User chooses auth method
    ├─ Email/Password
    ├─ Google OAuth
    └─ Apple Sign In
            ↓
    Authenticate with Supabase
            ↓
    Store session (SecureStore)
            ↓
    Sync user data
            ↓
    Navigate to Home
```

### Data Model: Users

**Table: `users`**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  notification_settings JSONB DEFAULT '{
    "enabled": false,
    "dailyReminderTime": "08:00:00",
    "groupUpdates": true,
    "encouragementMessages": true,
    "pushToken": null
  }'::jsonb
);

-- Index for fast lookups
CREATE INDEX idx_users_email ON users(email);
```

### Implementation Files

**Services**:
- `src/services/authService.ts` - Authentication logic
  - `signIn(email, password)`
  - `signUp(email, password, displayName)`
  - `signInWithGoogle()`
  - `signInWithApple()`
  - `signOut()`
  - `getCurrentUser()`
  - `updateProfile(data)`

**Context**:
- `src/context/AuthContext.tsx` - Global auth state
  - Provides: `user`, `loading`, `signIn`, `signOut`, etc.

---

## 👥 2. Group Accountability System

### Core Functionality

1. **Create Groups** - Users can create reading groups
2. **Join Groups** - Via invite code or direct invite
3. **View Progress** - See everyone's reading progress
4. **Group Stats** - Aggregate stats (completion rate, active today)
5. **Encouragement** - Like/comment on members' progress

### Data Model: Groups

**Table: `groups`**
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  plan_id TEXT NOT NULL,  -- References reading plan
  invite_code TEXT UNIQUE,  -- e.g., "JOIN-ABC123"
  settings JSONB DEFAULT '{
    "isPrivate": true,
    "allowMemberInvites": true,
    "showProgress": true,
    "showStreaks": true
  }'::jsonb
);

CREATE INDEX idx_groups_invite_code ON groups(invite_code);
CREATE INDEX idx_groups_created_by ON groups(created_by);
```

**Table: `group_members`**
```sql
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
```

**Table: `member_progress`**
```sql
CREATE TABLE member_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  completed_readings JSONB DEFAULT '[]'::jsonb,
  completed_dates JSONB DEFAULT '[]'::jsonb,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_reading_date TIMESTAMP,
  total_readings INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_member_progress_group_id ON member_progress(group_id);
CREATE INDEX idx_member_progress_user_id ON member_progress(user_id);
```

### Real-Time Sync

**Supabase Realtime Subscriptions**:
```typescript
// Subscribe to group progress updates
const subscription = supabase
  .channel(`group:${groupId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'member_progress',
      filter: `group_id=eq.${groupId}`
    },
    (payload) => {
      // Update local state with new progress
      updateGroupProgress(payload.new);
    }
  )
  .subscribe();
```

### Sync Strategy: Offline-First

1. **Local Changes** - User completes reading → Update local AsyncStorage immediately
2. **Sync Queue** - Add change to sync queue
3. **Background Sync** - Upload to backend when online
4. **Real-time Updates** - Receive other members' updates via subscriptions

**Conflict Resolution**: Last-write-wins (timestamp-based)

### Implementation Files

**Services**:
- `src/services/groupService.ts` - Group CRUD operations
  - `createGroup(name, description, planId)`
  - `joinGroup(inviteCode)`
  - `leaveGroup(groupId)`
  - `getGroupById(groupId)`
  - `getUserGroups(userId)`
  - `updateGroupSettings(groupId, settings)`
  - `inviteMember(groupId, email)`

- `src/services/groupProgressService.ts` - Progress sync
  - `syncProgressToGroup(groupId, progress)`
  - `getGroupProgress(groupId)`
  - `subscribeToGroupUpdates(groupId, callback)`

**Context**:
- `src/context/GroupContext.tsx` - Global group state

---

## 🔔 3. Push Notifications System

### Notification Types

1. **Daily Reading Reminder**
   - Scheduled at user's preferred time
   - Shows today's passages
   - Actionable: Mark as complete from notification

2. **Group Activity**
   - Member completed today's reading
   - New member joined
   - Group milestone reached

3. **Encouragement**
   - Streak milestones (7, 14, 30, 90 days)
   - Weekly progress summary
   - Motivational messages

4. **Missed Reading Alert**
   - If user hasn't read by end of day
   - Gentle reminder to maintain streak

### Architecture

```
User Action (Complete Reading)
        ↓
Update Local Progress
        ↓
Sync to Backend
        ↓
Backend Cloud Function Triggered
        ↓
Determine which group members to notify
        ↓
Send push notification via Expo Push Service
        ↓
User receives notification
        ↓
Tap notification → Deep link to reading screen
        ↓
Can mark complete directly from notification action
```

### Daily Reminder Scheduling

**Approach**: Use `expo-notifications` scheduled notifications

```typescript
import * as Notifications from 'expo-notifications';

async function scheduleDailyReminder(time: string) {
  // Cancel existing
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule new
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📖 Today's Reading",
      body: "Genesis 1-3 • Don't break your streak!",
      data: { type: 'daily_reminder', readingId: 'nt-day-1' },
    },
    trigger: {
      hour: parseInt(time.split(':')[0]),
      minute: parseInt(time.split(':')[1]),
      repeats: true,
    },
  });
}
```

### Notification Actions

iOS and Android support notification actions:

```typescript
Notifications.setNotificationCategoryAsync('reading', [
  {
    identifier: 'mark_complete',
    buttonTitle: '✅ Mark Complete',
    options: {
      opensAppToForeground: false, // Background action
    },
  },
  {
    identifier: 'view_reading',
    buttonTitle: '📖 View Reading',
    options: {
      opensAppToForeground: true,
    },
  },
]);
```

### Data Model: Notifications

**Table: `scheduled_notifications`** (for backend-triggered notifications)
```sql
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  payload JSONB NOT NULL,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
```

### Implementation Files

**Services**:
- `src/services/notificationService.ts`
  - `registerForPushNotifications()`
  - `scheduleDailyReminder(time)`
  - `sendGroupNotification(groupId, message)`
  - `handleNotificationResponse(response)`
  - `updateNotificationSettings(settings)`

**Hooks**:
- `src/hooks/useNotifications.ts` - React hook for notifications

---

## 📥 4. Plan Import/Export System

### Supported Import Formats

1. **JSON** (Native format)
   ```json
   {
     "name": "Plan Name",
     "description": "Description",
     "type": "custom",
     "readings": [...]
   }
   ```

2. **CSV**
   ```csv
   Day,Passages,Tags,Theme
   1,"Genesis 1-3","Creation,Beginnings",Creation Week
   2,"Genesis 4-7","Sin,Judgment",Fall of Man
   ```

3. **YouVersion API** (if available)
   - Fetch plan via API
   - Convert to native format

4. **Bible Gateway** (web scraping or manual)
   - Parse HTML reading plans
   - Convert to native format

### Import Flow

```
User selects "Import Plan"
        ↓
Choose source (File, URL, Manual)
        ↓
    File Picker / URL Input
        ↓
    Parse format (JSON/CSV/etc.)
        ↓
    Validate structure
        ↓
    Preview plan
        ↓
    User confirms
        ↓
    Save to custom plans
        ↓
    Available in plan selector
```

### Data Validation

**Required Fields**:
- Plan name
- At least 1 reading
- Each reading must have passages

**Optional Fields**:
- Description
- Study tags
- Theme
- Estimated duration

### Implementation Files

**Services**:
- `src/services/importService.ts`
  - `importFromJSON(fileUri)`
  - `importFromCSV(fileUri)`
  - `importFromURL(url)`
  - `parseYouVersionPlan(planId)`
  - `validateImportedPlan(data)`

**Utils**:
- `src/utils/planParsers.ts` - Format-specific parsers

---

## 🗄️ Data Persistence Strategy

### Local Storage (Offline-First)

**AsyncStorage Keys**:
- `@bible_reading:progress` - User's reading progress
- `@bible_reading:notes` - Personal notes
- `@bible_reading:user` - User profile
- `@bible_reading:custom_plans` - Custom/imported plans
- `@bible_reading:sync_queue` - Pending sync operations

### Sync Strategy

1. **On App Launch**:
   - Load local data immediately (fast UI)
   - Sync with backend in background
   - Merge conflicts (last-write-wins)

2. **On User Action**:
   - Update local storage immediately
   - Add to sync queue
   - Attempt sync if online

3. **Periodic Sync**:
   - Every 5 minutes (when app is active)
   - On app foreground
   - On network reconnect

### Conflict Resolution

**Scenario**: User completes reading offline, another group member completes the same reading

**Resolution**:
- Local progress always preserved
- Timestamp determines latest update
- Group stats recalculated on server

---

## 🎨 UI/UX Design Patterns

### Navigation Structure

```
AuthStack (if not authenticated)
  └─ AuthScreen

MainTabNavigator (bottom tabs)
  ├─ TodayStack
  │   ├─ HomeScreen (Today's reading)
  │   └─ ReadingDetailScreen
  │
  ├─ PlansStack
  │   ├─ PlansScreen (Browse plans)
  │   ├─ PlanViewScreen (Plan details)
  │   └─ CreatePlanScreen
  │
  ├─ GroupsStack
  │   ├─ GroupsScreen (My groups)
  │   ├─ GroupDetailScreen (Group progress)
  │   ├─ CreateGroupScreen
  │   └─ JoinGroupScreen
  │
  ├─ ProgressStack
  │   └─ ProgressScreen (Stats & streaks)
  │
  └─ SettingsStack
      ├─ SettingsScreen
      ├─ ProfileScreen
      ├─ NotificationSettingsScreen
      └─ ImportPlanScreen
```

### Key Screens

**HomeScreen** (Today's Reading):
- Large reading passages card
- Checkbox to mark complete
- Streak display at top
- Group members' completion status
- Quick navigation to notes

**GroupDetailScreen**:
- Group name and description
- Member list with avatars
- Progress indicators (completed today, streaks)
- Group stats (completion rate, active today)
- Invite button

**NotificationSettingsScreen**:
- Daily reminder toggle
- Time picker for reminder
- Group update preferences
- Test notification button

---

## 🔧 Technical Decisions

### State Management

**Phase 1** (MVP): React Context API
- `AuthContext` - User authentication
- `GroupContext` - Group data and subscriptions
- `ProgressContext` - Reading progress

**Phase 2** (if needed): Zustand or Redux
- If performance issues with Context
- If state updates become too complex

### Backend Choice: Supabase

**Pros**:
- ✅ Built-in auth with social providers
- ✅ PostgreSQL (relational data fits our model)
- ✅ Real-time subscriptions
- ✅ Row-level security
- ✅ Edge functions (serverless)
- ✅ Generous free tier

**Cons**:
- Learning curve for SQL
- Less mature than Firebase

**Alternative**: Firebase
- More mature ecosystem
- Better documentation
- NoSQL (Firestore) - different data modeling

### Performance Optimizations

1. **Lazy Loading**:
   - Load group members on demand
   - Paginate reading history

2. **Caching**:
   - Cache plan data in AsyncStorage
   - Cache group member profiles

3. **Debouncing**:
   - Debounce search inputs
   - Throttle sync operations

4. **Optimistic Updates**:
   - Update UI immediately
   - Sync to backend asynchronously

---

## 📊 Analytics & Monitoring

### Tracking Events

**User Events**:
- Reading completed
- Streak milestone reached
- Plan started/completed
- Group joined/created

**Engagement Metrics**:
- Daily active users
- Retention rate (7-day, 30-day)
- Average streak length
- Group participation rate

**Technical Metrics**:
- Crash reports (Sentry)
- API response times
- Sync failures

### Tools

- **Analytics**: Expo Analytics or Firebase Analytics
- **Crash Reporting**: Sentry
- **Performance**: React Native Performance Monitor

---

## 🚀 Deployment & CI/CD

### Build Process

1. **Development**: Expo Go app (local testing)
2. **Preview**: EAS Build (preview builds for testers)
3. **Production**: EAS Submit (App Store + Play Store)

### CI/CD Pipeline

```
Git Push
    ↓
GitHub Actions
    ↓
Run Tests
    ↓
EAS Build (if main branch)
    ↓
Deploy to Expo (OTA updates)
    ↓
(Optional) Submit to stores
```

### Over-the-Air (OTA) Updates

Expo allows updates without app store review:
- Bug fixes
- Content updates
- Minor UI changes

**Limitations**: Cannot update native code

---

## 🔒 Security Considerations

### Authentication
- ✅ Use HTTPS for all API calls
- ✅ Store tokens in SecureStore (encrypted)
- ✅ Implement token refresh
- ✅ Log out on token expiration

### Data Privacy
- ✅ Row-level security on all tables
- ✅ Users can only read their own data + group data
- ✅ Group admins have additional permissions
- ✅ Delete user data on account deletion (GDPR)

### API Security
- ✅ Rate limiting on auth endpoints
- ✅ Validate all inputs
- ✅ Sanitize user-generated content
- ✅ Use parameterized queries (prevent SQL injection)

---

## 📈 Scalability Considerations

### Database
- **Indexes**: On all foreign keys and frequently queried fields
- **Partitioning**: If `member_progress` grows large, partition by group_id
- **Caching**: Redis cache for frequently accessed data

### Push Notifications
- **Expo Push Notification Service**: Handles 1000s of notifications/second
- **Batch sends**: Group notifications sent in batches
- **Fallback**: If Expo service is down, queue for retry

### Real-time Subscriptions
- **Connection pooling**: Supabase handles this
- **Limit subscriptions**: Only subscribe to active group(s)
- **Unsubscribe on blur**: Clean up when screen is not visible

---

## 🧪 Testing Strategy

### Unit Tests
- Utils functions (dateUtils, storage, etc.)
- Pure functions in services

### Integration Tests
- Auth flow (sign in, sign up, sign out)
- Group creation and joining
- Progress sync

### E2E Tests (Detox or Maestro)
- Complete reading flow
- Group interaction flow
- Notification handling

### Manual Testing Checklist
- [ ] Offline mode works
- [ ] Sync recovers from network errors
- [ ] Notifications trigger correctly
- [ ] Deep links work
- [ ] Group updates appear in real-time

---

## 📚 Resources & References

### Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase Docs](https://supabase.com/docs)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

### Design Inspiration
- YouVersion Bible App
- Habitica (habit tracking)
- Strava (social fitness)

---

## ✅ Success Metrics

### MVP Success (3 months)
- 100+ active users
- Average 7-day streak
- 50% of users in at least one group
- 90% notification delivery rate

### Long-term Success (1 year)
- 10,000+ active users
- Average 30-day streak
- 70% of users in groups
- 4.5+ rating on App Store and Play Store

---

**End of Architecture Document**
