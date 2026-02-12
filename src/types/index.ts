// ==========================================
// CORE READING PLAN TYPES (Migrated from reference)
// ==========================================

export interface ReadingPlan {
  id: string;
  name: string;
  description: string;
  type: 'chronological' | 'thematic' | 'book-by-book' | 'custom';
  readings: Reading[];
  totalDays: number;
  estimatedDuration: string;
}

export interface Reading {
  id: string;
  day: number;
  passages: string[];
  studyTags?: string[];
  theme?: string;
}

export interface Progress {
  userId: string;
  currentPlanId: string;
  completedReadings: string[];
  completedDates: string[]; // Array of ISO date strings for each completed reading
  currentStreak: number;
  longestStreak: number;
  lastReadingDate: string | null;
  totalReadings: number;
  startDate: string;
}

export interface Note {
  id: string;
  readingId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyFocus {
  tags: string[];
  customTags: string[];
}

export interface StudyTag {
  id: string;
  name: string;
  color: string;
}

export interface PlanProgress {
  planId: string;
  completedReadings: string[];
  completedDates: string[]; // Array of ISO date strings for each completed reading
  currentStreak: number;
  longestStreak: number;
  lastReadingDate: string | null;
  totalReadings: number;
  startDate: string;
  lastAccessedDate: string; // When this plan was last active
}

export interface MultiPlanProgress {
  userId: string;
  currentPlanId: string; // The currently active plan
  planProgress: Record<string, PlanProgress>; // Map of planId to PlanProgress
}

// ==========================================
// NEW FEATURES: USER & AUTHENTICATION
// ==========================================

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  lastSeen: string;
  notificationSettings: NotificationSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  dailyReminderTime: string; // ISO time string (e.g., "08:00:00")
  groupUpdates: boolean;
  encouragementMessages: boolean;
  pushToken?: string; // Expo push token for notifications
}

// ==========================================
// NEW FEATURES: GROUPS & ACCOUNTABILITY
// ==========================================

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string; // userId
  createdAt: string;
  members: GroupMember[];
  planId: string; // The shared reading plan for this group
  inviteCode?: string; // Optional invite code for joining
  settings: GroupSettings;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  photoURL?: string;
  joinedAt: string;
  role: 'admin' | 'member';
  isActive: boolean;
}

export interface GroupSettings {
  isPrivate: boolean; // Private groups require invite code
  allowMemberInvites: boolean; // Can members invite others?
  showProgress: boolean; // Show individual progress to group
  showStreaks: boolean; // Show streaks to group
}

export interface GroupProgress {
  groupId: string;
  memberProgress: Record<string, MemberProgress>; // Map of userId to their progress
  groupStats: GroupStats;
}

export interface MemberProgress {
  userId: string;
  displayName: string;
  photoURL?: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  lastReadingDate: string | null;
  totalReadings: number;
  progressPercentage: number; // Percentage of plan completed
}

export interface GroupStats {
  totalMembers: number;
  activeToday: number; // Members who completed today
  averageStreak: number;
  groupLongestStreak: number;
  completionRate: number; // Overall group completion percentage
}

// ==========================================
// NEW FEATURES: NOTIFICATIONS
// ==========================================

export interface NotificationPayload {
  type: 'daily_reminder' | 'group_update' | 'encouragement' | 'milestone';
  title: string;
  body: string;
  data?: Record<string, any>;
  scheduledTime?: string; // ISO timestamp
}

export interface ScheduledNotification {
  id: string;
  userId: string;
  type: NotificationPayload['type'];
  scheduledFor: string; // ISO timestamp
  payload: NotificationPayload;
  sent: boolean;
}

// ==========================================
// IMPORT/EXPORT TYPES
// ==========================================

export interface ImportedPlan {
  format: 'json' | 'csv' | 'youversion' | 'bible_gateway' | 'custom';
  data: any;
  metadata?: {
    source: string;
    importedAt: string;
    originalFormat: string;
  };
}

export interface ExportData {
  version: string;
  exportedAt: string;
  user: User;
  progress: MultiPlanProgress;
  notes: Note[];
  studyFocus: StudyFocus;
  groups?: string[]; // Group IDs user belongs to
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}
