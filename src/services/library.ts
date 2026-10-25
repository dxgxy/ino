import type { WordCard } from '../domain/types';

export interface WordBook { id: string; name: string; cardIds: string[] }
export interface DictionaryLibrary {
  cards: WordCard[];
  books: WordBook[];
  metadata: { name: string; url: string; license: string; cardCount: number };
}
export interface LibraryService {
  load(): Promise<DictionaryLibrary>;
}

/** 本地词库只提供候选卡片，绝不在载入时建立用户 List。 */
export const libraryService: LibraryService = {
  async load() {
    const data = await import('../data/ecdict.json');
    return data.default as DictionaryLibrary;
  },
};
