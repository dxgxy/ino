import type { ComponentType } from 'react';
/** Optional modules render within the Android navigation shell; disabled by default. */
export interface AndroidExtension { id: string; title: string; description: string; enabled: boolean; component: ComponentType }
const extensions = new Map<string, AndroidExtension>();
export function registerAndroidExtension(module: AndroidExtension): void {
  if (!/^[a-z][a-z0-9-]*$/.test(module.id) || extensions.has(module.id)) throw new Error('模块标识无效或重复');
  extensions.set(module.id, module);
}
export function listAndroidExtensions(): AndroidExtension[] { return [...extensions.values()].filter(module => module.enabled); }
