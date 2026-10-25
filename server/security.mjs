import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
let activeHashes = 0;
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** 两路32MiB异步哈希，不排无限队列；忙时返回503让客户端稍后重试。 */
async function passwordKey(password, salt) {
  if (activeHashes >= 2) throw new ApiError(503, '服务繁忙，请稍后重试');
  activeHashes++;
  try { return await derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 }); }
  finally { activeHashes--; }
}
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new ApiError(400, '密码需为10–128个字符');
  return password;
}
export function validateUsername(username) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(username)) throw new ApiError(400, '账号需为3–32位字母、数字或下划线');
  return username.toLowerCase();
}
export function validateProfile(input) {
  if (typeof input.nickname !== 'string' || !input.nickname.trim() || input.nickname.trim().length > 24) throw new ApiError(400, '昵称需为1–24个字符');
  if (!Number.isInteger(input.dailyGoal) || input.dailyGoal < 5 || input.dailyGoal > 200) throw new ApiError(400, '每日目标需为5–200词');
  if (!['forest', 'ocean', 'sunset', 'violet'].includes(input.avatarColor)) throw new ApiError(400, '请选择可用的头像配色');
  return { nickname: input.nickname.trim(), dailyGoal: input.dailyGoal, avatarColor: input.avatarColor };
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await passwordKey(password, salt);
  return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [scheme, n, r, p, salt, hash] = encoded.split('$');
  if (scheme !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hash)) return false;
  return timingSafeEqual(await passwordKey(password, salt), Buffer.from(hash, 'hex'));
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

/** 仅在内存中保留有界计数，不落库保存访问IP。 */
export function createLimiter() {
  const counters = new Map();
  const cleanup = () => { const now = Date.now(); for (const [key, value] of counters) if (value.until <= now) counters.delete(key); };
  return {
    hit(key, limit, windowMs) {
      cleanup();
      let entry = counters.get(key);
      if (!entry) {
        if (counters.size >= 4096) throw new ApiError(503, '服务繁忙，请稍后重试');
        entry = { count: 0, until: Date.now() + windowMs }; counters.set(key, entry);
      }
      if (++entry.count > limit) throw new ApiError(429, '尝试过于频繁，请稍后重试');
    },
    cleanup,
  };
}
