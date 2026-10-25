import { useState } from 'react';
import type { ListReviewSettings } from '../../services/studyLists';
export function ListSettings({ settings, onChange }: { settings: ListReviewSettings; onChange: (s: ListReviewSettings) => void }) {
  const [error, setError] = useState('');
  const fields = [['initialLong','新卡长期记忆度初值',0,20],['shortTarget','今日巩固度达标值',1,50],['dailyLimit','每词每日尝试上限',1,200],['longRemoveAt','长期记忆度移出阈值',1,50]] as const;
  return <details className="review-settings"><summary>本 List 复习设置</summary><p>同一单词在不同 List 的标记独立；长期记忆度初值只用于未开始的新卡。达到移出阈值后卡片归档，可恢复。</p><div className="settings-grid">{fields.map(([key,label,min,max]) => <label key={key}>{label}<input type="number" value={settings[key]} min={min} max={max} onChange={e => { const value=Number(e.target.value); if (!Number.isInteger(value)||value<min||value>max) { setError(`${label}范围：${min}–${max}`); return; } setError(''); onChange({...settings,[key]:value}); }}/></label>)}</div>{error && <p role="alert">{error}</p>}<p>默认长期记忆度=0、今日巩固度达标值=3、每日尝试上限=20、移出阈值=7；这些是可调产品参数，非文献测定常数。未认识、确认不符合、拼写错误均不加分。今日巩固度表示当天练习进度，每天重置；长期记忆度表示跨天积累的记忆程度，会随时间衰减，每天最多提升一次。</p></details>;
}
