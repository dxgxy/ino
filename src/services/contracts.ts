import type { ReviewEvent, StudyList, WordCard } from '../domain/types';

/** 服务端/本地实现都必须遵循的复习接口。 */
export interface ReviewService { getDueCards(userId: string): Promise<WordCard[]>; submitReview(event: ReviewEvent): Promise<void>; }
/** 关键词先本地过滤，联网后可替换为语义检索。 */
export interface SearchService { search(query: string, scope: 'local' | 'server'): Promise<WordCard[]>; }
/** 文本、外刊选段和词书文件都汇聚到同一个导入契约。 */
export interface ImportService { importText(text: string): Promise<WordCard[]>; importBook(file: File): Promise<WordCard[]>; }
/** 后续同步、社区与商业化模块使用同样的依赖注入方式。 */
export interface SyncService { push(): Promise<void>; pull(): Promise<void>; }
export interface CommunityService { getProfile(userId: string): Promise<{ nickname: string; level: number; pet?: string }>; }
export interface BillingService { createGoal(goal: { name: string; targetDate: string }): Promise<{ id: string }>; }
export interface ListService { createList(input: Omit<StudyList, 'id'>): Promise<StudyList>; }
