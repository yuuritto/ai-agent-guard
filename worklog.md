# Worklog — @entet/ai-agent-guard

書き込み専用。事故復旧のための記録で、普段は読み返さない。

## 2026-07-26 — 0.2.0（未公開）

- **エージェント権限設定の検査を移植**（有料プラグイン 2026.1.2/2026.1.3 と同じ差別化要素）。`.claude` / `.cursor` / `.vscode` / `.codex` / `.gemini` 配下の JSON を対象に、`enableAllProjectMcpServers` / `disableAllHooks` / 緩い `defaultMode` / 無制限 grant / 破壊的コマンドの事前承認 / HTTP フック / ワイルドカード hook URL / インライン secret を検出。commit `ea37499`。
  - プラグイン版が行ベース正規表現なのに対し、CLI は既にある `parseJsonLoose` を使い **`permissions.allow` を構造的に読む**。deny/ask の同じパターンを誤検知しない作りが自然に得られる。
  - `--dangerously-skip-permissions` は**実行される文脈**（`.sh`/`.bat`/`.ps1`・CI・`package.json`・Dockerfile・エージェント設定）でのみ検出。散文で言及しただけの `.md` は無視する。clean フィクスチャに「規約文書で flag に言及する `docs/security.md`」と「deny のみの `.claude/settings.json`」を追加し、**0件になること**を assert 済み。
- 🚨 **README の虚偽記載を修正**。「有料プラグインはエディタ内で継続的にチェックし、インライン強調・クイックフィックス・ワークスペース別ポリシーを提供する」と書かれていたが、**そのような機能は存在しない**。実際の挙動（Tools メニューからの明示スキャン → ツールウィンドウ表示・行ジャンプ・重大度フィルタ・Markdown 出力・`aiwg:ignore` 抑制）に書き換えた。
  - 初回リリース commit `046db6c` から入っていたため、**npm 0.1.1 と GitHub の公開 README に現在も掲載されている**。公開の是非はユーザー許可待ち。
- 検証: `node test/run.js` 34 チェック全通過（新規9＋deny 誤検知防止1）。実プロジェクト `project-tracker`（87ファイル）走査は `ai.instruction-file` の LOW 1件のみで、新ルール由来の誤検知ゼロ。
- version 0.1.1 → **0.2.0**。
- **未実施（要ユーザー許可）**: `git push`（GitHub の虚偽記載訂正）と `npm publish`（0.2.0 公開）。どちらも外部公開行為。
