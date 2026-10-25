import type { AccountUser, AccountOperation, AccountResponse, ProfileInput } from '../features/account/types';

const routes: Record<AccountOperation, { method: string; path: string }> = {
  me: { method: 'GET', path: '/api/auth/me' },
  register: { method: 'POST', path: '/api/auth/register' },
  login: { method: 'POST', path: '/api/auth/login' },
  logout: { method: 'POST', path: '/api/auth/logout' },
  profile: { method: 'PATCH', path: '/api/account/profile' },
  password: { method: 'POST', path: '/api/account/password' },
};
export class AccountError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}
export interface AccountService {
  me(): Promise<AccountUser>;
  login(username: string, password: string): Promise<AccountUser>;
  register(username: string, password: string, nickname: string): Promise<AccountUser>;
  updateProfile(input: ProfileInput): Promise<AccountUser>;
  changePassword(currentPassword: string, newPassword: string): Promise<AccountUser>;
  logout(): Promise<void>;
}

/** 网页使用同源Cookie；桌面凭据只经限定IPC送到主进程，渲染进程不接触会话令牌。 */
async function request(operation: AccountOperation, payload?: Record<string, unknown>): Promise<AccountResponse> {
  try {
    const native = window.desktop?.accountRequest;
    if (native) {
      const result = await native(operation, payload);
      if (result.status >= 400) throw new AccountError(result.body.error ?? '请求失败', result.status);
      return result.body;
    }
    const route = routes[operation];
    const response = await fetch(route.path, { method: route.method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(operation === 'me' ? 3000 : 15_000),
      ...(route.method !== 'GET' ? { body: JSON.stringify(payload ?? {}) } : {}) });
    const body = await response.json() as AccountResponse;
    if (!response.ok) throw new AccountError(body.error ?? '请求失败', response.status);
    return body;
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError('暂时连接不上账号服务，你仍可使用本地学习功能。');
  }
}
const userFrom = (body: AccountResponse) => {
  if (!body.user) throw new AccountError('账号服务返回的资料无效');
  return body.user;
};
export const accountService: AccountService = {
  me: async () => userFrom(await request('me')),
  login: async (username, password) => userFrom(await request('login', { username, password })),
  register: async (username, password, nickname) => userFrom(await request('register', { username, password, nickname })),
  updateProfile: async input => userFrom(await request('profile', { ...input })),
  changePassword: async (currentPassword, newPassword) => userFrom(await request('password', { currentPassword, newPassword })),
  logout: async () => { await request('logout'); },
};
