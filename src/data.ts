import type { HistoryFile, IndexFile, LatestFile } from './types';

/** GitHub Pages のサブパス(/sports-ranking/)対応: fetch は必ずこれを通す */
const BASE = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function loadIndex(): Promise<IndexFile> {
  return fetchJson<IndexFile>('data/index.json');
}

export function loadLatest(id: string): Promise<LatestFile> {
  return fetchJson<LatestFile>(`data/${id}/latest.json`);
}

const historyCache = new Map<string, Promise<HistoryFile>>();

export function loadHistory(id: string): Promise<HistoryFile> {
  let p = historyCache.get(id);
  if (!p) {
    p = fetchJson<HistoryFile>(`data/${id}/history.json`);
    historyCache.set(id, p);
  }
  return p;
}
