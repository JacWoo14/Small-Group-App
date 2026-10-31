/**
 * Unit tests for src/services/reminders.ts: which readings get a reminder.
 * getTodaysReadings (the per-date RPC wrapper) is mocked; no network.
 */

const mockGetTodaysReadings = jest.fn();
jest.mock('../services/completions', () => ({
  getTodaysReadings: (...args: unknown[]) => mockGetTodaysReadings(...args),
}));

import { getUpcomingReminders, REMINDER_WINDOW_DAYS } from '../services/reminders';

function reading(groupId: string, groupName: string, passages: string[], completed = false) {
  return { group: { id: groupId, name: groupName }, day_number: null, passages, completed };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTodaysReadings.mockResolvedValue([]);
});

describe('getUpcomingReminders', () => {
  it('looks up each of the next 14 days, starting today, with consecutive dates', async () => {
    await getUpcomingReminders('user-1', 'America/Chicago', new Date(2099, 0, 30));

    expect(REMINDER_WINDOW_DAYS).toBe(14);
    expect(mockGetTodaysReadings).toHaveBeenCalledTimes(14);
    const dates = mockGetTodaysReadings.mock.calls.map((call) => call[2]);
    expect(dates[0]).toBe('2099-01-30');
    expect(dates[1]).toBe('2099-01-31');
    expect(dates[2]).toBe('2099-02-01'); // crosses a month boundary
    expect(dates[13]).toBe('2099-02-12');
    expect(mockGetTodaysReadings).toHaveBeenCalledWith('user-1', 'America/Chicago', '2099-01-30');
  });

  it('turns every group reading into a reminder item for its date', async () => {
    mockGetTodaysReadings.mockImplementation(async (_user: string, _tz: string, date: string) =>
      date === '2099-03-05'
        ? [reading('group-a', "Guy's Life Group", ['Jeremiah 48']), reading('group-b', 'Psalms', ['Psalm 1-4', 'Proverbs 1'])]
        : []
    );

    const result = await getUpcomingReminders('user-1', 'UTC', new Date(2099, 2, 5), 2);

    expect(result).toEqual([
      { groupId: 'group-a', groupName: "Guy's Life Group", date: '2099-03-05', passages: ['Jeremiah 48'] },
      { groupId: 'group-b', groupName: 'Psalms', date: '2099-03-05', passages: ['Psalm 1-4', 'Proverbs 1'] },
    ]);
  });

  it('skips readings already marked complete (no reminder for something already read)', async () => {
    mockGetTodaysReadings.mockResolvedValue([
      reading('group-a', 'A', ['Genesis 1'], true),
      reading('group-b', 'B', ['Genesis 2'], false),
    ]);

    const result = await getUpcomingReminders('user-1', 'UTC', new Date(2099, 2, 5), 1);

    expect(result.map((r) => r.groupId)).toEqual(['group-b']);
  });

  it('skips groups with nothing to read on a date', async () => {
    mockGetTodaysReadings.mockResolvedValue([reading('group-a', 'A', [])]);

    const result = await getUpcomingReminders('user-1', 'UTC', new Date(2099, 2, 5), 1);

    expect(result).toEqual([]);
  });

  it('returns an empty list when the user has no readings at all', async () => {
    await expect(getUpcomingReminders('user-1', 'UTC', new Date(2099, 2, 5), 3)).resolves.toEqual([]);
  });

  it('rejects if any day fails to load, so a partial schedule never replaces a good one', async () => {
    mockGetTodaysReadings.mockImplementation(async (_u: string, _t: string, date: string) => {
      if (date === '2099-03-06') throw new Error('network request failed');
      return [reading('group-a', 'A', ['Genesis 1'])];
    });

    await expect(getUpcomingReminders('user-1', 'UTC', new Date(2099, 2, 5), 3)).rejects.toThrow(
      'network request failed'
    );
  });
});
