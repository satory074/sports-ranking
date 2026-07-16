import type { RankingEntry } from '../../../src/types';
import { fetchJson, slugCode } from '../lib';

interface WrEntry {
  team: { name: string; abbreviation: string | null; countryCode: string | null };
  pts: number;
  pos: number;
  previousPts: number;
  previousPos: number;
}
interface WrResponse {
  label: string;
  entries: WrEntry[];
  effective: { label: string };
}

/** World Rugby ランキング。date 指定で過去の任意時点も取得できる */
export async function fetchRugby(
  type: 'mru' | 'wru',
  date?: string,
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const url =
    `https://api.wr-rims-prod.pulselive.com/rugby/v3/rankings/${type}?language=en` +
    (date ? `&date=${date}` : '');
  const d = await fetchJson<WrResponse>(url);
  return {
    updatedAt: d.effective.label,
    entries: d.entries.map((e) => ({
      rank: e.pos,
      code: e.team.abbreviation ?? e.team.countryCode ?? slugCode(e.team.name),
      name: e.team.name,
      points: Math.round(e.pts * 100) / 100,
      prevRank: e.previousPos > 0 ? e.previousPos : null,
    })),
  };
}
