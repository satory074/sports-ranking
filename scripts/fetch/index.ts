import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { IndexFile, RankingEntry } from '../../src/types';
import { CATEGORIES } from './categories';
import { DATA_DIR, readLatest, saveSnapshot, validateSnapshot } from './lib';
import { fetchFiba } from './sources/fiba';
import { fetchFifaCurrent } from './sources/fifa';
import { fetchFihMen, fetchFihWomen } from './sources/fih';
import { fetchFivb } from './sources/fivb';
import { fetchRugby } from './sources/rugby';
import { fetchWbsc } from './sources/wbsc';
import { fetchWta } from './sources/wta';

type Snapshot = { updatedAt: string; entries: RankingEntry[] };

const FETCHERS: Record<string, () => Promise<Snapshot>> = {
  'soccer-m': () => fetchFifaCurrent('men'),
  'soccer-w': () => fetchFifaCurrent('women'),
  'baseball-m': () => fetchWbsc('baseball-m'),
  'baseball-w': () => fetchWbsc('baseball-w'),
  'softball-w': () => fetchWbsc('softball-w'),
  'volleyball-m': () => fetchFivb('m'),
  'volleyball-w': () => fetchFivb('w'),
  'basketball-m': () => fetchFiba('men'),
  'basketball-w': () => fetchFiba('women'),
  'rugby-m': () => fetchRugby('mru'),
  'rugby-w': () => fetchRugby('wru'),
  'hockey-m': () => fetchFihMen(),
  'hockey-w': () => fetchFihWomen(),
  'tennis-wta': () => fetchWta(),
};

export function writeIndex(): void {
  const index: IndexFile = {
    generatedAt: new Date().toISOString(),
    categories: CATEGORIES.map(({ minCount: _min, ...meta }) => {
      const latest = readLatest(meta.id);
      return {
        ...meta,
        updatedAt: latest?.updatedAt ?? '',
        count: latest?.entries.length ?? 0,
      };
    }).filter((c) => c.count > 0),
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
}

async function main(): Promise<void> {
  const only = process.argv.slice(2); // 引数でカテゴリを絞り込める
  const targets = CATEGORIES.filter((c) => only.length === 0 || only.includes(c.id));
  const failures: string[] = [];

  for (const cat of targets) {
    const fetcher = FETCHERS[cat.id];
    try {
      const snap = await fetcher();
      validateSnapshot(cat.id, snap.updatedAt, snap.entries, cat.minCount);
      saveSnapshot(cat.id, snap.updatedAt, snap.entries);
      console.log(`ok   ${cat.id}: ${snap.entries.length} entries @ ${snap.updatedAt}`);
    } catch (err) {
      failures.push(cat.id);
      // GitHub Actions の警告アノテーションとして表示される
      console.error(`::warning::${cat.id} failed: ${(err as Error).message}`);
    }
  }

  writeIndex();

  if (failures.length > 0) {
    console.error(`\nfailed: ${failures.join(', ')}`);
  }
  // 全滅はネットワーク/CI異常の可能性が高いのでワークフローを失敗させる
  if (failures.length === targets.length) process.exit(1);
}

main();
