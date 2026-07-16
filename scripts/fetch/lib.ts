import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HistoryFile, LatestFile, RankingEntry } from '../../src/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'public', 'data');

// WBSC などは bot 系 UA を 403 で拒否するためブラウザ UA を使う
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** コード欠損時のフォールバック: 名前から擬似コードを生成 */
export function slugCode(name: string): string {
  return name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'UNKNOWN';
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 上流の異常データで良いデータを上書きしないための検証ゲート */
export function validateSnapshot(
  id: string,
  updatedAt: string,
  entries: RankingEntry[],
  minCount: number,
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updatedAt)) {
    throw new Error(`${id}: invalid updatedAt "${updatedAt}"`);
  }
  if (entries.length < minCount) {
    throw new Error(`${id}: only ${entries.length} entries (< ${minCount})`);
  }
  if (!entries.some((e) => e.rank === 1)) {
    throw new Error(`${id}: no rank-1 entry`);
  }
  const codes = new Set<string>();
  for (const e of entries) {
    if (!Number.isInteger(e.rank) || e.rank < 1) throw new Error(`${id}: bad rank ${e.rank}`);
    if (!e.code || !e.name) throw new Error(`${id}: entry missing code/name at rank ${e.rank}`);
    if (codes.has(e.code)) throw new Error(`${id}: duplicate code ${e.code}`);
    codes.add(e.code);
  }
}

function latestPath(id: string): string {
  return join(DATA_DIR, id, 'latest.json');
}
function historyPath(id: string): string {
  return join(DATA_DIR, id, 'history.json');
}

export function readLatest(id: string): LatestFile | null {
  const p = latestPath(id);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as LatestFile;
}

export function readHistory(id: string): HistoryFile {
  const p = historyPath(id);
  if (!existsSync(p)) return { id, names: {}, snapshots: [] };
  return JSON.parse(readFileSync(p, 'utf8')) as HistoryFile;
}

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** 1エントリ=1行で書き出し、git差分を読みやすく小さく保つ */
function serializeLatest(latest: LatestFile): string {
  const rows = latest.entries.map((e) => JSON.stringify(e)).join(',\n');
  return `{\n"id": ${JSON.stringify(latest.id)},\n"updatedAt": ${JSON.stringify(latest.updatedAt)},\n"entries": [\n${rows}\n]\n}\n`;
}

/** 1スナップショット=1行。日付追加時の差分が1行追加で済む */
function serializeHistory(h: HistoryFile): string {
  const rows = h.snapshots
    .map((s) => JSON.stringify({ date: s.date, ranks: sortKeys(s.ranks) }))
    .join(',\n');
  return `{\n"id": ${JSON.stringify(h.id)},\n"names": ${JSON.stringify(sortKeys(h.names))},\n"snapshots": [\n${rows}\n]\n}\n`;
}

/**
 * latest.json 書き出し + history.json へのマージ。
 * ソースが prevRank を提供しない場合は既存 latest(別日付)から補完する。
 */
export function saveSnapshot(id: string, updatedAt: string, entries: RankingEntry[]): void {
  const old = readLatest(id);
  if (old && old.updatedAt !== updatedAt) {
    const oldRanks = new Map(old.entries.map((e) => [e.code, e.rank]));
    for (const e of entries) {
      if (e.prevRank == null && oldRanks.has(e.code)) e.prevRank = oldRanks.get(e.code)!;
    }
  }

  mkdirSync(join(DATA_DIR, id), { recursive: true });
  writeFileSync(latestPath(id), serializeLatest({ id, updatedAt, entries }));
  mergeHistorySnapshot(id, updatedAt, entries);
}

/** history.json に1スナップショットを日付順で挿入(同日付は上書き) */
export function mergeHistorySnapshot(
  id: string,
  date: string,
  entries: RankingEntry[],
): void {
  const h = readHistory(id);
  for (const e of entries) h.names[e.code] = e.name;
  const ranks: Record<string, number> = {};
  for (const e of entries) ranks[e.code] = e.rank;

  const i = h.snapshots.findIndex((s) => s.date === date);
  if (i >= 0) h.snapshots[i] = { date, ranks };
  else {
    h.snapshots.push({ date, ranks });
    h.snapshots.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  mkdirSync(join(DATA_DIR, id), { recursive: true });
  writeFileSync(historyPath(id), serializeHistory(h));
}
