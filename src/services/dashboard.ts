import type { WordCard } from '../domain/types';
import { currentRecord, dayKey, pendingCards, type ReviewRecord } from './review';
import { DEFAULT_REVIEW_SETTINGS, type UserList } from './studyLists';

/** One shared registry drives module search and future navigation entries. */
export type AppView = 'home' | 'lists' | 'library' | 'account' | 'review' | 'settings' | 'extensions';
export interface AppModule { id: string; title: string; description: string; keywords: string[]; view: AppView; enabled: boolean }
export const appModules: readonly AppModule[] = [
  { id: 'home', title: '学习首页', description: 'List进度、今日简报与复习规划', keywords: ['home', 'summary', '总结', '计划'], view: 'home', enabled: true },
  { id: 'lists', title: '我的 List', description: '创建、选词、自动分组和管理卡片', keywords: ['list', 'create', '新建', '分组', '卡片'], view: 'lists', enabled: true },
  { id: 'dictionary', title: '离线词典与词书', description: '英汉双语查询与内置词书', keywords: ['dictionary', 'book', '词库', '翻译', '查词'], view: 'library', enabled: true },
  { id: 'review', title: '四种方案复习', description: '隐藏含义、听音、拼写、含义识词', keywords: ['review', 'spelling', 'listen', '复习', '听力', '发音'], view: 'review', enabled: true },
  { id: 'account', title: '个人账号', description: '登录、注册、头像配色和账号验证', keywords: ['login', 'register', '账号', '头像', '等级', '昵称'], view: 'account', enabled: true },
  { id: 'settings', title: '学习设置', description: '当前 List 的复习参数与本机数据说明', keywords: ['settings', '设置', '巩固度', '记忆度', '目标'], view: 'settings', enabled: true },
];
export function searchModules(query: string) {
  const value = query.trim().toLowerCase();
  return value ? appModules.filter(m => m.enabled && `${m.title} ${m.description} ${m.keywords.join(' ')}`.toLowerCase().includes(value)) : [];
}
/** Rank exact/prefix English before substring matches; Chinese definitions are equally searchable offline. */
export function searchOffline(cards: WordCard[], query: string): WordCard[] {
  const value = query.trim().toLowerCase();
  if (!value) return [];
  return cards.map(card => ({ card, score: card.content.toLowerCase() === value ? 0 : card.content.toLowerCase().startsWith(value) ? 1 : 2 }))
    .filter(({ card }) => `${card.content} ${card.translation ?? ''} ${card.definition ?? ''}`.toLowerCase().includes(value))
    .sort((a, b) => a.score - b.score).slice(0, 12).map(item => item.card);
}
/** Derive summaries from actual local records. Hitting the attempt cap is not counted as completion. */
export function dashboardSummary(lists: UserList[], records: ReviewRecord[], now = new Date()) {
  const today = dayKey(now);
  const all = lists.flatMap(list => [...list.cards, ...(list.archivedCards ?? [])].map(card => ({ list, card })));
  const progress = lists.map(list => {
    const settings = { ...DEFAULT_REVIEW_SETTINGS, ...list.reviewSettings };
    const counts = list.cards.map(c => currentRecord(records, c.id, list.id, settings, now));
    const done = counts.filter(r => r.longIncrementDate === today).length;
    const started = counts.filter(r => (r.attemptsToday ?? 0) > 0).length;
    const capped = counts.filter(r => r.longIncrementDate !== today && (r.attemptsToday ?? 0) >= settings.dailyLimit).length;
    const due = pendingCards(list.cards, records, list.id, settings, now).length;
    const weakened = counts.filter(r => r.longMark! < (records.find(old => old.cardId === r.cardId && old.listId === list.id)?.longMark ?? 0)).length;
    return { list, done, started, capped, due, weakened, percent: list.cards.length ? Math.round(done / list.cards.length * 100) : 0 };
  });
  const active = all.map(({ list, card }) => currentRecord(records, card.id, list.id, { ...DEFAULT_REVIEW_SETTINGS, ...list.reviewSettings }, now));
  const completed = active.filter(r => r.longIncrementDate === today).length;
  const practiced = active.filter(r => (r.attemptsToday ?? 0) > 0).length;
  const correct = active.reduce((sum, r) => sum + (r.correctToday ?? 0), 0);
  const wrong = active.reduce((sum, r) => sum + (r.wrongToday ?? 0), 0);
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now); date.setDate(date.getDate() + offset);
    return { date: dayKey(date), lists: lists.map(list => ({ id: list.id, name: list.name, due: pendingCards(list.cards, records, list.id, { ...DEFAULT_REVIEW_SETTINGS, ...list.reviewSettings }, date).length })) };
  });
  return { progress, completed, practiced, correct, wrong, due: progress.reduce((sum, p) => sum + p.due, 0), days,
    level: 1 + Math.floor(records.reduce((sum, r) => sum + Math.max(0, r.correct), 0) / 50) };
}
