import { mergeHistorySnapshot, readHistory, sleep } from '../fetch/lib';
import { fetchWbscAt, getWbscReleases } from '../fetch/sources/wbsc';

/** WBSC の全リリース(2012年〜)を履歴に取り込む */
export async function backfillWbsc(): Promise<void> {
  const releases = await getWbscReleases();
  const targets = [
    { id: 'baseball-m', sport: 'baseball-m' },
    { id: 'baseball-w', sport: 'baseball-w' },
    { id: 'softball-w', sport: 'softball-w' },
  ];
  for (const t of targets) {
    const have = new Set(readHistory(t.id).snapshots.map((s) => s.date));
    const dates = releases
      .filter((r) => r.sport === t.sport)
      .map((r) => r.date)
      .filter((d) => !have.has(d))
      .sort();
    console.log(`${t.id}: fetching ${dates.length} releases`);
    let done = 0;
    for (const date of dates) {
      try {
        const snap = await fetchWbscAt(t.sport, date);
        if (snap.entries.length > 0) {
          mergeHistorySnapshot(t.id, snap.updatedAt, snap.entries);
          done++;
        }
      } catch (err) {
        console.error(`${t.id} ${date}: ${(err as Error).message}`);
      }
      await sleep(200);
    }
    console.log(`${t.id}: backfilled ${done} releases`);
  }
}
