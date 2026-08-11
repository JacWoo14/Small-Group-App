/**
 * Unit tests for src/services/completions.ts
 *
 * markComplete and getTodaysReadings are tested here — both are new/changed
 * codepaths as of the swipeable-date-navigation diff (getTodaysReadings now
 * takes a `date` param; markComplete is reachable for past dates too).
 * getGroupCompletionsForDate is not covered — unchanged by that diff.
 */

// ─── Supabase client mock ─────────────────────────────────────────────────

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
    rpc: jest.fn(),
  },
}));

import { supabase } from '../services/supabase';
import { markComplete, getTodaysReadings } from '../services/completions';

const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ single: mockSingle });
});

// ─── markComplete ──────────────────────────────────────────────────────────

describe('markComplete', () => {
  it('inserts a completion row and returns the created record on success', async () => {
    const record = { id: 'c1', user_id: 'u1', group_id: 'g1', reading_date: '2026-07-18' };
    mockSingle.mockResolvedValue({ data: record, error: null });

    const result = await markComplete('u1', 'g1', '2026-07-18');

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      group_id: 'g1',
      reading_date: '2026-07-18',
    });
    expect(result).toEqual(record);
  });

  it('throws "Already completed" when the DB returns a unique-constraint violation (23505)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });

    await expect(markComplete('u1', 'g1', '2026-07-18')).rejects.toThrow('Already completed');
  });

  it('propagates other Postgres errors unchanged', async () => {
    const dbError = { code: '500', message: 'connection reset' };
    mockSingle.mockResolvedValue({ data: null, error: dbError });

    await expect(markComplete('u1', 'g1', '2026-07-18')).rejects.toEqual(dbError);
  });

  it('marks completion for a past date, not just today (retroactive completion)', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'c2' }, error: null });

    await markComplete('u1', 'g1', '2026-07-01');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ reading_date: '2026-07-01' })
    );
  });
});

// ─── getTodaysReadings ──────────────────────────────────────────────────────

const RPC_ROW = {
  group_id: 'g1',
  group_name: 'Morning Group',
  group_reading_plan_id: 'p1',
  group_start_date: '2026-01-01',
  group_invite_code: 'ABC123',
  group_created_by: 'u1',
  group_created_at: '2026-01-01T00:00:00Z',
  group_updated_at: '2026-01-01T00:00:00Z',
  plan_name: 'Bible in a Year',
  plan_total_days: 365,
  plan_is_public: true,
  plan_created_by: 'u1',
  plan_created_at: '2026-01-01T00:00:00Z',
  day_number: 5,
  passages: ['Genesis 5'],
  completed: true,
};

describe('getTodaysReadings', () => {
  it('forwards the date param to the RPC call', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getTodaysReadings('u1', 'America/Chicago', '2026-07-01');

    expect(mockRpc).toHaveBeenCalledWith('get_all_todays_readings', {
      user_uuid: 'u1',
      p_date: '2026-07-01',
    });
  });

  it('returns an empty array when the RPC returns no data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await getTodaysReadings('u1', 'UTC', '2026-07-18');

    expect(result).toEqual([]);
  });

  it('returns an empty array when the RPC returns an empty array', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await getTodaysReadings('u1', 'UTC', '2026-07-18');

    expect(result).toEqual([]);
  });

  it('throws when the RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC failed') });

    await expect(getTodaysReadings('u1', 'UTC', '2026-07-18')).rejects.toThrow('RPC failed');
  });

  it('maps a row into a TodayReading with completed coerced to a real boolean', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...RPC_ROW, completed: 1 }], error: null });

    const [reading] = await getTodaysReadings('u1', 'UTC', '2026-07-18');

    expect(reading.completed).toBe(true);
    expect(reading.group.id).toBe('g1');
    expect(reading.group.reading_plan?.name).toBe('Bible in a Year');
    expect(reading.day_number).toBe(5);
    expect(reading.passages).toEqual(['Genesis 5']);
  });

  it('falls back plan_created_at to an empty string when null', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...RPC_ROW, plan_created_at: null }], error: null });

    const [reading] = await getTodaysReadings('u1', 'UTC', '2026-07-18');

    expect(reading.group.reading_plan?.created_at).toBe('');
  });

  it('falls back day_number to null when missing', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...RPC_ROW, day_number: undefined }], error: null });

    const [reading] = await getTodaysReadings('u1', 'UTC', '2026-07-18');

    expect(reading.day_number).toBeNull();
  });

  it('defaults passages to an empty array when null/non-array', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...RPC_ROW, passages: null }], error: null });

    const [reading] = await getTodaysReadings('u1', 'UTC', '2026-07-18');

    expect(reading.passages).toEqual([]);
  });
});
