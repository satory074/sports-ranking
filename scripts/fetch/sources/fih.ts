import { COUNTRIES, codeByEnName } from '../../../src/countries';
import type { RankingEntry } from '../../../src/types';
import { fetchText } from '../lib';
import { fetchSportsRankingModule } from './wikipedia';

interface FihRank {
  rank: number;
  team_short_code: string;
  team: string; // 大文字表記 e.g. "BELGIUM"
  points: number;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** FIH 男子: ランキングページ埋め込みの window.outdoorRanking から取得 */
export async function fetchFihMen(): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const html = await fetchText('https://www.fih.hockey/outdoor-hockey-rankings');
  const idx = html.indexOf('window.outdoorRanking = ');
  if (idx < 0) throw new Error('FIH: window.outdoorRanking not found');
  const start = html.indexOf('{', idx);
  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const obj = JSON.parse(html.slice(start, end + 1)) as {
    outdoorRanking: { last_updated: string; ranks: FihRank[] };
    gender: string;
  };
  if (obj.gender !== 'm') throw new Error(`FIH: unexpected gender "${obj.gender}"`);
  const lu = obj.outdoorRanking.last_updated.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!lu) throw new Error(`FIH: cannot parse last_updated "${obj.outdoorRanking.last_updated}"`);
  const updatedAt = `${lu[3]}-${lu[1].padStart(2, '0')}-${lu[2].padStart(2, '0')}`;
  return {
    updatedAt,
    entries: obj.outdoorRanking.ranks.map((r) => ({
      rank: r.rank,
      code: r.team_short_code,
      name: COUNTRIES[r.team_short_code]?.en ?? titleCase(r.team),
      points: Math.round(r.points * 100) / 100,
      prevRank: null,
    })),
  };
}

/** FIH 女子: 埋め込みデータが男子のみのため Wikipedia モジュールから取得 */
export async function fetchFihWomen(): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const { updatedAt, rows } = await fetchSportsRankingModule("FIH Women's World Rankings");
  return {
    updatedAt,
    entries: rows.map((r) => ({
      rank: r.rank,
      code: codeByEnName(r.name) ?? r.name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8),
      name: r.name,
      points: r.points,
      prevRank: r.rank + r.movement,
    })),
  };
}
