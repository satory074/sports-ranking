# スポーツ世界ランキング

各スポーツの国別世界ランキングを一覧・時系列チャートで閲覧できるサイト。

**https://satory074.github.io/sports-ranking/**

## 収録ランキング(14カテゴリ)

| 競技 | 区分 | 出典 |
|---|---|---|
| サッカー | 男子・女子 | FIFA World Ranking |
| 野球 | 男子・女子 | WBSC World Rankings |
| ソフトボール | 女子 | WBSC World Rankings |
| バレーボール | 男子・女子 | FIVB World Ranking |
| バスケットボール | 男子・女子 | FIBA World Ranking |
| ラグビー | 男子・女子 | World Rugby Rankings |
| ホッケー | 男子・女子 | FIH World Rankings |
| テニス | 女子シングルス(個人) | WTA Rankings |

データは GitHub Actions で毎日自動更新され、リポジトリ内の JSON に履歴が蓄積されます
(履歴APIを持つソースは過去分もバックフィル済み: サッカー1992年〜、テニス2000年〜、ラグビー2013年〜、野球2012年〜)。

## 開発

```bash
npm install
npm run dev         # 開発サーバー
npm run build       # 本番ビルド
npm run fetch-data  # ランキングデータ更新
```

## クレジット

順位・ポイントは各連盟の公表値です。サッカーの最新値およびホッケー女子は
[Wikipedia Module:SportsRankings](https://en.wikipedia.org/wiki/Module:SportsRankings)(CC BY-SA 4.0)のデータを利用しています。
