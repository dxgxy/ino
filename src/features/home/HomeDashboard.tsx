import { useMemo, useState } from 'react';
import { BookOpen, CalendarClock, ChevronRight, Compass, Puzzle, Search, Settings2, Sparkles, Volume2 } from 'lucide-react';
import type { WordCard } from '../../domain/types';
import type { AccountUser } from '../account/types';
import type { UserList } from '../../services/studyLists';
import type { ReviewRecord } from '../../services/review';
import type { DictionaryLibrary } from '../../services/library';
import { appModules, dashboardSummary, searchModules, searchOffline, type AppView } from '../../services/dashboard';
import { speak } from '../../services/pronunciation';
import './home.css';
interface Props {
  user: AccountUser | null; online: boolean; lists: UserList[]; records: ReviewRecord[];
  library: DictionaryLibrary | null; now: Date;
  onNavigate: (view: AppView) => void; onList: (id: string, review?: boolean) => void;
}
export function HomeDashboard({ user, online, lists, records, library, now, onNavigate, onList }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WordCard | null>(null);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(0);
  const summary = useMemo(() => dashboardSummary(lists, records, now), [lists, records, now]);
  const cards = useMemo(() => library?.cards ?? [...new Map(lists.flatMap(l => l.cards).map(c => [c.id, c])).values()], [library, lists]);
  const matches = useMemo(() => searchOffline(cards, query), [cards, query]);
  const modules = useMemo(() => searchModules(query), [query]);
  const play = (card: WordCard) => { setError(''); speak(card).catch(e => setError(String(e))); };
  const tips = ['今日巩固度表示当天练习进度；长期记忆度反映跨天积累，两个指标分别记录。', '离线词典可用英文或中文释义搜索。点击结果查看完整词卡，再按扬声器听发音。', '四种方案都在查看答案后进行自我确认；未符合预期不会增加今日巩固度。'];
  return <section className="home-dashboard">
    <div className="home-topbar">
      <button className="home-profile" onClick={() => onNavigate('account')}><span className={`profile-avatar ${user?.avatarColor ?? 'forest'}`}>{user?.nickname.slice(0, 1) ?? '访'}</span><span><strong>{user?.nickname ?? '访客学习'}</strong><small>Lv.{summary.level} · 本机学习等级 · {online ? '账号已验证' : user ? '离线资料' : '访客'}</small></span></button>
      <button className="home-settings" onClick={() => onNavigate('settings')} aria-label="学习设置"><Settings2 size={19}/></button>
    </div>
    <div className="home-search"><Search size={20}/><input value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} placeholder="离线双语查词，或搜索功能" aria-label="离线双语查询和功能搜索"/><span>离线</span></div>
    {!!query.trim() && <section className="home-search-results" aria-label="查询结果"><div className="search-result-title">词典结果 {library ? '' : '· 词库载入中'}</div>
      {matches.map(card => <button key={card.id} onClick={() => setSelected(card)}><span><b>{card.content}</b><small>{card.translation || card.definition}</small></span><ChevronRight size={15}/></button>)}
      <div className="search-result-title">功能模块</div>{modules.map(module => <button key={module.id} onClick={() => onNavigate(module.view)}><span><b>{module.title}</b><small>{module.description}</small></span><ChevronRight size={15}/></button>)}
      {!matches.length && !modules.length && <p>未找到匹配项，可尝试英文、中文释义或“复习”“设置”。</p>}
    </section>}
    {selected && <section className="home-card home-word" aria-label="离线词卡"><button className="text-btn" onClick={() => setSelected(null)}>关闭词卡</button><h2>{selected.content}</h2><small>{selected.phonetic}</small><p>{selected.translation}</p><p>{selected.definition}</p>{selected.example && <p>{selected.example}</p>}{selected.exchange && <p>词形：{selected.exchange}</p>}<button className="ghost" onClick={() => play(selected)}><Volume2 size={16}/> 播放发音</button></section>}
    {error && <p role="alert">{error}</p>}
    <div className="home-welcome"><div><span className="home-kicker"><Sparkles size={15}/> 今日学习空间</span><h1>静下心来，开始学习。</h1><p>{summary.due ? `今天还有 ${summary.due} 词等你巩固。` : '按自己的节奏，积累每一点进步。'}</p></div><span className="home-landscape" aria-hidden="true">✦</span></div>
    <div className="home-section-head"><h2>List 复习情况</h2><button className="text-btn" onClick={() => onNavigate('lists')}>全部 List <ChevronRight size={14}/></button></div>
    <div className="home-list-summary">{summary.progress.length ? summary.progress.map(item => <button className="home-list-row" key={item.list.id} onClick={() => onList(item.list.id)}><span className="home-list-icon"><BookOpen size={17}/></span><span className="home-list-name"><strong>{item.list.name}</strong><small>{item.list.cards.length ? `今日达标 ${item.done}/${item.list.cards.length} · 待复习 ${item.due}${item.capped ? ` · 上限 ${item.capped}` : ''}` : `空 List${item.list.archivedCards?.length ? ` · 已归档 ${item.list.archivedCards.length}` : ''}`}</small></span><span className="home-progress" role="progressbar" aria-label={`${item.list.name}今日达标进度`} aria-valuenow={item.percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${item.percent}%` }}/></span><b>{item.percent}%</b></button>) : <div className="home-empty"><p>还没有 List，从你的第一份学习计划开始。</p><button className="primary" onClick={() => onNavigate('lists')}>创建我的 List</button></div>}</div>
    <div className="home-grid"><section className="home-card"><div className="home-card-title"><span><CalendarClock size={18}/> 今日简报</span><small>{summary.days[0].date}</small></div><div className="home-metrics"><div><b>{summary.practiced}</b><small>练习词次</small></div><div><b>{summary.completed}</b><small>今日达标</small></div><div><b>{summary.correct}</b><small>符合预期</small></div><div><b>{summary.wrong}</b><small>需加强</small></div></div><p className="summary-footnote">按 List 内词卡统计；历史版本的当天成功/失败次数未记录时显示 0。</p></section>
    <section className="home-card"><div className="home-card-title"><span><CalendarClock size={18}/> 艾宾浩斯复习规划</span></div><p className="home-plan-text">今日按巩固目标安排，记忆已衰减的 List 优先。未来预览假设期间不复习；实际完成后会更新。</p>
      {summary.progress.filter(p => p.due > 0).sort((a,b) => b.weakened-a.weakened).map(item => <button className="home-plan-item" key={item.list.id} onClick={() => onList(item.list.id, true)}><span><strong>{item.list.name}</strong><small>{item.weakened ? `${item.weakened} 词记忆已衰减 · ` : ''}{item.due} 词待巩固</small></span><ChevronRight size={16}/></button>)}
      {!summary.due && <p className="home-plan-text">暂无可开始的复习，可建立 List 或明天继续。</p>}
      <div className="home-week">{summary.days.map((day,index) => <div key={day.date}><small>{index === 0 ? '今天' : index === 1 ? '明天' : day.date.slice(5)}</small><b>{day.lists.reduce((n,l) => n+l.due,0)}</b><span>词</span></div>)}</div>
    </section></div>
    <section className="home-tip"><button className="home-tips-head" onClick={() => setTip(n => (n+1)%tips.length)}><Compass size={18}/> 学习提示<span>{tip+1}/{tips.length} · 换一条</span></button><p>{tips[tip]}</p></section>
  </section>;
}
export function AndroidBottomNav({ view, onNavigate }: { view: AppView; onNavigate: (view: AppView) => void }) {
  const entries = [{ id: 'home' as const, title: '首页', icon: Compass }, { id: 'lists' as const, title: 'List', icon: BookOpen }, { id: 'settings' as const, title: '设置', icon: Settings2 }, { id: 'extensions' as const, title: '扩展', icon: Puzzle }];
  return <nav className="android-bottom-nav" aria-label="底部导航">{entries.map(entry => { const active = entry.id === view || (entry.id === 'lists' && ['review','library'].includes(view)) || (entry.id === 'settings' && view === 'account'); const Icon=entry.icon; return <button key={entry.id} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} onClick={() => onNavigate(entry.id)}><Icon size={21}/><span>{entry.title}</span></button>; })}</nav>;
}
