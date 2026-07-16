import { fetchText } from '../lib';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export interface WikiRankingRow {
  name: string;
  rank: number;
  movement: number;
  points: number | null;
}

/**
 * Wikipedia の Module:SportsRankings/data/* (Lua) をパースする。
 * 形式: data.updated = { day=11, month='June', year=2026 } /
 *       data.rankings = { { "Argentina", 1, 2, 1877.27 }, ... }
 */
export async function fetchSportsRankingModule(
  moduleTitle: string,
): Promise<{ updatedAt: string; rows: WikiRankingRow[] }> {
  const url = `https://en.wikipedia.org/wiki/Module:SportsRankings/data/${encodeURIComponent(
    moduleTitle.replace(/ /g, '_'),
  )}?action=raw`;
  const lua = await fetchText(url);

  const updatedBlock = lua.match(/data\.updated\s*=\s*\{([^}]*)\}/);
  if (!updatedBlock) throw new Error(`${moduleTitle}: data.updated not found`);
  const day = updatedBlock[1].match(/day\s*=\s*(\d+)/)?.[1];
  const monthName = updatedBlock[1].match(/month\s*=\s*'([^']+)'/)?.[1];
  const year = updatedBlock[1].match(/year\s*=\s*(\d+)/)?.[1];
  const month = monthName ? MONTHS[monthName.toLowerCase()] : undefined;
  if (!day || !month || !year) throw new Error(`${moduleTitle}: cannot parse updated date`);
  const updatedAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const rankingsIdx = lua.indexOf('data.rankings');
  if (rankingsIdx < 0) throw new Error(`${moduleTitle}: data.rankings not found`);
  const body = lua.slice(rankingsIdx);
  const rows: WikiRankingRow[] = [];
  const re = /\{\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(-?\d+)\s*(?:,\s*(-?[\d.]+)\s*)?\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    rows.push({
      name: m[1],
      rank: Number(m[2]),
      movement: Number(m[3]),
      points: m[4] != null ? Number(m[4]) : null,
    });
  }
  return { updatedAt, rows };
}
