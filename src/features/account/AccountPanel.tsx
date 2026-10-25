import { useState } from 'react';
import { ArrowLeft, BookOpen, Eye, EyeOff, Fingerprint, Leaf, LockKeyhole, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import type { AccountController } from './useAccount';
import type { ProfileInput } from './types';

interface Props { auth: AccountController; listCount: number; reviewedCount: number; onBack: () => void }

export function AccountPanel({ auth, listCount, reviewedCount, onBack }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<ProfileInput>({ nickname: auth.user?.nickname ?? '', dailyGoal: auth.user?.dailyGoal ?? 20, avatarColor: auth.user?.avatarColor ?? 'forest' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const run = async (action: () => Promise<void>, message = '') => {
    setBusy(true); setError(''); setSuccess('');
    try { await action(); setSuccess(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '请求失败，请稍后再试'); }
    finally { setBusy(false); }
  };
  const online = auth.status === 'online';
  return <section className="account-page">
    <button className="text-btn account-back" onClick={onBack}><ArrowLeft size={15}/> 返回我的 List</button>
    <div className="account-layout"><aside className="account-story">
      <div className="account-symbol"><Leaf size={30}/></div><p className="eyebrow">WORDFLOW · 我的学习空间</p>
      <h2>把每一个词，<br/>学成自己的。</h2><p>账号帮你保留身份与偏好，<br/>学习的节奏，始终由你掌握。</p>
      <div className="account-promise"><ShieldCheck size={20}/><div><strong>学习资料留在本机</strong><span>词典、List 与复习记录本地保存。</span></div></div>
      <div className="account-promise"><Fingerprint size={20}/><div><strong>云端只存必要资料</strong><span>账号、昵称、学习目标和登录状态。</span></div></div>
      <div className="account-promise"><BookOpen size={20}/><div><strong>离线也能继续学</strong><span>不登录，也可以建立自己的 List。</span></div></div>
    </aside><div className="account-card">
      {online && auth.user ? <>
        <div className="profile-summary"><div className={`profile-avatar ${auth.user.avatarColor}`}>{auth.user.nickname.slice(0, 1)}</div><div><h2>{auth.user.nickname}</h2><p>@{auth.user.username} · 已登录</p></div></div>
        <div className="profile-stats"><span><strong>{listCount}</strong>本机 List</span><span><strong>{reviewedCount}</strong>已复习词</span><span><strong>{auth.user.dailyGoal}</strong>每日目标</span></div>
        <form onSubmit={event => { event.preventDefault(); run(() => auth.saveProfile(profile), '个人资料已保存'); }}>
          <h3>个人资料</h3><label>昵称<input required minLength={1} maxLength={24} value={profile.nickname} onChange={e => setProfile({ ...profile, nickname: e.target.value })}/></label>
          <label>每日学习目标<input required type="number" min={5} max={200} value={profile.dailyGoal} onChange={e => setProfile({ ...profile, dailyGoal: Number(e.target.value) })}/></label>
          <label>头像配色<select value={profile.avatarColor} onChange={e => setProfile({ ...profile, avatarColor: e.target.value })}><option value="forest">森林绿</option><option value="ocean">海盐蓝</option><option value="sunset">落日橙</option><option value="violet">丁香紫</option></select></label>
          <button className="primary" disabled={busy}>保存个人资料</button>
        </form>
        <details className="password-details"><summary><LockKeyhole size={15}/> 修改密码</summary><form onSubmit={event => { event.preventDefault(); run(async () => { await auth.changePassword(currentPassword, nextPassword); setCurrentPassword(''); setNextPassword(''); }, '密码已更新，其他设备的登录会话已失效'); }}>
          <label>当前密码<input type="password" required autoComplete="current-password" minLength={10} maxLength={128} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label>
          <label>新密码<input type="password" required autoComplete="new-password" minLength={10} maxLength={128} value={nextPassword} onChange={e => setNextPassword(e.target.value)}/></label>
          <button className="ghost" disabled={busy}>更新密码</button>
        </form></details><button className="text-btn account-logout" disabled={busy} onClick={() => run(auth.logout)}><LogOut size={15}/> 退出登录</button>
      </> : <>
        <div className="account-card-heading"><div className="account-lock"><UserRound size={23}/></div><h2>{tab === 'login' ? '欢迎回来' : '开始你的学习旅程'}</h2><p>{tab === 'login' ? '登录个人账号，继续自己的学习节奏。' : '只需账号、昵称和密码，不收集手机号。'}</p></div>
        {auth.user && <p className="account-offline-note">当前展示 {auth.user.nickname} 的本地资料，云端身份尚未验证。重新登录可管理个人资料。</p>}
        <div className="account-tabs"><button className={tab === 'login' ? 'active' : ''} disabled={busy} onClick={() => { setTab('login'); setError(''); setPassword(''); setConfirmPassword(''); }}>登录</button><button className={tab === 'register' ? 'active' : ''} disabled={busy} onClick={() => { setTab('register'); setError(''); setPassword(''); setConfirmPassword(''); }}>注册新账号</button></div>
        <form onSubmit={event => {
          event.preventDefault();
          if (tab === 'register' && password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
          run(async () => { if (tab === 'login') await auth.login(username, password); else await auth.register(username, password, nickname); setPassword(''); setConfirmPassword(''); });
        }}>
          <label>账号<input required autoComplete="username" pattern="[a-zA-Z0-9_]{3,32}" minLength={3} maxLength={32} value={username} onChange={e => setUsername(e.target.value)} placeholder="3–32位字母、数字或下划线"/></label>
          {tab === 'register' && <label>昵称<input required autoComplete="nickname" maxLength={24} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="希望我们如何称呼你"/></label>}
          <label>密码<div className="password-field"><input required type={showPassword ? 'text' : 'password'} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} minLength={10} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="至少10个字符"/><button type="button" title={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
          {tab === 'register' && <label>确认密码<input required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入密码"/></label>}
          <button className="primary account-submit" disabled={busy}>{busy ? '正在连接…' : tab === 'login' ? '登录我的账号' : '创建账号并登录'}</button>
        </form>
        <p className="account-data-note">登录后的学习记录在本机按账号独立保存，访客资料不会自动合并或上传。请妥善保存密码，当前未接入邮件找回。</p>
        <button className="text-btn account-guest" disabled={busy} onClick={onBack}>先继续本地学习 →</button>
      </>}
      {error && <p role="alert" className="account-error">{error}</p>}{success && <p role="status" className="account-success">{success}</p>}
      {auth.notice && <p className="account-offline-note">{auth.notice}</p>}
    </div></div>
  </section>;
}
