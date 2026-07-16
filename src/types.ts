/** 1チーム(または選手)の最新ランキング行 */
export interface RankingEntry {
  rank: number;
  /** 履歴キー。国別ランキングはIOC系3文字コード、個人ランキングは選手ID */
  code: string;
  name: string;
  points: number | null;
  prevRank: number | null;
  /** 個人ランキングのみ: 国籍コード(旗表示用) */
  nat?: string;
}

export interface LatestFile {
  id: string;
  updatedAt: string; // YYYY-MM-DD(ランキング発表日)
  entries: RankingEntry[];
}

export interface HistorySnapshot {
  date: string; // YYYY-MM-DD
  ranks: Record<string, number>;
}

export interface HistoryFile {
  id: string;
  names: Record<string, string>;
  snapshots: HistorySnapshot[]; // 日付昇順
}

export interface CategoryMeta {
  id: string;
  /** 競技名(日本語) */
  sport: string;
  /** 区分: 男子/女子 など */
  category: string;
  entity: 'country' | 'player';
  /** データソース表示名 */
  source: string;
  /** 出典リンク */
  sourceUrl: string;
  /** 追加の帰属表示(Wikipedia CC BY-SA など) */
  license?: string;
}

export interface IndexCategory extends CategoryMeta {
  updatedAt: string;
  count: number;
}

export interface IndexFile {
  generatedAt: string;
  categories: IndexCategory[];
}
