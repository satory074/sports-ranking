import { COUNTRIES, codeByEnName } from '../../../src/countries';
import type { RankingEntry } from '../../../src/types';
import { fetchJson, fetchText, readHistory, slugCode } from '../lib';
import { fetchSportsRankingModule } from './wikipedia';

export interface WbscRelease {
  date: string;
  sport: string;
  year: number;
}

let releasesCache: Promise<WbscRelease[]> | null = null;

/** ランキングページ埋め込みの `const releases = [...]` からリリース日一覧を得る */
export function getWbscReleases(): Promise<WbscRelease[]> {
  releasesCache ??= (async () => {
    const html = await fetchText('https://www.wbsc.org/en/rankings');
    const m = html.match(/const releases\s*=\s*(\[.*?\]);/s);
    if (!m) throw new Error('WBSC: releases array not found in page');
    return JSON.parse(m[1]) as WbscRelease[];
  })();
  return releasesCache;
}

interface WbscRanking {
  position: number;
  points: number;
  ioc: string;
  climber_release: number;
}

export async function fetchWbscAt(
  sportId: string,
  date: string,
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const d = await fetchJson<{ rankings: WbscRanking[] }>(
    `https://www.wbsc.org/api/v1/rankings/sport/show?sportId=${sportId}&date=${date}&fullView=true&lang=en`,
  );
  return {
    updatedAt: date,
    entries: d.rankings.map((r) => ({
      rank: r.position,
      code: r.ioc,
      name: COUNTRIES[r.ioc]?.en ?? r.ioc,
      points: r.points,
      prevRank: r.position + r.climber_release,
    })),
  };
}

/** wbsc.org がデータセンターIPを403で拒否した場合の Wikipedia フォールバック */
const WIKI_FALLBACK: Record<string, string> = {
  'baseball-m': 'WBSC World Rankings',
  'baseball-w': "WBSC Women's Baseball World Rankings",
  // softball-w は Wikipedia モジュールが存在しないためフォールバック不可
};

/** 最新リリース日のランキングを取得 */
export async function fetchWbsc(
  sportId: string,
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  try {
    const releases = await getWbscReleases();
    const dates = releases
      .filter((r) => r.sport === sportId)
      .map((r) => r.date)
      .sort();
    if (dates.length === 0) throw new Error(`WBSC: no releases for ${sportId}`);
    return await fetchWbscAt(sportId, dates[dates.length - 1]);
  } catch (err) {
    const moduleTitle = WIKI_FALLBACK[sportId];
    if (!moduleTitle) throw err;
    console.error(`${sportId}: wbsc.org failed (${(err as Error).message}); using Wikipedia`);
    const { updatedAt, rows } = await fetchSportsRankingModule(moduleTitle);
    // 既存履歴の英語名→IOCコードを最優先で使い、履歴とのキー不一致を防ぐ
    const byHistoryName = new Map<string, string>();
    for (const [code, name] of Object.entries(readHistory(sportId).names)) {
      byHistoryName.set(name.toLowerCase(), code);
    }
    return {
      updatedAt,
      entries: rows.map((r) => ({
        rank: r.rank,
        code:
          byHistoryName.get(r.name.toLowerCase()) ?? codeByEnName(r.name) ?? slugCode(r.name),
        name: r.name,
        points: r.points,
        prevRank: r.rank + r.movement,
      })),
    };
  }
}
