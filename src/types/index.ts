// ==========================================
// TYPES FOR SIMPLIFIED DATE-BASED ARCHITECTURE
// ==========================================

// ==========================================
// USER & AUTHENTICATION
// ==========================================

export interface User {
  id: string; // Links to Supabase auth.users
  email: string;
  display_name: string;
  timezone: string;
  preferred_notification_time: string; // "HH:MM" format (e.g., "07:00")
  created_at: string;
  updated_at: string;
}

// ==========================================
// READING PLANS
// ==========================================

export interface ReadingPlan {
  id: string;
  name: string;
  description: string | null;
  total_days: number;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  readings?: PlanReading[]; // Optional - populated when fetching plan details
}

export interface PlanReading {
  id: string;
  plan_id: string;
  day_number: number | null;
  scheduled_date: string | null; // YYYY-MM-DD
  passages: string[]; // Plain display strings e.g. ["Isaiah 63", "Psalm 1"]
}

export type Passage = string;

// ==========================================
// GROUPS & ACCOUNTABILITY
// ==========================================

export interface Group {
  id: string;
  name: string;
  reading_plan_id: string;
  start_date: string; // YYYY-MM-DD format (e.g., "2026-02-14")
  invite_code: string; // 6-character code
  created_by: string;
  created_at: string;
  updated_at: string;
  // Populated when fetching group details:
  reading_plan?: ReadingPlan;
  members?: GroupMemberDetails[];
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean; // false = soft-deleted (user left)
}

export interface GroupMemberDetails extends GroupMember {
  display_name: string;
  email: string;
  // Progress stats (computed):
  completed_today?: boolean;
  current_streak?: number;
  total_completions?: number;
}

// ==========================================
// READING COMPLETIONS (DATE-BASED!)
// ==========================================

export interface ReadingCompletion {
  id: string;
  user_id: string;
  group_id: string;
  reading_date: string; // YYYY-MM-DD format (e.g., "2026-02-14")
  completed_at: string; // ISO timestamp
  notes: string | null;
}

// ==========================================
// COMPUTED STATS (NOT STORED IN DB)
// ==========================================

export interface UserStats {
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  completion_percentage: number; // For current group/plan
}

export interface GroupStats {
  total_members: number;
  completed_today: number; // Count of members who completed today
  completed_yesterday: number;
  group_streak: number; // Consecutive days where ALL members completed
}

export interface StreakData {
  current: number;
  longest: number;
}

// ==========================================
// UI STATE TYPES
// ==========================================

export interface TodayReading {
  group: Group;
  day_number: number | null;
  passages: Passage[];
  completed: boolean;
}

export interface GroupRecap {
  date: string; // Which date this recap is for
  total_members: number;
  completions: {
    user_id: string;
    display_name: string;
    completed: boolean;
    notes?: string;
  }[];
}

// ==========================================
// NOTIFICATION TYPES
// ==========================================

export interface NotificationPayload {
  title: string;
  body: string;
  data: {
    type: 'daily_reminder' | 'group_update' | 'milestone';
    groups?: string[]; // Group IDs
    reading_date?: string; // YYYY-MM-DD
    [key: string]: any;
  };
}

export interface DailyReminderData {
  readings: {
    group_id: string;
    group_name: string;
    passages: Passage[];
  }[];
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T> {
  data: T | null;
  error: {
    message: string;
    code?: string;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number | null;
  error: {
    message: string;
    code?: string;
  } | null;
}

// ==========================================
// FORM TYPES
// ==========================================

export interface CreateGroupForm {
  name: string;
  reading_plan_id: string;
  start_date: Date;
}

export interface JoinGroupForm {
  invite_code: string;
}

export interface OnboardingForm {
  display_name: string;
  notification_time: Date;
}

export interface UpdateProfileForm {
  display_name?: string;
  preferred_notification_time?: string;
}

// ==========================================
// NAVIGATION TYPES
// ==========================================

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Today: undefined;
  Groups: undefined;
  Progress: undefined;
  Settings: undefined;
};

export type GroupStackParamList = {
  GroupList: undefined;
  GroupDetails: { groupId: string };
  CreateGroup: undefined;
  JoinGroup: undefined;
  ImportPlan: undefined;
};
