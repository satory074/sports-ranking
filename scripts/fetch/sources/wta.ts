import type { RankingEntry } from '../../../src/types';
import { fetchJson } from '../lib';

interface WtaRanked {
  player: { id: number; fullName: string; countryCode: string };
  ranking: number;
  points: number;
  movement: number;
  rankedAt: string;
}

/** WTA 女子シングルスランキング。at 指定で過去時点も取得できる */
export async function fetchWta(
  at?: string,
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const url =
    'https://api.wtatennis.com/tennis/players/ranked?page=0&pageSize=100&type=rankSingles&sort=asc&metric=SINGLES' +
    (at ? `&at=${at}` : '');
  const d = await fetchJson<WtaRanked[]>(url);
  if (!Array.isArray(d) || d.length === 0) throw new Error('WTA: empty response');
  return {
    updatedAt: d[0].rankedAt.slice(0, 10),
    entries: d.map((r) => ({
      rank: r.ranking,
      code: String(r.player.id),
      name: r.player.fullName,
      points: r.points,
      prevRank: r.ranking + r.movement,
      nat: r.player.countryCode,
    })),
  };
}
