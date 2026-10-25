import type { WordCard } from '../domain/types';
import type { ListReviewSettings } from './studyLists';
export type ReviewScheme = 'meaning' | 'listening' | 'spelling' | 'translation';
export interface ReviewRecord {
  cardId: string; listId?: string; shortMark?: number; longMark?: number;
  shortDate?: string; longIncrementDate?: string; longDecayAt?: string;
  lastReviewedAt?: string; correct: number; wrong: number; attemptsToday?: number;
  dueAt: string; interval: number; ease: number; lapses: number; lastRating?: string;
}
export const schemes: { key: ReviewScheme; title: string; weight: number }[] = [
  { key: 'meaning', title: '隐藏含义', weight: 1 }, { key: 'listening', title: '只听发音', weight: 2 },
  { key: 'spelling', title: '含义拼写', weight: 3 }, { key: 'translation', title: '含义识词', weight: 2 },
];
const DAY = 86400000;
// Product mapping: start at the FSRS-4.5 Good initial stability (days), double per level.
export const BASE_STABILITY_DAYS = 3.7145;
export const stabilityDays = (level: number) => BASE_STABILITY_DAYS * Math.pow(2, Math.max(0, level - 1));
export const normalizeSpelling = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
export function dayKey(now: Date): string { return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
export function recordFor(records: ReviewRecord[], cardId: string, listId?: string): ReviewRecord {
  return records.find(r => r.cardId === cardId && r.listId === listId) ?? { cardId, listId, dueAt: '', interval: 0, ease: 2.5, lapses: 0, correct: 0, wrong: 0 };
}
/** FSRS-4.5 curve reaches R=.9 after S days. Discrete B->S mapping is a product policy, not full FSRS. */
export function decayLongMark(record: ReviewRecord, now = new Date()): ReviewRecord {
  let b = record.longMark ?? 0;
  let anchor = new Date(record.longDecayAt ?? record.lastReviewedAt ?? now.toISOString()).getTime();
  while (b > 0 && now.getTime() - anchor >= DAY * stabilityDays(b)) {
    anchor += DAY * stabilityDays(b); b -= 1;
  }
  return { ...record, longMark: b, longDecayAt: new Date(anchor).toISOString() };
}
/** Day rollover resets A to current B; no bonus is granted without an actual successful review. */
export function currentRecord(records: ReviewRecord[], cardId: string, listId: string, settings: ListReviewSettings, now = new Date()): ReviewRecord {
  const stored = recordFor(records, cardId, listId);
  const r = decayLongMark({ ...stored, longMark: stored.longMark ?? settings.initialLong }, now);
  const today = dayKey(now);
  return { ...r, shortMark: r.shortDate === today ? r.shortMark ?? settings.initialLong : r.longMark ?? settings.initialLong,
    longMark: r.longMark ?? settings.initialLong, shortDate: today,
    attemptsToday: r.shortDate === today ? r.attemptsToday ?? 0 : 0 };
}
export function putRecord(records: ReviewRecord[], record: ReviewRecord): ReviewRecord[] {
  return [...records.filter(r => r.cardId !== record.cardId || r.listId !== record.listId), record];
}
export function finishScheme(records: ReviewRecord[], listId: string, cardId: string, scheme: ReviewScheme, success: boolean, settings: ListReviewSettings, now = new Date()): ReviewRecord[] {
  const r = currentRecord(records, cardId, listId, settings, now);
  if ((r.attemptsToday ?? 0) >= settings.dailyLimit || r.longIncrementDate === dayKey(now)) return records;
  const a = success ? Math.min(settings.shortTarget, (r.shortMark ?? 0) + schemes.find(s => s.key === scheme)!.weight) : (r.shortMark ?? 0);
  const promote = success && a >= settings.shortTarget;
  return putRecord(records, { ...r, shortMark: a, longMark: (r.longMark ?? 0) + (promote ? 1 : 0),
    longIncrementDate: promote ? dayKey(now) : r.longIncrementDate,
    longDecayAt: success ? now.toISOString() : r.longDecayAt, lastReviewedAt: now.toISOString(),
    attemptsToday: (r.attemptsToday ?? 0) + 1, correct: r.correct + Number(success), wrong: r.wrong + Number(!success),
    lapses: r.lapses + Number(!success) });
}
export function pendingCards(cards: WordCard[], records: ReviewRecord[], listId: string, settings: ListReviewSettings, now = new Date()): WordCard[] {
  return cards.filter(c => { const r = currentRecord(records, c.id, listId, settings, now); return r.longIncrementDate !== dayKey(now) && (r.attemptsToday ?? 0) < settings.dailyLimit; });
}
