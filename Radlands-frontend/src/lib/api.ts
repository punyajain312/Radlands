// In dev, Vite proxies relative URLs to localhost:8000 via vite.config.ts.
// In production (Vercel), VITE_API_URL must be set to the Render backend URL.
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// WebSocket base: wss:// in production, ws:// in dev.
// In dev with VITE_API_URL unset, fall back to Vite's WS proxy (relative path handled by caller).
export const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined) ?? '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function wsUrl(path: string): string {
  if (WS_BASE) return `${WS_BASE}${path}`;
  // Dev: build ws:// URL from current page host so Vite proxy handles it
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${path}`;
}
