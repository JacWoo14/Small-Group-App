import { NEW_TESTAMENT, OLD_TESTAMENT } from '../constants/bible';
import { generatePlan, newTestamentOrder, toUnits, PlanOptions } from '../utils/planGenerator';

const chapters = (books: typeof OLD_TESTAMENT) => books.reduce((n, b) => n + b.verses.length, 0);
const verses = (books: typeof OLD_TESTAMENT) =>
  books.reduce((n, b) => n + b.verses.reduce((a, v) => a + v, 0), 0);

const base: PlanOptions = { content: 'bible', daysPerWeek: 6, chaptersPerDay: 4, startDate: '2027-01-04' };

describe('bible data', () => {
  it('has the standard book, chapter and verse totals', () => {
    expect([OLD_TESTAMENT.length, NEW_TESTAMENT.length]).toEqual([39, 27]);
    expect([chapters(OLD_TESTAMENT), chapters(NEW_TESTAMENT)]).toEqual([929, 260]);
    expect([verses(OLD_TESTAMENT), verses(NEW_TESTAMENT)]).toEqual([23145, 7957]);
  });
});

describe('toUnits', () => {
  const units = toUnits([...OLD_TESTAMENT, ...NEW_TESTAMENT]);

  it('applies 8 joins and 9 splits without losing verses', () => {
    expect(units.length).toBe(1189 - 8 + 9);
    expect(units.reduce((n, u) => n + u.verses, 0)).toBe(31102);
  });

  it('joins short chapters and splits long ones', () => {
    const refs = units.map((u) => u.passages.join(' + '));
    expect(refs).toContain('Psalm 133 + Psalm 134');
    expect(refs).toContain('Psalm 119:1-88');
    expect(refs).toContain('Psalm 119:89-176');
    expect(refs).toContain('2 John 1');
  });
});

describe('newTestamentOrder', () => {
  it('keeps every book and opens each quarter with a Gospel', () => {
    const order = newTestamentOrder();
    expect(order.length).toBe(27);

    let before = 0;
    const gospelStarts: number[] = [];
    for (const book of order) {
      if (['Matthew', 'Mark', 'Luke', 'John'].includes(book.name)) gospelStarts.push(before);
      before += book.verses.length;
    }
    gospelStarts.forEach((start, q) => expect(Math.abs(start - q * 65)).toBeLessThanOrEqual(12));
  });
});

describe('generatePlan', () => {
  it('only adds content when a repeat is chosen', () => {
    const count = (options: Partial<PlanOptions>) =>
      generatePlan({ ...base, ...options }).readings.flatMap((r) => r.passages).length;

    // The same reading at any pace
    expect(count({ chaptersPerDay: 1 })).toBe(count({ chaptersPerDay: 4 }));
    expect(count({ repeats: ['proverbs'] })).toBe(count({}) + 31);
    expect(count({ repeats: ['newTestament'] })).toBe(count({}) + 260);
  });

  it('finishes sooner with more chapters a day', () => {
    const days = (chaptersPerDay: number) => generatePlan({ ...base, chaptersPerDay }).readings.length;
    expect([days(1), days(2), days(4)]).toEqual([1190, 595, 298]);
  });

  it('ignores repeats for content the plan does not include', () => {
    const plain = generatePlan({ ...base, content: 'new' });
    expect(generatePlan({ ...base, content: 'new', repeats: ['psalms'] })).toEqual(plain);
  });

  it('schedules no weekend readings on a 5-day plan, starting on the next weekday', () => {
    // 2027-01-02 is a Saturday
    const plan = generatePlan({ ...base, daysPerWeek: 5, startDate: '2027-01-02' });
    expect(plan.readings[0].scheduled_date).toBe('2027-01-04');
    const weekdays = plan.readings.map((r) => new Date(`${r.scheduled_date}T12:00:00`).getDay());
    expect(weekdays.filter((d) => d === 0 || d === 6)).toEqual([]);
  });

  it('spreads New Testament days across the whole plan', () => {
    const nt = new Set(NEW_TESTAMENT.map((b) => b.name));
    const isNewDay = (p: string[]) => p.some((ref) => nt.has(ref.replace(/ \d+(:.*)?$/, '')));
    const flags = generatePlan(base).readings.map((r) => isNewDay(r.passages));
    const longestOldRun = flags.join(',').split('true').map((run) => run.split('false').length - 1);
    expect(Math.max(...longestOldRun)).toBeLessThanOrEqual(5);
    expect(flags.slice(-10)).toContain(true);
  });

  it('mixes both testaments within a day when there is more than one chapter', () => {
    const nt = new Set(NEW_TESTAMENT.map((b) => b.name));
    const isNew = (p: string) => nt.has(p.replace(/ \d+(:.*)?$/, ''));
    const [first] = generatePlan(base).readings;
    expect(first.passages.some(isNew)).toBe(true);
    expect(first.passages.every(isNew)).toBe(false);
  });

  it('rejects a chapters-per-day value outside 1 to 10', () => {
    expect(() => generatePlan({ ...base, chaptersPerDay: 0 })).toThrow();
    expect(() => generatePlan({ ...base, chaptersPerDay: 11 })).toThrow();
    expect(() => generatePlan({ ...base, chaptersPerDay: 10 })).not.toThrow();
  });
});
