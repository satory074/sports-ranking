import { COUNTRIES } from '../../../src/countries';
import type { RankingEntry } from '../../../src/types';
import { fetchJson, fetchText } from '../lib';

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

/** 最新リリース日のランキングを取得 */
export async function fetchWbsc(
  sportId: string,
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const releases = await getWbscReleases();
  const dates = releases
    .filter((r) => r.sport === sportId)
    .map((r) => r.date)
    .sort();
  if (dates.length === 0) throw new Error(`WBSC: no releases for ${sportId}`);
  return fetchWbscAt(sportId, dates[dates.length - 1]);
}
