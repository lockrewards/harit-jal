/**
 * Environment classification helpers shared across Auth, Storage, and Routing layers.
 * Treats production Vite bundles (`import.meta.env.PROD`) and explicit `VITE_APP_ENV=production`
 * identically so fail-closed security controls apply consistently in builds, previews, and Node tests.
 */

export type AppEnvironment = 'production' | 'development' | 'test';

interface NodeLikeProcess {
  env?: Record<string, string | undefined>;
}

function readProcessEnv(): Record<string, string | undefined> | undefined {
  const proc = (globalThis as { process?: NodeLikeProcess }).process;
  return proc?.env;
}

function readStaticViteMeta(key: string): string | boolean | undefined {
  if (typeof import.meta === 'undefined' || !import.meta.env) {
    return undefined;
  }
  // Strict allowlist of non-secret public client variables permitted in browser bundles
  switch (key) {
    case 'PROD':
      return import.meta.env.PROD;
    case 'MODE':
      return import.meta.env.MODE;
    case 'VITE_APP_ENV':
      return import.meta.env.VITE_APP_ENV;
    case 'VITE_SUPABASE_URL':
      return import.meta.env.VITE_SUPABASE_URL;
    case 'VITE_SUPABASE_ANON_KEY':
      return import.meta.env.VITE_SUPABASE_ANON_KEY;
    case 'VITE_SITE_URL':
      return import.meta.env.VITE_SITE_URL;
    default:
      return undefined;
  }
}

export function isBrowserLocalhost(): boolean {
  if (typeof window !== 'undefined' && window.location) {
    const host = typeof window.location.hostname === 'string' ? window.location.hostname : '';
    if (!host) return false;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
  }
  return false;
}

export function isProductionEnvironment(): boolean {
  // Local browser workstation runs in local development mode regardless of .env production flags
  if (isBrowserLocalhost()) {
    return false;
  }

  if (readStaticViteMeta('PROD') === true) {
    return true;
  }
  const viteMode = String(readStaticViteMeta('MODE') ?? '').trim().toLowerCase();
  if (viteMode === 'production') {
    return true;
  }
  const viteAppEnv = String(readStaticViteMeta('VITE_APP_ENV') ?? '').trim().toLowerCase();
  if (viteAppEnv === 'production') {
    return true;
  }

  const procEnv = readProcessEnv();
  if (procEnv) {
    if (String(procEnv.VITE_APP_ENV ?? '').trim().toLowerCase() === 'production') {
      return true;
    }
    if (String(procEnv.NODE_ENV ?? '').trim().toLowerCase() === 'production') {
      return true;
    }
  }

  return false;
}

export function getAppEnvironment(): AppEnvironment {
  if (isProductionEnvironment()) {
    return 'production';
  }

  const procEnv = readProcessEnv();
  const rawMode = String(
    readStaticViteMeta('VITE_APP_ENV') ??
      readStaticViteMeta('MODE') ??
      procEnv?.VITE_APP_ENV ??
      procEnv?.NODE_ENV ??
      ''
  )
    .trim()
    .toLowerCase();

  if (rawMode === 'test') {
    return 'test';
  }
  return 'development';
}

export function readViteEnv(key: string): string {
  const metaVal = readStaticViteMeta(key);
  if (typeof metaVal === 'string' && metaVal.trim().length > 0) {
    return metaVal.trim();
  }

  const procEnv = readProcessEnv();
  const procVal = procEnv ? procEnv[key] : undefined;
  if (typeof procVal === 'string' && procVal.trim().length > 0) {
    return procVal.trim();
  }

  return '';
}
