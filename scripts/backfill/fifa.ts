import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJson, fetchText, mergeHistorySnapshot, readHistory, sleep } from '../fetch/lib';
import { fetchFifaAt } from '../fetch/sources/fifa';

const NAME_CODE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fetch',
  'fifa-name-code.json',
);

interface FifaDate {
  id: string;
  date: string;
}

async function getBuildId(): Promise<string> {
  const html = await fetchText('https://inside.fifa.com/fifa-world-ranking/men');
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('FIFA: buildId not found');
  return m[1];
}

async function getDates(buildId: string, gender: 'men' | 'women'): Promise<FifaDate[]> {
  const d = await fetchJson<{
    pageProps: { pageData: { ranking: { allAvailableDates: FifaDate[] } } };
  }>(`https://inside.fifa.com/_next/data/${buildId}/en/fifa-world-ranking/${gender}.json`);
  return d.pageProps.pageData.ranking.allAvailableDates;
}

/**
 * FIFA API(旧形式 dateId)で取得できる全リリースを履歴に取り込む。
 * 2025/10 以降の FRS_* 形式は API が空を返すためスキップされる。
 * 併せて FIFA表記名→コード のマップを生成する(Wikipedia 由来の最新値の解決に使用)。
 */
export async function backfillFifa(): Promise<void> {
  const buildId = await getBuildId();
  const nameCode: Record<string, string> = existsSync(NAME_CODE_PATH)
    ? (JSON.parse(readFileSync(NAME_CODE_PATH, 'utf8')) as Record<string, string>)
    : {};

  for (const gender of ['men', 'women'] as const) {
    const id = gender === 'men' ? 'soccer-m' : 'soccer-w';
    const dates = (await getDates(buildId, gender))
      .filter((d) => /^(id|ranking_)\d+$/.test(d.id))
      .reverse(); // 古い順
    const have = new Set(readHistory(id).snapshots.map((s) => s.date));
    console.log(`${id}: ${dates.length} releases available, ${have.size} already stored`);

    let done = 0;
    for (const d of dates) {
      if (have.has(d.date)) continue;
      try {
        const snap = await fetchFifaAt(d.id);
        mergeHistorySnapshot(id, snap.updatedAt, snap.entries);
        for (const e of snap.entries) nameCode[e.name] = e.code;
        done++;
        if (done % 25 === 0) console.log(`${id}: ${done} fetched...`);
      } catch (err) {
        console.error(`${id} ${d.id} (${d.date}): ${(err as Error).message}`);
      }
      await sleep(120);
    }
    console.log(`${id}: backfilled ${done} releases`);
  }

  writeFileSync(NAME_CODE_PATH, JSON.stringify(nameCode, null, 2) + '\n');
  console.log(`fifa-name-code.json: ${Object.keys(nameCode).length} names`);
}
