import plansData from '../data/plans.json';
import { ReadingPlan, Reading } from '../types';
import { getCustomPlans } from './customPlans';

/**
 * Get all reading plans (default + custom)
 * @returns Array of all available reading plans
 */
export function getAllPlans(): ReadingPlan[] {
  const defaultPlans = plansData.plans as ReadingPlan[];
  const customPlans = getCustomPlans();
  return [...defaultPlans, ...customPlans];
}

/**
 * Get a specific plan by ID
 * @param id Plan ID
 * @returns ReadingPlan or null if not found
 */
export function getPlanById(id: string): ReadingPlan | null {
  const plans = getAllPlans();
  return plans.find((p) => p.id === id) || null;
}

/**
 * Get a specific reading by day number
 * @param plan Reading plan
 * @param day Day number (1-indexed)
 * @returns Reading or null if not found
 */
export function getReadingByDay(plan: ReadingPlan, day: number): Reading | null {
  return plan.readings.find((r) => r.day === day) || null;
}

/**
 * Get a specific reading by ID
 * @param plan Reading plan
 * @param readingId Reading ID
 * @returns Reading or null if not found
 */
export function getReadingById(plan: ReadingPlan, readingId: string): Reading | null {
  return plan.readings.find((r) => r.id === readingId) || null;
}

/**
 * Get all readings for a plan
 * @param plan Reading plan
 * @returns Array of readings
 */
export function getAllReadings(plan: ReadingPlan): Reading[] {
  return plan.readings;
}

/**
 * Search plans by name or description
 * @param query Search query
 * @returns Array of matching plans
 */
export function searchPlans(query: string): ReadingPlan[] {
  const lowerQuery = query.toLowerCase();
  return getAllPlans().filter(
    (plan) =>
      plan.name.toLowerCase().includes(lowerQuery) ||
      plan.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Filter plans by type
 * @param type Plan type
 * @returns Array of plans matching the type
 */
export function getPlansByType(
  type: 'chronological' | 'thematic' | 'book-by-book' | 'custom'
): ReadingPlan[] {
  return getAllPlans().filter((plan) => plan.type === type);
}
