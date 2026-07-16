# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

各スポーツの国別世界ランキング(+WTA個人)を一覧・時系列チャートで表示する静的サイト。
GitHub Pages で公開: https://satory074.github.io/sports-ranking/

- **Stack**: Vite + vanilla TypeScript + ECharts(ツリーシェイク・遅延ロード)。フレームワークなし
- **データ**: リポジトリ内フラットJSON(git scraping パターン)。`public/data/{id}/latest.json`(テーブル用)+ `history.json`(チャート用・1スナップショット=1行で追記差分が小さい)
- **更新**: `.github/workflows/update-and-deploy.yml` が毎日 JST 6:43 に fetch → 差分があればコミット → build → Pages デプロイ(1本のワークフロー。GITHUB_TOKEN の push は他ワークフローを発火しないため分割禁止)

## Commands

```bash
npm run dev         # 開発サーバー
npm run build       # tsc --noEmit + vite build(型チェック兼ビルド)
npm run fetch-data  # 全14カテゴリの最新データ取得(引数でID絞り込み可)
npm run backfill    # 履歴の一括取得(fifa|rugby|wbsc|wta|all)。冪等・再実行安全
```

## Architecture

- `scripts/fetch/index.ts` — オーケストレーター。カテゴリID→フェッチャーの対応表。検証ゲート(件数下限・rank整合)を通過したものだけ保存
- `scripts/fetch/sources/*.ts` — ソース別フェッチャー
- `scripts/fetch/lib.ts` — fetch/検証/latest書き出し/history差分マージ。prevRank はソース未提供時に旧 latest から自動補完
- `scripts/backfill/*.ts` — 履歴一括取得(既存日付はスキップ)
- `src/main.ts` — タブ・ハッシュルーティング(`#/soccer-m`)・検索。ECharts は動的 import(初期バンドル 8KB gzip)
- `src/countries.ts` — IOC系コード→日本語名・国旗絵文字マスタ+英語名逆引き(Wikipedia由来データの解決に使用)

## データソースの注意点(2026-07 検証済み)

| ソース | 注意点 |
|---|---|
| FIFA | 2025/10以降の新形式 dateId (`FRS_*`) は API が空を返す → 最新値は Wikipedia の `Module:SportsRankings/data/*` (Lua) をパース。旧形式 (`id123`/`ranking_YYYYMMDD`) は1992年〜取得可(バックフィル用)。名前→コード変換は `scripts/fetch/fifa-name-code.json`(バックフィルが生成) |
| WBSC | bot系UAを403で拒否 → ブラウザUA必須。リリース日一覧はランキングページ埋め込みの `const releases = [...]` から。日付パラメータ必須 |
| World Rugby | `?date=` は **2013-10以降のみ有効**(それ以前は 2020-09-21 にフォールバック)。週次更新 |
| FIVB | 現在値のみ(日次更新)。gender: 1=男子, 0=女子 |
| FIBA | ランキングページの Next.js flight payload 内 `initialRanking`(エスケープJSON)を抽出 |
| FIH | 男子はページ埋め込み `window.outdoorRanking`。**女子はクライアントサイド取得のため不可 → Wikipedia モジュール使用** |
| WTA | `&at=YYYY-MM-DD` で過去取得可(2000年〜)。個人ランキングのため code=選手ID |

## 新競技の追加手順

1. `scripts/fetch/sources/` にフェッチャーを追加(`{updatedAt, entries}` を返す)
2. `scripts/fetch/categories.ts` にカテゴリ定義(id/表示名/minCount/出典)を追加
3. `scripts/fetch/index.ts` の `FETCHERS` に登録
4. `npm run fetch-data <id>` で動作確認(履歴は自動で蓄積開始)

## Gotchas

- GitHub Pages のサブパス対応: fetch は必ず `src/data.ts` 経由(`import.meta.env.BASE_URL`)。絶対パス `/data/...` は本番で404
- `history.json` の直接編集時は 1スナップショット=1行 の形式を維持(git差分のため)
- ストレッチ候補(未実装): 卓球(WTT は APIキー抽出が必要)、ATPテニス・バドミントン(Cloudflare)、ハンドボール(PDFのみ)
