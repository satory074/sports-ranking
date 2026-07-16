import { mergeHistorySnapshot, readHistory, sleep } from '../fetch/lib';
import { fetchRugby } from '../fetch/sources/rugby';

/** 月初日の一覧(YYYY-MM-01)を生成 */
function monthlyDates(fromYear: number, fromMonth: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let y = fromYear; y <= now.getUTCFullYear(); y++) {
    for (let m = y === fromYear ? fromMonth : 1; m <= 12; m++) {
      if (y === now.getUTCFullYear() && m > now.getUTCMonth() + 1) break;
      out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    }
  }
  return out;
}

/**
 * World Rugby ランキング履歴を月次サンプリングで取得。
 * API は date 指定でその時点の有効ランキングを返す(週次更新だが月次で十分)。
 */
export async function backfillRugby(): Promise<void> {
  const targets = [
    { id: 'rugby-m', type: 'mru' as const, from: [2003, 10] as const },
    { id: 'rugby-w', type: 'wru' as const, from: [2016, 1] as const },
  ];
  for (const t of targets) {
    const have = new Set(
      readHistory(t.id).snapshots.map((s) => s.date.slice(0, 7)), // 月単位で重複判定
    );
    const dates = monthlyDates(t.from[0], t.from[1]).filter((d) => !have.has(d.slice(0, 7)));
    console.log(`${t.id}: fetching ${dates.length} monthly snapshots`);
    let done = 0;
    for (const date of dates) {
      try {
        const snap = await fetchRugby(t.type, date);
        if (snap.entries.length > 0) {
          mergeHistorySnapshot(t.id, snap.updatedAt, snap.entries);
          done++;
        }
      } catch (err) {
        console.error(`${t.id} ${date}: ${(err as Error).message}`);
      }
      await sleep(150);
      if (done % 25 === 0 && done > 0) console.log(`${t.id}: ${done} fetched...`);
    }
    console.log(`${t.id}: backfilled ${done} snapshots`);
  }
}
