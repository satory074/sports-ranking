import { mergeHistorySnapshot, readHistory, sleep } from '../fetch/lib';
import { fetchWta } from '../fetch/sources/wta';

function monthlyDates(fromYear: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let y = fromYear; y <= now.getUTCFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === now.getUTCFullYear() && m > now.getUTCMonth() + 1) break;
      out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    }
  }
  return out;
}

/** WTA ランキング履歴を月次サンプリングで取得(at= パラメータ) */
export async function backfillWta(): Promise<void> {
  const id = 'tennis-wta';
  // rankedAt が実際の発表日になるため月単位で重複判定
  const have = new Set(readHistory(id).snapshots.map((s) => s.date.slice(0, 7)));
  const dates = monthlyDates(2000).filter((d) => !have.has(d.slice(0, 7)));
  console.log(`${id}: fetching up to ${dates.length} monthly snapshots`);
  let done = 0;
  for (const date of dates) {
    try {
      const snap = await fetchWta(date);
      // at=指定日以前の直近ランキングが返る。月がずれる場合はそのまま実日付で保存
      if (snap.entries.length > 0) {
        mergeHistorySnapshot(id, snap.updatedAt, snap.entries);
        done++;
      }
    } catch (err) {
      console.error(`${id} ${date}: ${(err as Error).message}`);
    }
    await sleep(150);
    if (done % 25 === 0 && done > 0) console.log(`${id}: ${done} fetched...`);
  }
  console.log(`${id}: backfilled ${done} snapshots`);
}
