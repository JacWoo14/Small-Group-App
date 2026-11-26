import { addDays, format, parseISO } from 'date-fns';
import {
  BibleBook,
  JOINED_CHAPTERS,
  NEW_TESTAMENT,
  OLD_TESTAMENT,
  SPLIT_CHAPTERS,
} from '../constants/bible';

export type PlanContent = 'bible' | 'old' | 'new';

export interface PlanOptions {
  content: PlanContent;
  daysPerWeek: 5 | 6 | 7; // 5 = Mon–Fri, 6 = Mon–Sat
  chaptersPerDay: number;
  startDate: string; // YYYY-MM-DD
  repeats?: Repeat[]; // content to read twice
}

export type Repeat = 'newTestament' | 'psalms' | 'proverbs';

/** One "chapter" of a plan: usually a single chapter, sometimes a pair or a half. */
export interface ReadingUnit {
  passages: string[];
  verses: number;
}

export interface GeneratedPlan {
  endDate: string;
  readings: { scheduled_date: string; day_number: number; passages: string[]; verses: number }[];
}

export const MAX_CHAPTERS_PER_DAY = 10;

const GOSPELS = ['Matthew', 'Mark', 'Luke', 'John'];

export function toUnits(books: BibleBook[]): ReadingUnit[] {
  const units: ReadingUnit[] = [];
  for (const { name, verses } of books) {
    for (let chapter = 1; chapter <= verses.length; chapter++) {
      const count = verses[chapter - 1];
      const ref = `${name} ${chapter}`;
      const join = JOINED_CHAPTERS.find((j) => j.book === name && j.chapters[0] === chapter);
      const splitAt = SPLIT_CHAPTERS[ref];

      if (join) {
        units.push({ passages: [ref, `${name} ${chapter + 1}`], verses: count + verses[chapter] });
        chapter++;
      } else if (splitAt) {
        units.push({ passages: [`${ref}:1-${splitAt}`], verses: splitAt });
        units.push({ passages: [`${ref}:${splitAt + 1}-${count}`], verses: count - splitAt });
      } else {
        units.push({ passages: [ref], verses: count });
      }
    }
  }
  return units;
}

/**
 * Merges sequences so each is spread evenly across the whole result while
 * keeping its own order, and all of them finish at about the same time.
 */
export function spreadEvenly<T>(sequences: T[][]): T[] {
  return sequences
    .flatMap((seq, s) => seq.map((item, i) => ({ item, s, position: (i + 0.5) / seq.length })))
    .sort((a, b) => a.position - b.position || a.s - b.s)
    .map((entry) => entry.item);
}

/**
 * New Testament reading order with one Gospel opening each quarter. The other
 * books stay in canonical order and fill each quarter to about 65 chapters.
 */
export function newTestamentOrder(): BibleBook[] {
  const gospels = NEW_TESTAMENT.filter((b) => GOSPELS.includes(b.name));
  const others = NEW_TESTAMENT.filter((b) => !GOSPELS.includes(b.name));
  const quarter = NEW_TESTAMENT.reduce((n, b) => n + b.verses.length, 0) / 4;

  const order: BibleBook[] = [];
  let chapters = 0;
  gospels.forEach((gospel, q) => {
    order.push(gospel);
    chapters += gospel.verses.length;
    // A book joins this quarter if at least half of it fits; the last takes the rest.
    while (others.length && (q === 3 || chapters + others[0].verses.length / 2 <= quarter * (q + 1))) {
      chapters += others[0].verses.length;
      order.push(others.shift()!);
    }
  });
  return order;
}

function repeat<T>(items: T[], times: number): T[] {
  return Array.from({ length: times }, () => items).flat();
}

/** The Old and New Testament reading sequences. */
function buildTracks(content: PlanContent, repeats: Repeat[]): ReadingUnit[][] {
  const times = (key: Repeat) => (repeats.includes(key) ? 2 : 1);
  const tracks: ReadingUnit[][] = [];

  if (content !== 'new') {
    const only = (name: string) => toUnits(OLD_TESTAMENT.filter((b) => b.name === name));
    const rest = toUnits(OLD_TESTAMENT.filter((b) => b.name !== 'Psalm' && b.name !== 'Proverbs'));
    tracks.push(
      spreadEvenly([rest, repeat(only('Psalm'), times('psalms')), repeat(only('Proverbs'), times('proverbs'))])
    );
  }

  if (content !== 'old') {
    tracks.push(repeat(toUnits(newTestamentOrder()), times('newTestament')));
  }

  return tracks;
}

/**
 * Mixes the tracks in proportion, then cuts the result into days. At one
 * chapter a day the testaments take turns; with more, a day may hold both.
 */
function buildDays(tracks: ReadingUnit[][], perDay: number): ReadingUnit[][] {
  const units = spreadEvenly(tracks);
  const days: ReadingUnit[][] = [];
  for (let i = 0; i < units.length; i += perDay) days.push(units.slice(i, i + perDay));
  return days;
}

function readingDates(startDate: string, daysPerWeek: number, count: number): string[] {
  const dates: string[] = [];
  for (let date = parseISO(startDate); dates.length < count; date = addDays(date, 1)) {
    const weekday = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isRestDay = (daysPerWeek < 7 && weekday === 0) || (daysPerWeek < 6 && weekday === 6);
    if (!isRestDay) dates.push(format(date, 'yyyy-MM-dd'));
  }
  return dates;
}

/**
 * Builds a plan from the user's commitment. The length follows from the amount
 * of content and the pace; content is only read twice when asked for.
 */
export function generatePlan(options: PlanOptions): GeneratedPlan {
  const { content, daysPerWeek, chaptersPerDay, startDate, repeats = [] } = options;
  if (!Number.isInteger(chaptersPerDay) || chaptersPerDay < 1 || chaptersPerDay > MAX_CHAPTERS_PER_DAY) {
    throw new Error(`Chapters per day must be a whole number from 1 to ${MAX_CHAPTERS_PER_DAY}`);
  }

  const days = buildDays(buildTracks(content, repeats), chaptersPerDay);
  const dates = readingDates(startDate, daysPerWeek, days.length);
  return {
    endDate: dates[dates.length - 1],
    readings: days.map((units, i) => ({
      scheduled_date: dates[i],
      day_number: i + 1,
      passages: units.flatMap((u) => u.passages),
      verses: units.reduce((n, u) => n + u.verses, 0),
    })),
  };
}
