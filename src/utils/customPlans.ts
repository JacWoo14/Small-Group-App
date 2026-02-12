import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReadingPlan, Reading } from '../types';

const STORAGE_KEY = '@bible_reading:custom_plans';

// In-memory cache for synchronous access (populated on app start)
let customPlansCache: ReadingPlan[] = [];

/**
 * Initialize custom plans cache
 * Call this on app startup
 */
export async function initializeCustomPlans(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    customPlansCache = data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to initialize custom plans:', error);
    customPlansCache = [];
  }
}

/**
 * Get all custom plans (synchronous, uses cache)
 * @returns Array of custom plans
 */
export function getCustomPlans(): ReadingPlan[] {
  return customPlansCache;
}

/**
 * Load custom plans from storage (async)
 * @returns Promise resolving to array of custom plans
 */
export async function loadCustomPlans(): Promise<ReadingPlan[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    customPlansCache = data ? JSON.parse(data) : [];
    return customPlansCache;
  } catch (error) {
    console.error('Failed to load custom plans:', error);
    return [];
  }
}

/**
 * Save a custom plan
 * @param plan Reading plan to save
 */
export async function saveCustomPlan(plan: ReadingPlan): Promise<void> {
  try {
    const existingIndex = customPlansCache.findIndex((p) => p.id === plan.id);

    if (existingIndex >= 0) {
      customPlansCache[existingIndex] = plan;
    } else {
      customPlansCache.push(plan);
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(customPlansCache));
  } catch (error) {
    console.error('Failed to save custom plan:', error);
    throw error;
  }
}

/**
 * Delete a custom plan
 * @param planId Plan ID to delete
 */
export async function deleteCustomPlan(planId: string): Promise<void> {
  try {
    customPlansCache = customPlansCache.filter((p) => p.id !== planId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(customPlansCache));
  } catch (error) {
    console.error('Failed to delete custom plan:', error);
    throw error;
  }
}

/**
 * Create a new custom plan
 * @param name Plan name
 * @param description Plan description
 * @param readings Array of readings
 * @returns New ReadingPlan object
 */
export function createCustomPlan(
  name: string,
  description: string,
  readings: Reading[]
): ReadingPlan {
  const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    name,
    description,
    type: 'custom',
    readings,
    totalDays: readings.length,
    estimatedDuration: `${readings.length} days`,
  };
}

/**
 * Validate a custom plan
 * @param plan Partial plan object to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateCustomPlan(plan: Partial<ReadingPlan>): string[] {
  const errors: string[] = [];

  if (!plan.name || plan.name.trim().length === 0) {
    errors.push('Plan name is required');
  }

  if (!plan.description || plan.description.trim().length === 0) {
    errors.push('Plan description is required');
  }

  if (!plan.readings || plan.readings.length === 0) {
    errors.push('At least one reading is required');
  }

  if (plan.readings) {
    plan.readings.forEach((reading, index) => {
      if (!reading.passages || reading.passages.length === 0) {
        errors.push(`Reading ${index + 1} must have at least one passage`);
      }
    });
  }

  return errors;
}

/**
 * Create a reading entry for custom plan
 * @param day Day number
 * @param passages Array of passage references
 * @param studyTags Optional study tags
 * @param theme Optional theme
 * @returns Reading object
 */
export function createReading(
  day: number,
  passages: string[],
  studyTags?: string[],
  theme?: string
): Reading {
  return {
    id: `reading-${day}-${Date.now()}`,
    day,
    passages,
    studyTags,
    theme,
  };
}

/**
 * Parse passages from text (e.g., "Genesis 1-2, Psalm 1")
 * @param text Comma-separated passage references
 * @returns Array of passage strings
 */
export function parsePassages(text: string): string[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Generate a simple sequential plan (e.g., read entire book)
 * @param name Plan name
 * @param description Plan description
 * @param startBook Book name
 * @param chapters Number of chapters
 * @returns ReadingPlan object
 */
export function generateSequentialPlan(
  name: string,
  description: string,
  startBook: string,
  chapters: number
): ReadingPlan {
  const readings: Reading[] = [];

  for (let i = 1; i <= chapters; i++) {
    readings.push(createReading(i, [`${startBook} ${i}`]));
  }

  return createCustomPlan(name, description, readings);
}
