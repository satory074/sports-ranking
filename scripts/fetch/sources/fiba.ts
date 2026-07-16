import type { RankingEntry } from '../../../src/types';
import { fetchText, slugCode } from '../lib';

interface FibaItem {
  worldRank: number;
  countryName: string;
  iocCode: string | null;
  fibaCode?: string | null;
  currentPoints: number;
  worldRankVariation: number | null;
}

/** 開き括弧から対応する閉じ括弧までを切り出す */
function extractBalanced(text: string, from: number): string {
  const start = text.indexOf('{', from);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces');
}

/**
 * FIBA ランキングページの Next.js flight payload に埋め込まれた
 * initialRanking(エスケープ済みJSON)を抽出する。
 */
export async function fetchFiba(
  gender: 'men' | 'women',
): Promise<{ updatedAt: string; entries: RankingEntry[] }> {
  const html = await fetchText(`https://www.fiba.basketball/en/ranking/${gender}`);
  const idx = html.indexOf('initialRanking');
  if (idx < 0) throw new Error('FIBA: initialRanking not found');
  const raw = extractBalanced(html, html.indexOf(':', idx) + 1);
  const obj = JSON.parse(raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')) as {
    asOfDate: string;
    items: FibaItem[];
  };
  return {
    updatedAt: obj.asOfDate.slice(0, 10),
    entries: obj.items.map((it) => ({
      rank: it.worldRank,
      code: it.iocCode ?? it.fibaCode ?? slugCode(it.countryName),
      name: it.countryName,
      points: it.currentPoints,
      prevRank: it.worldRankVariation != null ? it.worldRank + it.worldRankVariation : null,
    })),
  };
}
