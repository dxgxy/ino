import { WordCard } from '../domain/types';

export interface DictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }>;
}

/** 查询公开英文词典，并将首个词条转换成可直接导入的 A 类单词卡。 */
export async function lookupWord(word: string): Promise<WordCard> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) throw new Error('请输入要查询的单词');
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`没有找到 “${normalized}” 的词典结果`);
  const entries = (await response.json()) as DictionaryResponse[];
  const entry = entries[0];
  if (!entry) throw new Error('词典未返回有效词条');
  const firstMeaning = entry.meanings?.[0]?.definitions?.[0];
  const audio = entry.phonetics?.find(item => item.audio)?.audio?.replace(/^\/\//, 'https://');
  return {
    id: `dict-${normalized}-${Date.now()}`,
    kind: 'word',
    content: entry.word || normalized,
    definition: firstMeaning?.definition,
    source: 'Free Dictionary API',
    example: firstMeaning?.example,
    audioUrl: audio,
    tags: ['公开词典导入'],
    updatedAt: new Date().toISOString(),
    phonetic: entry.phonetic || entry.phonetics?.find(item => item.text)?.text,
  };
}
