import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeByEnName } from '../../../src/countries';
import type { RankingEntry } from '../../../src/types';
import { fetchJson } from '../lib';
import { fetchSportsRankingModule } from './wikipedia';

/** バックフィル時に FIFA API から生成した FIFA表記名→FIFAコード のマップ */
const NAME_CODE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'fifa-name-code.json');

let nameCodeMap: Record<string, string> | null = null;
function fifaCode(name: string): string {
  if (nameCodeMap === null) {
    nameCodeMap = existsSync(NAME_CODE_PATH)
      ? (JSON.parse(readFileSync(NAME_CODE_PATH, 'utf8')) as Record<string, string>)
      : {};
  }
  return (
    nameCodeMap[name] ??
    codeByEnName(name) ??
    name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
  );
}

/**
 * FIFA 最新ランキング。2025年10月以降の新形式 dateId は
 * inside.fifa.com の API から取得できないため Wikipedia モジュールを使う。
 */
export async function fetchFifaCurrent(
  gender: 'men' | 'women',
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const moduleTitle =
    gender === 'men' ? 'FIFA World Rankings' : "FIFA Women's World Rankings";
  const { updatedAt, rows } = await fetchSportsRankingModule(moduleTitle);
  return {
    updatedAt,
    entries: rows.map((r) => ({
      rank: r.rank,
      code: fifaCode(r.name),
      name: r.name,
      points: r.points,
      prevRank: r.rank + r.movement,
    })),
  };
}

interface FifaApiRanking {
  rankingItem: {
    rank: number;
    name: string;
    countryCode: string;
    totalPoints: number;
    previousRank: number;
  };
  lastUpdateDate: string;
}

/** FIFA API(旧形式 dateId)から1リリース分を取得。バックフィル用 */
export async function fetchFifaAt(
  dateId: string,
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const d = await fetchJson<{ rankings: FifaApiRanking[] }>(
    `https://inside.fifa.com/api/ranking-overview?locale=en&dateId=${dateId}`,
  );
  if (!d.rankings.length) throw new Error(`FIFA: empty rankings for dateId=${dateId}`);
  return {
    updatedAt: d.rankings[0].lastUpdateDate.slice(0, 10),
    entries: d.rankings.map((r) => ({
      rank: r.rankingItem.rank,
      code: r.rankingItem.countryCode,
      name: r.rankingItem.name,
      points: r.rankingItem.totalPoints,
      prevRank: r.rankingItem.previousRank > 0 ? r.rankingItem.previousRank : null,
    })),
  };
}
