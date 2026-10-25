/** 统一卡面模型：后续 A/B/C 卡面都通过 kind 区分。 */
export type CardKind = 'word' | 'sentence' | 'custom';
export interface WordCard { id: string; kind: CardKind; content: string; translation?: string; definition?: string; exchange?: string; source?: string; sourceUrl?: string; example?: string; audioUrl?: string; phonetic?: string; tags: string[]; updatedAt: string }
export interface ReviewEvent { cardId: string; rating: 0 | 1 | 2 | 3 | 4 | 5; reviewedAt: string; offline: boolean }
export interface StudyList { id: string; name: string; cardIds: string[]; source: 'book' | 'favorite'; }
