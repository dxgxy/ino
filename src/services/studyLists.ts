import type { WordCard } from '../domain/types';
import type { ReviewRecord } from './review';

export interface ListReviewSettings { dailyLimit: number; shortTarget: number; longRemoveAt: number; initialLong: number }
export interface UserList { id: string; name: string; cards: WordCard[]; origin: 'manual' | 'generated'; reviewSettings?: ListReviewSettings; archivedCards?: WordCard[] }
export interface LearningState { lists: UserList[]; reviewed: string[]; reviewRecords: ReviewRecord[] }
export interface StudyListService {
  create(name: string, cards?: WordCard[]): UserList;
  generate(name: string, cards: WordCard[], groupSize: number): UserList[];
}
const unique = (cards: WordCard[]) => [...new Map(cards.map(card => [card.content.toLowerCase(), card])).values()];
export const DEFAULT_REVIEW_SETTINGS: ListReviewSettings = { dailyLimit: 20, shortTarget: 3, longRemoveAt: 7, initialLong: 0 };

/** 保留用户选词顺序，生成过程不读取或修改持久化状态。 */
export const studyListService: StudyListService = {
  create(name, cards = []) {
    if (!name.trim()) throw new Error('请为 List 命名');
    return { id: crypto.randomUUID(), name: name.trim(), cards: unique(cards), origin: 'manual', reviewSettings: { ...DEFAULT_REVIEW_SETTINGS } };
  },
  generate(name, cards, groupSize) {
    if (!Number.isInteger(groupSize) || groupSize < 10 || groupSize > 30) throw new Error('每组应为 10–30 张');
    if (!cards.length) throw new Error('当前范围没有可生成的卡片');
    const result: UserList[] = [];
    const candidates = unique(cards);
    for (let offset = 0; offset < candidates.length; offset += groupSize) {
      result.push({ ...this.create(`${name} · ${result.length + 1}`, candidates.slice(offset, offset + groupSize)), origin: 'generated', reviewSettings: { ...DEFAULT_REVIEW_SETTINGS } });
    }
    return result;
  },
};

export const STORAGE_KEY = 'wordflow:user-lists:v1';

/** 无已保存数据时为空；损坏数据交由界面提示，不能静默覆盖原内容。 */
export function loadLearningState(storage: Pick<Storage, 'getItem'>, accountId?: string): LearningState {
  const raw = storage.getItem(accountId ? `${STORAGE_KEY}:${accountId}` : STORAGE_KEY);
  if (!raw) return { lists: [], reviewed: [], reviewRecords: [] };
  const value = JSON.parse(raw) as LearningState;
  if (!Array.isArray(value.lists) || !Array.isArray(value.reviewed) ||
      !value.reviewed.every(id => typeof id === 'string') ||
      !value.lists.every(list => typeof list.id === 'string' && typeof list.name === 'string' && Array.isArray(list.cards) &&
        list.cards.every(card => typeof card.id === 'string' && typeof card.content === 'string' && Array.isArray(card.tags)))) {
    throw new Error('已保存的学习数据无法读取，请备份后再恢复');
  }
  return { ...value, reviewRecords: Array.isArray(value.reviewRecords) ? value.reviewRecords : [] };
}

export function saveLearningState(storage: Pick<Storage, 'setItem'>, state: LearningState, accountId?: string): void {
  storage.setItem(accountId ? `${STORAGE_KEY}:${accountId}` : STORAGE_KEY, JSON.stringify(state));
}

/** 自动分组可排除用户已安排的词，但不会调整已有 List。 */
export function generationCandidates(cards: WordCard[], lists: UserList[], excludeAssigned: boolean): WordCard[] {
  const assigned = new Set(lists.flatMap(list => list.cards.map(card => card.content.toLowerCase())));
  return unique(cards).filter(card => !excludeAssigned || !assigned.has(card.content.toLowerCase()));
}
