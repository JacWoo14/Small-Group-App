import AsyncStorage from '@react-native-async-storage/async-storage';
import { Progress, Note, StudyFocus, MultiPlanProgress, PlanProgress, User } from '../types';

const STORAGE_KEYS = {
  PROGRESS: '@bible_reading:progress',
  NOTES: '@bible_reading:notes',
  STUDY_FOCUS: '@bible_reading:study_focus',
  USER: '@bible_reading:user',
  GROUPS: '@bible_reading:groups',
};

// ==========================================
// MIGRATION HELPERS
// ==========================================

function isOldProgressFormat(data: any): data is Progress {
  return data && 'completedReadings' in data && !('planProgress' in data);
}

function migrateProgressToMultiPlan(oldProgress: Progress): MultiPlanProgress {
  const planProgress: PlanProgress = {
    planId: oldProgress.currentPlanId,
    completedReadings: oldProgress.completedReadings,
    completedDates: oldProgress.completedDates,
    currentStreak: oldProgress.currentStreak,
    longestStreak: oldProgress.longestStreak,
    lastReadingDate: oldProgress.lastReadingDate,
    totalReadings: oldProgress.totalReadings,
    startDate: oldProgress.startDate,
    lastAccessedDate: new Date().toISOString(),
  };

  return {
    userId: oldProgress.userId,
    currentPlanId: oldProgress.currentPlanId,
    planProgress: {
      [oldProgress.currentPlanId]: planProgress,
    },
  };
}

// ==========================================
// PROGRESS MANAGEMENT
// ==========================================

/**
 * Save progress to storage
 * @param progress Multi-plan progress object
 */
export async function saveProgress(progress: MultiPlanProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save progress:', error);
    throw error;
  }
}

/**
 * Load progress from storage
 * @returns MultiPlanProgress or null if not found
 */
export async function loadProgress(): Promise<MultiPlanProgress | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!data) return null;

    const parsed = JSON.parse(data);

    // Migration: Check if old format
    if (isOldProgressFormat(parsed)) {
      const migrated = migrateProgressToMultiPlan(parsed);
      // Save migrated data
      await saveProgress(migrated);
      return migrated;
    }

    return parsed as MultiPlanProgress;
  } catch (error) {
    console.error('Failed to load progress:', error);
    return null;
  }
}

/**
 * Create default progress for a new plan
 * @param planId Plan ID
 * @param userId User ID (optional, will generate if not provided)
 * @returns New MultiPlanProgress object
 */
export function createDefaultProgress(planId: string, userId?: string): MultiPlanProgress {
  const planProgress: PlanProgress = {
    planId: planId,
    completedReadings: [],
    completedDates: [],
    currentStreak: 0,
    longestStreak: 0,
    lastReadingDate: null,
    totalReadings: 0,
    startDate: new Date().toISOString(),
    lastAccessedDate: new Date().toISOString(),
  };

  return {
    userId: userId || generateUserId(),
    currentPlanId: planId,
    planProgress: {
      [planId]: planProgress,
    },
  };
}

/**
 * Get progress for a specific plan
 * @param multiProgress Multi-plan progress object
 * @param planId Plan ID
 * @returns PlanProgress or null if not found
 */
export function getPlanProgress(
  multiProgress: MultiPlanProgress,
  planId: string
): PlanProgress | null {
  return multiProgress.planProgress[planId] || null;
}

/**
 * Get progress for the currently active plan
 * @param multiProgress Multi-plan progress object
 * @returns PlanProgress or null if not found
 */
export function getCurrentPlanProgress(multiProgress: MultiPlanProgress): PlanProgress | null {
  return getPlanProgress(multiProgress, multiProgress.currentPlanId);
}

/**
 * Switch to a different plan (preserving progress)
 * @param multiProgress Current multi-plan progress
 * @param newPlanId New plan ID to switch to
 * @returns Updated MultiPlanProgress
 */
export function switchPlan(
  multiProgress: MultiPlanProgress,
  newPlanId: string
): MultiPlanProgress {
  const now = new Date().toISOString();

  // Update last accessed date for current plan
  if (multiProgress.planProgress[multiProgress.currentPlanId]) {
    multiProgress.planProgress[multiProgress.currentPlanId].lastAccessedDate = now;
  }

  // If new plan doesn't have progress, create it
  if (!multiProgress.planProgress[newPlanId]) {
    multiProgress.planProgress[newPlanId] = {
      planId: newPlanId,
      completedReadings: [],
      completedDates: [],
      currentStreak: 0,
      longestStreak: 0,
      lastReadingDate: null,
      totalReadings: 0,
      startDate: now,
      lastAccessedDate: now,
    };
  } else {
    // Update last accessed date for new plan
    multiProgress.planProgress[newPlanId].lastAccessedDate = now;
  }

  return {
    ...multiProgress,
    currentPlanId: newPlanId,
  };
}

/**
 * Reset progress for a specific plan
 * @param multiProgress Current multi-plan progress
 * @param planId Plan ID to reset
 * @returns Updated MultiPlanProgress
 */
export function resetPlanProgress(
  multiProgress: MultiPlanProgress,
  planId: string
): MultiPlanProgress {
  const newProgress = { ...multiProgress };

  if (newProgress.planProgress[planId]) {
    newProgress.planProgress[planId] = {
      planId: planId,
      completedReadings: [],
      completedDates: [],
      currentStreak: 0,
      longestStreak: 0,
      lastReadingDate: null,
      totalReadings: 0,
      startDate: new Date().toISOString(),
      lastAccessedDate: new Date().toISOString(),
    };
  }

  return newProgress;
}

// ==========================================
// NOTES MANAGEMENT
// ==========================================

/**
 * Save a note
 * @param note Note object
 */
export async function saveNote(note: Note): Promise<void> {
  try {
    const notes = await loadNotes();
    const existingIndex = notes.findIndex((n) => n.id === note.id);

    if (existingIndex >= 0) {
      notes[existingIndex] = note;
    } else {
      notes.push(note);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to save note:', error);
    throw error;
  }
}

/**
 * Load all notes
 * @returns Array of notes
 */
export async function loadNotes(): Promise<Note[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load notes:', error);
    return [];
  }
}

/**
 * Get note for a specific reading
 * @param readingId Reading ID
 * @returns Note or null if not found
 */
export async function getNoteForReading(readingId: string): Promise<Note | null> {
  const notes = await loadNotes();
  return notes.find((n) => n.readingId === readingId) || null;
}

/**
 * Get notes for a specific plan
 * @param planId Plan ID
 * @returns Array of notes for the plan
 */
export async function getNotesForPlan(planId: string): Promise<Note[]> {
  const allNotes = await loadNotes();
  return allNotes.filter((note) => note.readingId.startsWith(planId));
}

/**
 * Delete a note
 * @param noteId Note ID
 */
export async function deleteNote(noteId: string): Promise<void> {
  try {
    const notes = await loadNotes();
    const filtered = notes.filter((n) => n.id !== noteId);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete note:', error);
    throw error;
  }
}

// ==========================================
// STUDY FOCUS MANAGEMENT
// ==========================================

/**
 * Save study focus
 * @param focus StudyFocus object
 */
export async function saveStudyFocus(focus: StudyFocus): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STUDY_FOCUS, JSON.stringify(focus));
  } catch (error) {
    console.error('Failed to save study focus:', error);
    throw error;
  }
}

/**
 * Load study focus
 * @returns StudyFocus object
 */
export async function loadStudyFocus(): Promise<StudyFocus> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.STUDY_FOCUS);
    return data ? JSON.parse(data) : { tags: [], customTags: [] };
  } catch (error) {
    console.error('Failed to load study focus:', error);
    return { tags: [], customTags: [] };
  }
}

// ==========================================
// USER MANAGEMENT
// ==========================================

/**
 * Save user data
 * @param user User object
 */
export async function saveUser(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save user:', error);
    throw error;
  }
}

/**
 * Load user data
 * @returns User or null if not found
 */
export async function loadUser(): Promise<User | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load user:', error);
    return null;
  }
}

// ==========================================
// IMPORT/EXPORT
// ==========================================

/**
 * Export all data
 * @returns Export data object
 */
export async function exportData() {
  try {
    const user = await loadUser();
    const progress = await loadProgress();
    const notes = await loadNotes();
    const studyFocus = await loadStudyFocus();

    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      user,
      progress,
      notes,
      studyFocus,
    };
  } catch (error) {
    console.error('Failed to export data:', error);
    return null;
  }
}

/**
 * Import data
 * @param data Export data object
 */
export async function importData(data: any): Promise<void> {
  try {
    if (data.user) {
      await saveUser(data.user);
    }
    if (data.progress) {
      // Handle old format if importing from old export
      if (isOldProgressFormat(data.progress)) {
        const migrated = migrateProgressToMultiPlan(data.progress);
        await saveProgress(migrated);
      } else {
        await saveProgress(data.progress);
      }
    }
    if (data.notes) {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(data.notes));
    }
    if (data.studyFocus) {
      await saveStudyFocus(data.studyFocus);
    }
  } catch (error) {
    console.error('Failed to import data:', error);
    throw error;
  }
}

/**
 * Clear all data
 */
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PROGRESS,
      STORAGE_KEYS.NOTES,
      STORAGE_KEYS.STUDY_FOCUS,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.GROUPS,
    ]);
  } catch (error) {
    console.error('Failed to clear data:', error);
    throw error;
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
