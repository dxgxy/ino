import { useMemo, useState } from 'react';
import type { WordCard } from '../../domain/types';
import type { DictionaryLibrary } from '../../services/library';
import { generationCandidates, studyListService, type UserList } from '../../services/studyLists';

interface Props {
  library: DictionaryLibrary | null;
  lists: UserList[];
  onCreate: (lists: UserList[]) => void;
  onAdd: (listId: string, cards: WordCard[]) => void;
  notify: (message: string) => void;
}

/** 资料库只供选词；手选加入或确认分组才会写入用户学习空间。 */
export function LibraryPanel({ library, lists, onCreate, onAdd, notify }: Props) {
  const [bookId, setBookId] = useState('common');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [page, setPage] = useState(0);
  const [name, setName] = useState('我的学习计划');
  const [start, setStart] = useState(1);
  const [amount, setAmount] = useState(40);
  const [groupSize, setGroupSize] = useState(20);
  const [excludeAssigned, setExcludeAssigned] = useState(true);
  const cardIndex = useMemo(() => new Map(library?.cards.map(card => [card.id, card])), [library]);
  const book = library?.books.find(item => item.id === bookId);
  const bookCards = useMemo(() => (book?.cardIds ?? []).map(id => cardIndex.get(id)).filter((card): card is WordCard => !!card), [book, cardIndex]);
  const matching = useMemo(() => bookCards.filter(card => `${card.content} ${card.translation}`.toLowerCase().includes(query.toLowerCase())), [bookCards, query]);
  const eligible = useMemo(() => generationCandidates(bookCards, lists, excludeAssigned), [bookCards, lists, excludeAssigned]);
  const validRange = Number.isInteger(start) && start >= 1 && Number.isInteger(amount) && amount > 0 && Number.isInteger(groupSize) && groupSize >= 10 && groupSize <= 30;
  const preview = validRange ? eligible.slice(start - 1, start - 1 + amount) : [];
  if (!library) return <section className="panel">正在载入离线词典…</section>;

  const addSelected = () => {
    const cards = selected.map(id => cardIndex.get(id)).filter((card): card is WordCard => !!card);
    if (target) { onAdd(target, cards); setSelected([]); }
    else if (name.trim()) { onCreate([studyListService.create(name, cards)]); setSelected([]); }
  };

  return <section className="library-panel">
    <div className="library-intro"><p className="eyebrow">内容资料库 · 离线可用</p><h2>选什么，怎么学，由你决定</h2>
      <p>已内置 {library.metadata.cardCount.toLocaleString()} 个去重词条。词书之间可能重合，词条不会自动加入你的 List。</p>
      <a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noreferrer">来源 ECDICT · MIT 许可</a>
    </div>
    <div className="library-controls"><label>词书<select value={bookId} onChange={e => { setBookId(e.target.value); setPage(0); setSelected([]); }}>
      {library.books.map(item => <option key={item.id} value={item.id}>{item.name} · {item.cardIds.length} 词</option>)}</select></label>
      <label>筛选词条<input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="英文单词或中文释义" /></label>
    </div>
    <div className="library-columns"><section className="panel">
      <h3>手动选词 <small>{matching.length} 条</small></h3>
      <div className="library-results">{matching.slice(page * 30, (page + 1) * 30).map(card => <label key={card.id} className="candidate-row">
        <input type="checkbox" checked={selected.includes(card.id)} onChange={e => setSelected(current => e.target.checked ? [...current, card.id] : current.filter(id => id !== card.id))}/>
        <span><strong>{card.content}</strong><small>{card.translation}</small></span>
      </label>)}</div>
      <div className="pagination"><button className="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</button>
        <span>{page + 1} / {Math.max(1, Math.ceil(matching.length / 30))}</span>
        <button className="ghost" disabled={(page + 1) * 30 >= matching.length} onClick={() => setPage(page + 1)}>下一页</button></div>
      <label>加入哪里<select value={target} onChange={e => setTarget(e.target.value)}><option value="">创建新的 List</option>{lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
      {!target && <label>新 List 名称<input value={name} onChange={e => setName(e.target.value)}/></label>}
      <button className="primary" disabled={!selected.length || (!target && !name.trim())} onClick={addSelected}>将已选 {selected.length} 词加入 List</button>
    </section><section className="panel generation-panel">
      <h3>按你的规则自动分组</h3><p>当前词书按词频排序。先检查范围，再确认生成；已有 List 保持原样。</p>
      <label>List 名称前缀<input value={name} onChange={e => setName(e.target.value)}/></label>
      <label className="check-label"><input type="checkbox" checked={excludeAssigned} onChange={e => setExcludeAssigned(e.target.checked)}/> 排除已安排到其他 List 的词</label>
      <p>当前可选 {eligible.length} 词</p>
      <label>从第几个候选词开始<input type="number" min="1" max={Math.max(1, eligible.length)} value={start} onChange={e => setStart(Number(e.target.value))}/></label>
      <label>本次取词数量<input type="number" min="1" max={eligible.length} value={amount} onChange={e => setAmount(Number(e.target.value))}/></label>
      <label>每组词数（10–30）<input type="number" min="10" max="30" value={groupSize} onChange={e => setGroupSize(Number(e.target.value))}/></label>
      <div className="generation-preview"><strong>生成预览</strong><p>{validRange ? `${preview.length} 张卡片 → ${Math.ceil(preview.length / groupSize)} 个 List` : '请填写有效范围，每组 10–30 词'}</p>
        <p>{preview.slice(0, 10).map(card => card.content).join(' · ')}</p>
        {preview.length > 0 && preview.length % groupSize !== 0 && <small>最后一组保留余下 {preview.length % groupSize} 词。</small>}
      </div>
      <button className="primary" disabled={!preview.length || !name.trim()} onClick={() => {
        try { onCreate(studyListService.generate(name.trim(), preview, groupSize)); }
        catch (error) { notify(error instanceof Error ? error.message : '生成失败'); }
      }}>确认生成 {preview.length ? Math.ceil(preview.length / groupSize) : 0} 个 List</button>
    </section></div>
  </section>;
}
