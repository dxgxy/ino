import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** 数据库只包含账号和有限会话；词库、卡片、录音没有服务端表。 */
export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 1) { db.close(); throw new Error('数据库版本比当前服务更新，请使用匹配版本'); }
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}

export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function publicUser(row) {
  return { id: row.id, username: row.username, nickname: row.nickname, dailyGoal: row.daily_goal,
    avatarColor: row.avatar_color, createdAt: new Date(row.created_at).toISOString() };
}
