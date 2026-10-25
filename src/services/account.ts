import type { AccountUser, AccountOperation, AccountResponse, ProfileInput } from '../features/account/types';

const routes: Record<AccountOperation, { method: string; path: string }> = {
  me: { method: 'GET', path: '/api/auth/me' },
  register: { method: 'POST', path: '/api/auth/register' },
  login: { method: 'POST', path: '/api/auth/login' },
  logout: { method: 'POST', path: '/api/auth/logout' },
  profile: { method: 'PATCH', path: '/api/account/profile' },
  password: { method: 'POST', path: '/api/account/password' },
};
let androidToken = '';
function androidApiBase(): string { return window.AndroidConfig?.apiBase?.().replace(/\/$/, '') ?? ''; }
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

/** 网页使用同源Cookie；桌面和Android令牌不进入localStorage，Android令牌仅保存在当前JS进程内存。 */
async function request(operation: AccountOperation, payload?: Record<string, unknown>): Promise<AccountResponse> {
  try {
    const native = window.desktop?.accountRequest;
    if (native) {
      const result = await native(operation, payload);
      if (result.status >= 400) throw new AccountError(result.body.error ?? '请求失败', result.status);
      return result.body;
    }
    const route = routes[operation];
    const apiBase = androidApiBase();
    const android = Boolean(apiBase);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (android) { headers['X-Wordflow-Client'] = 'android'; if (androidToken) headers.Authorization = `Bearer ${androidToken}`; }
    const endpoint = apiBase ? `${apiBase}${route.path}` : route.path;
    const response = await fetch(endpoint, { method: route.method, credentials: android ? 'omit' : 'same-origin', headers, signal: AbortSignal.timeout(operation === 'me' ? 3000 : 15_000),
      ...(route.method !== 'GET' ? { body: JSON.stringify(payload ?? {}) } : {}) });
    const body = await response.json() as AccountResponse;
    if (!response.ok) throw new AccountError(body.error ?? '请求失败', response.status);
    if (android && body.token) androidToken = body.token;
    if (android && (operation === 'logout' || response.status === 401)) androidToken = '';
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
