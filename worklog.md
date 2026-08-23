# Worklog — @entet/ai-agent-guard

書き込み専用。事故復旧のための記録で、普段は読み返さない。

## 2026-08-23 — 0.2.1（未公開）— 現行HTTP hook構造の検出

- CLI特化の記事作成時に README と 0.2.0 実装を再照合し、出力例が旧版 `0.1.0` のまま、証拠マスクが「先頭4＋末尾4」と誤記されている2件を確認。出力例は今回のpatch版 `0.2.1` へ更新し、マスク説明は実装どおり先頭4文字以外をアスタリスクへ置換する内容に修正。
- 「No install」を、Node.js 18+ が必要・プロジェクトへのインストールは不要・`npx` のパッケージ取得は通信するがスキャナー本体は通信しない、という実態へ明確化。
- JetBrains版を「Same checks」とした機能混同を修正。重なる検査はあるが、JetBrains版には指示内容の危険パターン検査とGit未保護の認証ファイル検査があり、CLIの指示ファイル検査は存在通知だけである差を明記。
- 独立レビューで、HTTP hook 検出が旧来の直接配列要素しか見ず、現行公式構造（matcher配下の `hooks` 配列）を取りこぼすことを確認。直接要素とネストしたhandlerの両方を走査し、公式構造の専用fixture・回帰チェックを追加。
- 秘密ルール以外の検出結果が同じ行の秘密らしい値を生のまま証拠へ含め得たため、全findingの証拠を出力前に中央サニタイズするよう修正。別ルールが同じ行を報告する交差ケースの回帰チェックを追加。
- 検証: `npm test` 36チェック、`npm run selftest`、構文検査、clean fixture、終了コード0/1/2を通過。`npm pack --dry-run` はLICENSE / README / bin / package.jsonの4ファイルだけを収録。
- patch版を `0.2.1` へ更新。公開npm版はまだ `0.2.0`。公開リポジトリへのpushとnpm publishは現セッション許可がないため未実施。

## 2026-07-26 — 0.2.0（未公開）

- **エージェント権限設定の検査を移植**（有料プラグイン 2026.1.2/2026.1.3 と同じ差別化要素）。`.claude` / `.cursor` / `.vscode` / `.codex` / `.gemini` 配下の JSON を対象に、`enableAllProjectMcpServers` / `disableAllHooks` / 緩い `defaultMode` / 無制限 grant / 破壊的コマンドの事前承認 / HTTP フック / ワイルドカード hook URL / インライン secret を検出。commit `ea37499`。
  - プラグイン版が行ベース正規表現なのに対し、CLI は既にある `parseJsonLoose` を使い **`permissions.allow` を構造的に読む**。deny/ask の同じパターンを誤検知しない作りが自然に得られる。
  - `--dangerously-skip-permissions` は**実行される文脈**（`.sh`/`.bat`/`.ps1`・CI・`package.json`・Dockerfile・エージェント設定）でのみ検出。散文で言及しただけの `.md` は無視する。clean フィクスチャに「規約文書で flag に言及する `docs/security.md`」と「deny のみの `.claude/settings.json`」を追加し、**0件になること**を assert 済み。
- 🚨 **README の虚偽記載を修正**。「有料プラグインはエディタ内で継続的にチェックし、インライン強調・クイックフィックス・ワークスペース別ポリシーを提供する」と書かれていたが、**そのような機能は存在しない**。実際の挙動（Tools メニューからの明示スキャン → ツールウィンドウ表示・行ジャンプ・重大度フィルタ・Markdown 出力・`aiwg:ignore` 抑制）に書き換えた。
  - 初回リリース commit `046db6c` から入っていたため、**npm 0.1.1 と GitHub の公開 README に現在も掲載されている**。公開の是非はユーザー許可待ち。
- 検証: `node test/run.js` 34 チェック全通過（新規9＋deny 誤検知防止1）。実プロジェクト `project-tracker`（87ファイル）走査は `ai.instruction-file` の LOW 1件のみで、新ルール由来の誤検知ゼロ。
- version 0.1.1 → **0.2.0**。
- ✅ **公開完了**（ユーザー明示許可「やれ」）:
  - `git push origin master` → GitHub 反映を **local HEAD == remote master（`efd6562`）** と、公開 README から虚偽記載が消えたこと（`gh api` 経由の grep が 0 件）で実測確認。
  - `npm publish` → `npm view @entet/ai-agent-guard version` が **0.2.0**。tarball は 4 ファイル（LICENSE / README / bin / package.json）でテストフィクスチャの混入なし。
  - 受け手経路の実測: `npx --yes @entet/ai-agent-guard --path <demo>` で **v0.2.0** が起動し、`agent.skip-permissions` / `agent.auto-approve-mcp` / `agent.unbounded-permission` / `agent.dangerous-permission` などを正しい行番号で検出することを確認。
- ⚠️ **npx で一度失敗したが原因は npm キャッシュ**。publish 直後に npx が取得に失敗し、その失敗結果をキャッシュしたため `'ai-agent-guard' は認識されていません` が出続けた。切り分け: 0.1.1 は npx で動く / 無関係パッケージも npx で動く / `npm install` 直後のローカル shim は動く → パッケージ側の欠陥ではないと確定。`npm cache clean --force` と `_npx` 削除で解消。**publish 直後の npx 失敗はキャッシュを疑う**。
- ℹ️ 抑制機構（`aiwg:ignore`）は **CLI には入れていない**。有料プラグイン側の機能として残す意図的な差。デモの `# aiwg:ignore` 付き行も CLI では検出される（仕様どおり）。
