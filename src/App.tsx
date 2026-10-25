import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Check, Folder, FolderPlus, ListChecks, PanelLeftClose, PanelLeftOpen, Plus, Search, Trash2, Volume2, X } from 'lucide-react';
import type { WordCard } from './domain/types';
import { libraryService, type DictionaryLibrary } from './services/library';
import { loadLearningState, saveLearningState, studyListService, type UserList } from './services/studyLists';
import { lookupWord } from './services/dictionary';
import { speak } from './services/pronunciation';
import { LibraryPanel } from './features/lists/LibraryPanel';
import { AccountPanel } from './features/account/AccountPanel';
import { useAccount, type AccountController } from './features/account/useAccount';
import { ReviewPanel } from './features/review/ReviewPanel';
import { currentRecord, putRecord, finishScheme, type ReviewScheme } from './services/review';
import { DEFAULT_REVIEW_SETTINGS, type ListReviewSettings } from './services/studyLists';
import { ListSettings } from './features/review/ListSettings';
import type { AppView } from './services/dashboard';
import { AndroidBottomNav, HomeDashboard } from './features/home/HomeDashboard';

export default function App() {
  const auth = useAccount();
  if (auth.status === 'checking') return <div className="session-loading" role="status">正在检查登录状态，本地学习空间即将打开…</div>;
  return <Workspace key={auth.user?.id ?? 'guest'} auth={auth}/>;
}

/** 账号变化时重建工作区，防止把访客或其他账号的学习内容写入当前分区。 */
function Workspace({ auth }: { auth: AccountController }) {
  const accountId = auth.user?.id;
  const [initial] = useState(() => {
    try { return { data: loadLearningState(localStorage, accountId), error: '' }; }
    catch (error) { return { data: { lists: [], reviewed: [], reviewRecords: [] }, error: String(error) }; }
  });
  const [data, setData] = useState(initial.data);
  const { lists, reviewed } = data;
  const [activeId, setActiveId] = useState(lists[0]?.id ?? '');
  const [selectedId, setSelectedId] = useState('');
  const [listRailCollapsed, setListRailCollapsed] = useState(false);
  const [view, setView] = useState<AppView>('home');
  const [library, setLibrary] = useState<DictionaryLibrary | null>(null);
  const [libraryError, setLibraryError] = useState('');
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [importWord, setImportWord] = useState('');
  const [importing, setImporting] = useState(false);
  const active = lists.find(list => list.id === activeId) ?? lists[0];
  const settings = { ...DEFAULT_REVIEW_SETTINGS, ...active?.reviewSettings };
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(timer); }, []);
  const selectedRecord = active && (active.cards.find(card => card.id === selectedId) ?? active.cards[0]);
  const marks = active && selectedRecord ? currentRecord(data.reviewRecords, selectedRecord.id, active.id, settings, clock) : undefined;
  const navigate = (next: AppView) => { setView(next); if (next === 'lists' || next === 'review') setShowCreate(false); };
  const updateSettings = (value: ListReviewSettings) => active && setData(current => ({ ...current, lists: current.lists.map(l => l.id === active.id ? { ...l, reviewSettings: value } : l) }));
  const reviewResult = (cardId: string, scheme: ReviewScheme, success: boolean) => {
    if (!active) return;
    setData(current => {
      const reviewRecords = finishScheme(current.reviewRecords, active.id, cardId, scheme, success, settings);
      const r = currentRecord(reviewRecords, cardId, active.id, settings);
      return { ...current, reviewRecords, reviewed: success ? [...new Set([...current.reviewed, cardId])] : current.reviewed,
        lists: current.lists.map(l => l.id === active.id && (r.longMark ?? 0) >= settings.longRemoveAt ? { ...l, cards: l.cards.filter(c => c.id !== cardId), archivedCards: [...(l.archivedCards ?? []), ...l.cards.filter(c => c.id === cardId)] } : l) };
    });
  };
  const editLongMark = (cardId: string, b: number) => {
    if (!active || !Number.isInteger(b) || b < 0 || b > 50) return;
    setData(current => { const r = currentRecord(current.reviewRecords, cardId, active.id, settings); return { ...current,
      reviewRecords: putRecord(current.reviewRecords, { ...r, longMark: b, shortMark: b, longDecayAt: new Date().toISOString() }),
      lists: current.lists.map(l => l.id === active.id && b >= settings.longRemoveAt ? { ...l, cards: l.cards.filter(c => c.id !== cardId), archivedCards: [...(l.archivedCards ?? []), ...l.cards.filter(c => c.id === cardId)] } : l) }; });
  };
  const selected = active?.cards.find(card => card.id === selectedId) ?? active?.cards[0];
  const filtered = useMemo(() => (active?.cards ?? []).filter(card => `${card.content} ${card.translation}`.toLowerCase().includes(query.toLowerCase())), [active, query]);
  const selectedIndex = selected ? filtered.findIndex(card => card.id === selected.id) : -1;
  /** 点击当前详情卡片后进入当前筛选结果中的下一张，末张后回到首张。 */
  const advanceCard = () => {
    if (!filtered.length) return;
    const nextIndex = selectedIndex >= 0 ? (selectedIndex + 1) % filtered.length : 0;
    setSelectedId(filtered[nextIndex].id);
  };

  useEffect(() => {
    libraryService.load().then(setLibrary).catch(() => setLibraryError('离线词典载入失败，请重新打开应用。已有 List 仍可使用。'));
  }, []);
  useEffect(() => {
    if (initial.error) return;
    try { saveLearningState(localStorage, data, accountId); setStorageError(''); }
    catch { setStorageError('本地保存失败，当前变更仅保存在内存，请勿关闭应用。'); }
  }, [data, initial.error, accountId]);

  const createLists = (created: UserList[]) => {
    setData(current => ({ ...current, lists: [...current.lists, ...created] }));
    setActiveId(created[0].id); setSelectedId(''); setView('lists'); setShowCreate(false); setName('');
    setMessage(`已创建 ${created.length} 个 List，可继续重命名和调整顺序。`);
  };
  const addCards = (id: string, cards: WordCard[]) => {
    setData(current => ({ ...current, lists: current.lists.map(list => list.id === id
      ? { ...list, cards: [...new Map([...list.cards, ...cards].map(card => [card.content.toLowerCase(), card])).values()] } : list) }));
    setActiveId(id); setSelectedId(cards[0]?.id ?? ''); setView('lists');
    setMessage('选中的词已加入，重复单词会自动合并。');
  };
  const moveList = (index: number, delta: number) => {
    setData(current => {
      const reordered = [...current.lists];
      [reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
      return { ...current, lists: reordered };
    });
  };
  const play = (card: WordCard) => { speak(card).catch(error => setMessage(String(error))); };
  const importCard = async () => {
    if (!active || importing || !importWord.trim()) return;
    const target = active.id;
    setImporting(true); setMessage('');
    try {
      // 刷新后词典分包可能尚在载入，必须等本地查询结束才尝试联网。
      const dictionary = library ?? await libraryService.load();
      const local = dictionary.cards.find(card => card.content.toLowerCase() === importWord.trim().toLowerCase());
      const card = local ?? await lookupWord(importWord);
      addCards(target, [card]); setImportWord('');
    } catch (error) { setMessage(error instanceof Error ? error.message : '查词失败'); }
    finally { setImporting(false); }
  };

  return <div className={`shell ${listRailCollapsed ? 'shell-list-collapsed' : ''} ${view === 'home' ? 'shell-home' : ''}`}>
    <aside className="sidebar list-sidebar">
      <div className="brand"><div className="brand-mark">知</div><div className="brand-copy"><strong>xx大人</strong><span>WordFlow</span></div><button className="rail-toggle" title={listRailCollapsed ? '展开 List 栏' : '收起 List 栏'} aria-label={listRailCollapsed ? '展开 List 栏' : '收起 List 栏'} onClick={() => setListRailCollapsed(value => !value)}>{listRailCollapsed ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}</button></div>
      <div className="list-title"><span>我的 List · {lists.length}</span><button className="mini-icon" title="新建 List" onClick={() => { setView('lists'); setShowCreate(true); }}><FolderPlus size={17}/></button></div>
      <nav className="list-nav">{lists.map((list, index) => <div className="user-list-item" key={list.id}>
        <button className={view === 'lists' && active?.id === list.id ? 'list-nav-item active' : 'list-nav-item'} onClick={() => { setActiveId(list.id); setView('lists'); setSelectedId(''); setQuery(''); }}>
          <span className="list-dot green"><Folder size={15}/></span><span className="list-copy"><strong>{list.name}</strong><small>{list.cards.length} 词 · {list.origin === 'generated' ? '按我的规则生成' : '手动整理'}</small></span>
        </button><div className="list-order"><button title="上移 List" disabled={!index} onClick={() => moveList(index, -1)}><ArrowUp size={12}/></button><button title="下移 List" disabled={index === lists.length - 1} onClick={() => moveList(index, 1)}><ArrowDown size={12}/></button></div>
      </div>)}</nav>
      {!lists.length && <p className="sidebar-empty">还没有 List<br/>按你的节奏，从零开始。</p>}
      <div className="sidebar-links"><button className="nav-item" onClick={() => { setView('review'); setShowCreate(false); }}><Check size={17}/><span>今日复习 {active?.cards.length ? `· ${active.cards.length}` : ''}</span></button><button className="nav-item" onClick={() => { setView('library'); setShowCreate(false); }}><BookOpen size={17}/><span>词典与词书资料库</span></button>
        <button className="sidebar-account" onClick={() => setView('account')}><span className={`profile-avatar mini ${auth.user?.avatarColor ?? 'forest'}`}>{auth.user?.nickname.slice(0, 1) ?? '访'}</span><span><strong>{auth.user?.nickname ?? '访客学习'}</strong><small>{auth.status === 'online' ? '管理个人资料' : auth.user ? '离线资料 · 点击重新登录' : '登录 / 注册'}</small></span></button>
        <p className="offline">已内置 {library?.metadata.cardCount.toLocaleString() ?? '…'} 词 · 本地保存</p></div>
    </aside>
    <main className="main list-main">
      <header><div><p className="eyebrow">{auth.user ? `${auth.user.nickname}的学习空间` : '我的学习空间'}</p><h1>{view === 'account' ? '个人中心' : view === 'library' ? '词典与词书' : view === 'review' ? '今日复习' : active?.name ?? '你的第一份 List'}</h1></div>
        <div className="header-actions"><button className="ghost" onClick={() => setView('account')}>{auth.user ? '个人中心' : '登录 / 注册'}</button><button className="ghost" onClick={() => setView('library')}>浏览词书</button><button className="primary" onClick={() => { setView('lists'); setShowCreate(true); }}><Plus size={14}/> 新建 List</button></div>
      </header>
      {(initial.error || storageError || libraryError) && <p role="alert" className="error-line">{initial.error || storageError || libraryError}</p>}
      {message && <div role="status" className="notice">{message}<button title="关闭提示" onClick={() => setMessage('')}><X size={14}/></button></div>}
      {view === 'home' ? <HomeDashboard user={auth.user} online={auth.status === 'online'} lists={lists} records={data.reviewRecords} library={library} now={clock} onList={(id, review = false) => { setActiveId(id); setSelectedId(''); setView(review ? 'review' : 'lists'); }} onNavigate={navigate}/> : view === 'extensions' ? <section className="extensions-page"><h2>扩展模块</h2><p>这里预留社区、宠物、等级、同步、统计与商业化接口。</p><button className="primary" onClick={() => setView('home')}>返回首页</button></section> : view === 'account' || view === 'settings' ? <AccountPanel auth={auth} listCount={lists.length} reviewedCount={reviewed.length} onBack={() => setView('lists')}/> : view === 'review' ? <ReviewPanel key={active?.id ?? 'empty'} list={active} records={data.reviewRecords} settings={settings} onSettings={updateSettings} onResult={reviewResult} onBack={() => setView('lists')}/> : <>
      <fieldset className="workspace-controls" disabled={!!initial.error}>
      {showCreate && <section className="panel create-panel"><h3>创建属于你的 List</h3><form onSubmit={event => { event.preventDefault(); if (name.trim()) createLists([studyListService.create(name)]); }}>
        <label>List 名称<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="例如：旅行前想掌握的词"/></label>
        <button className="primary" disabled={!name.trim()}>创建空 List</button><button type="button" className="ghost" onClick={() => setShowCreate(false)}>取消</button>
      </form><button className="text-btn" onClick={() => { setView('library'); setShowCreate(false); }}>也可以先选词，或设置规则自动生成 →</button></section>}
      {view === 'library' ? <LibraryPanel library={library} lists={lists} onCreate={createLists} onAdd={addCards} notify={setMessage}/>
        : !active ? <section className="welcome"><div className="welcome-icon"><ListChecks size={36}/></div><p className="eyebrow">从你想学的内容开始</p><h2>List 的组织方式，由你来定</h2>
          <p>自己建组、挑选单词；也可以指定词书和范围，让系统替你分组。</p><div className="welcome-actions"><button className="primary" onClick={() => setShowCreate(true)}>手动创建 List</button><button className="ghost" onClick={() => setView('library')}>选词或自动分组</button></div>
          <small>词库已就绪，不会默认安排学习任务。</small></section>
        : <>
          <section className="list-toolbar"><div className="toolbar-intro"><div className="list-badge"><ListChecks size={17}/></div><div><strong>{active.cards.length} 张卡片</strong><span>我的安排 · 已复习 {active.cards.filter(card => reviewed.includes(card.id)).length} 词</span></div></div>
            <button className="ghost" onClick={() => { if (confirm(`删除“${active.name}”？这不会删除词典内容。`)) { setData(current => ({ ...current, lists: current.lists.filter(list => list.id !== active.id) })); setActiveId(''); } }}>删除 List</button></section>
          <ListSettings settings={settings} onChange={updateSettings}/>
          <button className="primary" onClick={() => setView('review')}>开始四种方案复习</button>
          {!!active.archivedCards?.length && <details className="review-settings"><summary>已移出卡片 · {active.archivedCards.length}</summary>{active.archivedCards.map(card => <p key={card.id}>{card.content} <button className="ghost" onClick={() => setData(current => ({ ...current, lists: current.lists.map(l => l.id === active.id ? { ...l, cards: [...l.cards, card], archivedCards: l.archivedCards?.filter(c => c.id !== card.id) } : l), reviewRecords: putRecord(current.reviewRecords, { ...currentRecord(current.reviewRecords, card.id, active.id, settings), longMark: 0, shortMark: 0, longIncrementDate: undefined }) }))}>恢复到 List（长期记忆度清零）</button></p>)}</details>}
          <label className="rename-label">List 名称<input aria-label="重命名 List" value={active.name} onChange={event => setData(current => ({ ...current, lists: current.lists.map(list => list.id === active.id ? { ...list, name: event.target.value } : list) }))}/></label>
          <section className="import-panel"><div className="import-heading"><div><strong>添加你想学的词</strong><span>优先使用内置英汉词典；未收录的单词联网查询英文释义。</span></div></div>
            <form className="import-row" onSubmit={event => { event.preventDefault(); importCard(); }}><Search size={16}/><input value={importWord} onChange={event => setImportWord(event.target.value)} placeholder="输入英文单词"/><button className="primary" disabled={importing || !importWord.trim()}>{importing ? '查询中…' : '加入当前 List'}</button></form>
            <button className="text-btn" onClick={() => setView('library')}>从词书批量选词 →</button></section>
          <div className="list-layout"><section className="card-list-panel"><div className="list-panel-head"><strong>我的卡片</strong><input aria-label="筛选当前 List" value={query} onChange={event => setQuery(event.target.value)} placeholder="筛选当前 List"/></div>
            {filtered.length ? filtered.map((card, index) => <div key={card.id} className={selected?.id === card.id ? 'card-row selected' : 'card-row'}>
              <button className="card-select" onClick={() => setSelectedId(card.id)}><span className="row-index">{reviewed.includes(card.id) ? <Check size={15}/> : index + 1}</span><span className="row-content"><strong>{card.content}</strong><span>{card.translation || card.definition}</span><small>今日巩固度 {currentRecord(data.reviewRecords, card.id, active.id, settings, clock).shortMark} · 长期记忆度 {currentRecord(data.reviewRecords, card.id, active.id, settings, clock).longMark}</small></span></button>
              <button className="row-sound" title={`播放 ${card.content}`} onClick={() => play(card)}><Volume2 size={16}/></button>
              <button className="mini-icon" title={`移除 ${card.content}`} onClick={() => setData(current => ({ ...current, lists: current.lists.map(list => list.id === active.id ? { ...list, cards: list.cards.filter(item => item.id !== card.id) } : list) }))}><Trash2 size={14}/></button>
            </div>) : <div className="empty-list">{active.cards.length ? '没有匹配的卡片' : '还没有卡片。可在上方查词加入，或去词书资料库选词。'}</div>}
          </section>{selected && <aside className="list-detail" onClick={advanceCard} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') advanceCard(); }} title="点击卡片进入下一张"><div className="detail-label">{selected.source ?? '词典查询'} · 单词卡</div><div className="detail-word"><h2>{selected.content}</h2><button className="sound large" title="点击发声" onClick={event => { event.stopPropagation(); play(selected); }}><Volume2 size={21}/></button></div>
            <p className="detail-phonetic">{selected.phonetic || '未提供音标'}</p><p className="detail-meaning">{selected.translation}</p>{selected.definition && <p className="definition">{selected.definition}</p>}
            {selected.exchange && <p className="word-forms">词形变化：{selected.exchange}</p>}{selected.example && <p className="detail-example">{selected.example}</p>}
            <div className="mark-controls" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}><span>今日巩固度 {marks?.shortMark} / {settings.shortTarget}</span><label>长期记忆度<input aria-label="修改长期记忆度" type="number" min="0" max="50" value={marks?.longMark ?? 0} onChange={event => editLongMark(selected.id, Number(event.target.value))}/></label></div><div className="detail-tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div><button className="primary review-button" onClick={event => { event.stopPropagation(); setView('review'); }}>四种方案复习并更新记忆进度</button><small className="card-next-hint">点击卡片任意空白处进入下一张</small>
          </aside>}</div>
        </>}
      </fieldset>
      </>}
    </main><AndroidBottomNav view={view} onNavigate={navigate}/></div>;
}
