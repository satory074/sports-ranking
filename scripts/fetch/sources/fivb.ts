import type { RankingEntry } from '../../../src/types';
import { fetchJson } from '../lib';

interface FivbTeam {
  isDuplicateRanking: boolean;
  federationCode: string;
  name: string;
  decimalPoints: number;
  rank: number;
}
interface FivbResponse {
  date: string; // "16 Jul 2026 - 01:41 pm UTC"
  teams: FivbTeam[];
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

export async function fetchFivb(
  gender: 'm' | 'w',
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const g = gender === 'm' ? 1 : 0;
  const d = await fetchJson<FivbResponse>(
    `https://en.volleyballworld.com/api/v1/worldranking/volleyball/${g}/0/500`,
  );
  const dm = d.date.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})/);
  if (!dm || !MONTHS[dm[2]]) throw new Error(`FIVB: cannot parse date "${d.date}"`);
  const updatedAt = `${dm[3]}-${MONTHS[dm[2]]}-${dm[1].padStart(2, '0')}`;
  return {
    updatedAt,
    entries: d.teams
      .filter((t) => !t.isDuplicateRanking)
      .map((t) => ({
        rank: t.rank,
        code: t.federationCode,
        name: t.name,
        points: t.decimalPoints,
        prevRank: null, // 前回値は保存済み latest.json から補完される
      })),
  };
}
