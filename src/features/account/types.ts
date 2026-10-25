export interface AccountUser {
  id: string;
  username: string;
  nickname: string;
  dailyGoal: number;
  avatarColor: string;
  createdAt: string;
}
export type ProfileInput = Pick<AccountUser, 'nickname' | 'dailyGoal' | 'avatarColor'>;
export type AccountOperation = 'me' | 'register' | 'login' | 'logout' | 'profile' | 'password';
export interface AccountResponse { user?: AccountUser; ok?: boolean; error?: string }

declare global {
  interface Window {
    desktop?: {
      platform: string;
      isDesktop: boolean;
      accountRequest: (operation: AccountOperation, payload?: Record<string, unknown>) => Promise<{status: number; body: AccountResponse}>;
    };
  }
}
