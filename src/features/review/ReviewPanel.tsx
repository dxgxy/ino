import { useEffect, useState } from 'react';
import type { WordCard } from '../../domain/types';
import type { UserList, ListReviewSettings } from '../../services/studyLists';
import { normalizeSpelling, currentRecord, pendingCards, schemes, type ReviewRecord, type ReviewScheme } from '../../services/review';
import { speak } from '../../services/pronunciation';
import './review.css';
import { ListSettings } from './ListSettings';
interface Props { list?: UserList; records: ReviewRecord[]; settings: ListReviewSettings; onResult: (cardId: string, scheme: ReviewScheme, success: boolean) => void; onSettings: (settings: ListReviewSettings) => void; onBack: () => void; }
export function ReviewPanel({ list, records, settings, onResult, onSettings, onBack }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const [scheme, setScheme] = useState<ReviewScheme>('meaning');
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [submittedCard, setSubmittedCard] = useState<WordCard | null>(null);
  const [phase, setPhase] = useState<'question' | 'answer'>('question');
  const [guess, setGuess] = useState('');
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState('');
  const allPending = list ? pendingCards(list.cards, records, list.id, settings, now) : [];
  const queue = allPending.filter(card => !seenIds.includes(card.id));
  const card = phase === 'answer' ? submittedCard : queue[0];
  const play = () => { if (card) speak(card).catch(e => setError(String(e))); };
  const submit = (knows: boolean) => { if (!card || phase !== 'question') return; setSubmittedCard(card); setClaimed(knows); setPhase('answer'); play(); };
  const confirm = (expected: boolean) => {
    if (!card) return;
    const spellingCorrect = scheme !== 'spelling' || normalizeSpelling(guess) === normalizeSpelling(card.content);
    onResult(card.id, scheme, expected && claimed && spellingCorrect);
    setSeenIds(current => [...current, card.id]); setPhase('question'); setSubmittedCard(null); setGuess(''); setError(''); setNow(new Date());
  };
  const r = list && card ? currentRecord(records, card.id, list.id, settings, now) : undefined;
  return <section className="review-page">
    <button className="text-btn" onClick={onBack}>← 返回 List 与复习设置</button>
    <h2>{list?.name ?? '请先选择 List'} · 四种复习方案</h2>
    <ListSettings settings={settings} onChange={onSettings}/>
    <div className="scheme-tabs">{schemes.map(s => <button key={s.key} disabled={phase === 'answer'} className={scheme === s.key ? 'active' : ''} onClick={() => { setScheme(s.key); setGuess(''); setSeenIds([]); }}>{s.title}</button>)}</div>
    <p>待完成 {queue.length} 词 · 今日巩固度达标值 {settings.shortTarget} · 每词每日最多 {settings.dailyLimit} 次 · 长期记忆度达 {settings.longRemoveAt} 移出</p>
    {error && <p role="alert">{error}</p>}
    {!card ? <div className="review-complete"><h2>本轮已完成</h2><p>{allPending.length ? `还有 ${allPending.length} 词未达到今日巩固目标，可继续下一轮。` : '当前 List 已达标，或达到每词每日尝试上限；明天可继续。'}</p>{allPending.length > 0 && <button className="primary" onClick={() => { setSeenIds([]); setNow(new Date()); }}>继续下一轮</button>}<button className="primary" onClick={onBack}>返回 List</button></div> : <>
      <p>今日巩固度 {r?.shortMark} / {settings.shortTarget} · 长期记忆度 {r?.longMark} · 今日尝试 {r?.attemptsToday} / {settings.dailyLimit}</p>
      {phase === 'question' ? <div className="review-card">
        {scheme === 'meaning' && <><strong>{card.content}</strong><small>{card.phonetic}</small></>}
        {scheme === 'listening' && <><strong>只听发音</strong><button className="primary" onClick={play}>播放 / 重听</button></>}
        {(scheme === 'spelling' || scheme === 'translation') && <strong>{card.translation || '此词未提供含义，请更换复习方案'}</strong>}
        {scheme === 'spelling' ? <form onSubmit={e => { e.preventDefault(); submit(true); }}><label>拼写英文<input aria-label="拼写英文" value={guess} onChange={e => setGuess(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}/></label><button className="primary" disabled={!guess.trim() || !card.translation}>提交拼写</button><button type="button" className="ghost" onClick={() => submit(false)}>想不起来</button></form> : <div className="review-actions"><button className="primary" disabled={scheme === 'translation' && !card.translation} onClick={() => submit(true)}>认识 / 已想出答案</button><button className="ghost" onClick={() => submit(false)}>不认识 / 想不起来</button></div>}
      </div> : <div className="review-card full-review-card"><strong>{card.content}</strong><small>{card.phonetic || '未提供音标'}</small><b>{card.translation}</b><p>{card.definition}</p>{card.exchange && <p>词形：{card.exchange}</p>}{card.example && <p>例句：{card.example}</p>}<p>{card.tags.join(' · ')}</p><small>{card.source}</small><button className="ghost" onClick={play}>再次发音</button>
        {scheme === 'spelling' && <p>你的拼写：{guess || '未填写'} · {normalizeSpelling(guess) === normalizeSpelling(card.content) ? '正确' : '错误，本次不增加今日巩固度'}</p>}
        <h3>答案是否符合你的预期？</h3><small>只有先前认识且确认符合（拼写需正确）才增加今日巩固度。</small><div className="review-actions"><button className="primary" onClick={() => confirm(true)}>符合预期 · 下一张</button><button className="ghost" onClick={() => confirm(false)}>不符合预期 · 下一张</button></div>
      </div>}
    </>}
  </section>;
}
