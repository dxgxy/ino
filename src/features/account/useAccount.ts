import { useEffect, useState } from 'react';
import { accountService, AccountError } from '../../services/account';
import type { AccountUser, ProfileInput } from './types';

const CACHE_KEY = 'wordflow:local-profile:v1';
function cachedProfile(): AccountUser | null {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return value && typeof value.id === 'string' && typeof value.nickname === 'string' && typeof value.username === 'string' && typeof value.dailyGoal === 'number' ? value : null;
  } catch { return null; }
}

/** 缓存仅供离线展示与本地学习分区，不用于授权任何服务器请求。 */
export function useAccount() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [status, setStatus] = useState<'checking' | 'guest' | 'online' | 'offline'>('checking');
  const [notice, setNotice] = useState('');
  const accept = (profile: AccountUser) => {
    setUser(profile); setStatus('online');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(profile)); }
    catch { setNotice('个人资料已保存到服务器，本机离线资料缓存失败。'); }
  };
  useEffect(() => {
    let cancelled = false;
    accountService.me().then(profile => { if (!cancelled) accept(profile); }).catch(error => {
      if (cancelled) return;
      if (error instanceof AccountError && error.status === 401) {
        setStatus('guest'); setUser(null);
        try { localStorage.removeItem(CACHE_KEY); } catch { /* 不阻断访客学习。 */ }
      } else {
        setUser(cachedProfile()); setStatus('offline');
        setNotice('账号服务暂时不可用，本地学习仍可继续。');
      }
    });
    return () => { cancelled = true; };
  }, []);
  return {
    user, status, notice,
    login: async (username: string, password: string) => { accept(await accountService.login(username, password)); setNotice(''); },
    register: async (username: string, password: string, nickname: string) => { accept(await accountService.register(username, password, nickname)); setNotice(''); },
    saveProfile: async (input: ProfileInput) => accept(await accountService.updateProfile(input)),
    changePassword: async (current: string, next: string) => accept(await accountService.changePassword(current, next)),
    reconnect: async () => { accept(await accountService.me()); setNotice(''); },
    logout: async () => {
      // 离线资料不等于有效会话；仅离线时可直接退出本地身份。
      if (status === 'online') await accountService.logout();
      setUser(null); setStatus('guest'); setNotice('');
      try { localStorage.removeItem(CACHE_KEY); } catch { /* 展示状态已退出。 */ }
    },
  };
}
export type AccountController = ReturnType<typeof useAccount>;
