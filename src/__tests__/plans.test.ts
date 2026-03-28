import { parsePlanText, parseDatelessPlanText, detectPlanFormat } from '../services/plans';

describe('parsePlanText', () => {
  it('parses tab-separated lines with M-D-YYYY dates', () => {
    const input = 'Genesis 1\t3-16-2026\nGenesis 2\t3-17-2026';
    const result = parsePlanText(input);
    expect(result).toEqual([
      { passage: 'Genesis 1', scheduled_date: '2026-03-16' },
      { passage: 'Genesis 2', scheduled_date: '2026-03-17' },
    ]);
  });

  it('parses lines with zero-padded M-D-YYYY dates', () => {
    const input = 'Psalm 1\t01-01-2026';
    const result = parsePlanText(input);
    expect(result).toEqual([{ passage: 'Psalm 1', scheduled_date: '2026-01-01' }]);
  });

  it('accepts lines already in YYYY-MM-DD format', () => {
    const input = 'Isaiah 53\t2026-04-01';
    const result = parsePlanText(input);
    expect(result).toEqual([{ passage: 'Isaiah 53', scheduled_date: '2026-04-01' }]);
  });

  it('returns null for a line missing the date tab', () => {
    const input = 'Genesis 1\nGenesis 2\t3-17-2026';
    expect(parsePlanText(input)).toBeNull();
  });

  it('returns null for an unparseable date', () => {
    const input = 'Genesis 1\tnot-a-date';
    expect(parsePlanText(input)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parsePlanText('')).toBeNull();
    expect(parsePlanText('   \n  ')).toBeNull();
  });

  it('handles passages with book name variations verbatim', () => {
    const input = 'I John 1\t3-16-2026\n1 John 2\t3-17-2026';
    const result = parsePlanText(input);
    expect(result![0].passage).toBe('I John 1');
    expect(result![1].passage).toBe('1 John 2');
  });

  it('handles passages with multiple readings (tab-separated passage)', () => {
    const input = 'Psalm 119:1-96\t3-16-2026';
    const result = parsePlanText(input);
    expect(result).toEqual([{ passage: 'Psalm 119:1-96', scheduled_date: '2026-03-16' }]);
  });

  it('trims whitespace from passages and dates', () => {
    const input = '  Genesis 1  \t  3-16-2026  ';
    const result = parsePlanText(input);
    expect(result).toEqual([{ passage: 'Genesis 1', scheduled_date: '2026-03-16' }]);
  });

  // Calendar date validation
  it('returns null for Feb 30 (invalid calendar date)', () => {
    expect(parsePlanText('Genesis 1\t2-30-2026')).toBeNull();
  });

  it('returns null for Apr 31 (invalid calendar date)', () => {
    expect(parsePlanText('Genesis 1\t4-31-2026')).toBeNull();
  });

  it('returns null for Feb 29 in a non-leap year', () => {
    expect(parsePlanText('Genesis 1\t2-29-2025')).toBeNull();
  });

  it('accepts Feb 29 in a leap year', () => {
    const result = parsePlanText('Genesis 1\t2-29-2028');
    expect(result).toEqual([{ passage: 'Genesis 1', scheduled_date: '2028-02-29' }]);
  });
});

describe('detectPlanFormat', () => {
  it('returns "dated" when all lines have tabs', () => {
    expect(detectPlanFormat('Genesis 1\t3-16-2026\nGenesis 2\t3-17-2026')).toBe('dated');
  });

  it('returns "dateless" when no lines have tabs', () => {
    expect(detectPlanFormat('Genesis 1\nGenesis 2\nGenesis 3')).toBe('dateless');
  });

  it('returns "mixed" when some lines have tabs and some do not', () => {
    expect(detectPlanFormat('Genesis 1\t3-16-2026\nGenesis 2')).toBe('mixed');
  });

  it('returns "dateless" for empty input', () => {
    expect(detectPlanFormat('')).toBe('dateless');
  });
});

describe('parseDatelessPlanText', () => {
  const START = '2026-03-21';

  it('assigns consecutive dates starting from startDate', () => {
    const result = parseDatelessPlanText('Genesis 1\nGenesis 2\nGenesis 3', START);
    expect(result).toEqual([
      { passage: 'Genesis 1', scheduled_date: '2026-03-21' },
      { passage: 'Genesis 2', scheduled_date: '2026-03-22' },
      { passage: 'Genesis 3', scheduled_date: '2026-03-23' },
    ]);
  });

  it('handles a single reading', () => {
    const result = parseDatelessPlanText('Psalm 1', START);
    expect(result).toEqual([{ passage: 'Psalm 1', scheduled_date: '2026-03-21' }]);
  });

  it('returns null for empty input', () => {
    expect(parseDatelessPlanText('', START)).toBeNull();
    expect(parseDatelessPlanText('   ', START)).toBeNull();
  });

  it('returns null for an invalid start date', () => {
    expect(parseDatelessPlanText('Genesis 1', 'not-a-date')).toBeNull();
  });

  it('correctly rolls over month boundaries', () => {
    const result = parseDatelessPlanText('Day 1\nDay 2', '2026-03-31');
    expect(result![1].scheduled_date).toBe('2026-04-01');
  });
});
