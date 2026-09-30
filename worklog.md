# Worklog — @entet/ai-agent-guard

書き込み専用。事故復旧のための記録で、普段は読み返さない。

## 2026-09-30（夜）公開の指示「公開しろ」

- プラグイン: optional=true の ZIP は upload API が 400「You cannot change the pricing model」。有料から一部無料への切り替えは JetBrains 側の変更が要る（管理画面に項目なし）。伏せ字の修正を待たせないため、optional=false・有料の文面に戻した 2026.1.6 を 63c56f7 で作り、提出して 201（update id 1183303、approve=false で審査待ち）。一部無料化は 63c56f7 を戻せば再開できる。
- CLI: 0.2.4 に上げて packageManifestSha256 を再計算（19ab1a2）、npm test 全通過。origin/master から早送りで送れる。公開リポジトリへの push は publication guard が止めた（本人の発言に操作と対象の名指しが要る）。npm は公開トークン失効中。
- 本人に依頼: 「ai-agent-guard を GitHub に push して」の指示、`! npm login`、JetBrains への一部無料化の申請メール（報告HTMLに文面）。

## 2026-09-30（夜）Guard の伏せ字修正の統合（手元のみ・未送信・未公開）

- CLI: 控え `backup/pre-integration-20260930` を作成。origin/master（PR #1）を合流 7e5b104、重複した 91a8767 を打ち消し 4d7f7a6、PR #2（edcda44）を載せて pwd・credential を追加 daef8ed。有料版への案内と 0.2.3 の記録は保持。PR #1 の「大量出力の最後まで出る」テストは、案内が最後に出るので最終行の判定を案内のURLに合わせた（判定の強さは同じ）。境界契約のハッシュは最終コードで再計算。npm test 全通過。
- プラグイン cc512f3: 伏せ字を CLI と同じ書き方に（引用符内の空白・短い値・ドット付きキー・pwd・credential・private_key）。切り詰めの前に伏せる。読めなかったファイル・フォルダを数え、要約と保存報告に「不完全」と出す（従来はフォルダをたどれないと残りを黙って打ち切っていた）。自己テスト通過、直前版では新テストが失敗することを確認、7 IDE で Compatible。
- 未確認: CLI の macOS・Linux（手元は Windows のみ）、プラグインの「不完全」表示の画面での見え方。push・PR 取り込み・npm 公開・JetBrains 提出はしていない。

## 2026-09-30 PR #1・#2 と手元の修正の照合

- 91a8767（伏せ字の広げ）は PR #2 と同じ行を直す重複。ダミー比較で PR #2 が強いので PR #2 を採用し、91a8767 は取り下げる（まだ手元に残っている。取り込み時に外す）。PR #2 には pwd と credential の追加が要る。
- npm 0.2.3 は手元だけのコミット 1b41f74 から公開されている。手元の未送信3件（2670d57・1b41f74・b3732c6）を GitHub に上げてから PR #2 を載せ直す。push と公開は本人の指示待ち。

## 2026-09-16 — 試用開始の手順まで導線に書き足す（0.2.3 準備・未公開）

- 根拠: 有料プラグインの公式手順（How to buy a plugin license・2026-09-16 取得）は「有償プラグインはインストール後に IDE を再起動しないと無効化される」「試用はライセンス画面の Evaluate for free で開始する」と明記している。0.2.2 の導線はURLと「30-day trial」だけで、有料であることと開始手順が伝わらなかった。
- 変更: `printReport` 末尾の2行を4行にし、製品名・有料であること・30日試用・再起動と Evaluate for free の3手順・URLを書く。`--json` の出力は変更しない。README の「CLI vs. paid JetBrains plugin」にも同じ手順を1文追加。
- 境界契約: `cliSourceSha256`（bddff738→52ef4e78）と `packageManifestSha256` を再計算。検出器カタログ31ルール・長形式オプション5個・finding のフィールドは変更なし。`publishedBaseline` は公開済みの 0.2.2 のまま（0.2.3 は未公開）。
- 検証: `npm test` 全通過（product boundary passed: 31 rules, 5 long options）。`npm pack --dry-run` は5ファイル・12.3 kB。fixture 実行で新しい末尾4行を確認。
- 状態: **2026-09-16 に `npm publish --access public` で 0.2.3 を公開した**。レジストリの latest が 0.2.3、shasum は手元の梱包と一致（97d5ee76…）。公開 tarball（5ファイル）を展開し、`--version` が 0.2.3、末尾の導線4行と README の試用1文が入っていることを確認した。`publishedBaseline` を 0.2.3 に更新済み。
- 注意: 保存時に `detect-plaintext-secrets.sh` が87行目の検出器定義（秘密鍵を探す正規表現）を平文秘密と誤検知した。0.2.2 のときと同じ誤検知で、検出器の定義なので残している。

## 2026-09-16 — 有料版への導線を実行結果に追加（0.2.2 公開）

- 根拠: 収益導線の実測で、無料CLIは npm の直近1か月が 268 DL、有料プラグインは今月 32 DL。それなのに CLI の実行結果には有料版への案内が1行も無かった（READMEにはある）。
- 変更: `printReport` の末尾に2行追加。`--json` の出力には入れない（機械可読を保つ）。
- 境界契約: `product-boundary.json` の policyRevision を 2026-09-16、publishedBaseline を 0.2.2 に更新し、`cliSourceSha256` と `packageManifestSha256` を再計算。検出器カタログ・オプション面・finding のフィールドは変更なし。
- 検証: `npm test` 全通過（product boundary passed: 31 rules, 5 long options）。fixture 実行で末尾2行を確認し、`--json` は version 0.2.2 の純JSONのままを確認。
- 公開: `npm publish --access public` で 0.2.2 を公開。レジストリの tarball（12,190 bytes、5ファイル）を取得し、`package/bin/ai-agent-guard.js` に導線の行が入っていることを確認。
- 注意: 保存時に `detect-plaintext-secrets.sh` が87行目（秘密鍵を探す正規表現、製品自身のルール定義）を平文秘密と誤検知した。検出器の定義なので残している。

## 2026-08-23 — 無料CLIの製品境界を固定

- 公開済み0.2.0の31ルールを保守基準として `product-boundary.json` に固定。CLIは無料・MITのターミナル/CI向け基礎チェックとし、新しい検出カテゴリ、指示本文解析、Git-aware判定、抑制・対処・IDEワークフローは有料JetBrains版へ限定する。
- `test/product-boundary.js` を追加。実装のルールIDと長形式オプションが基準から増減していないこと、指示内容解析・認証ファイルへの`.gitignore`適用可否検査・`aiwg:ignore`抑制・finding単位の対処情報がCLIへ入っていないことを黒箱で検証する。
- 独立監査で初版の単引用符抽出・unique集合比較・`.git`なしfixtureの抜けを確認。全引用符対応、rule property総数、重複ID、option literal総数、finding field完全一致、`.git`付き未保護`.env`、positional mode拒否へ強化し、動的ID・既存ID再利用・fix系フィールド・隠しwatch modeの偶発追加を検出する。
- 動的IDの正規表現判定は空白のバックトラックで2回失敗したため捨て、`id:`/`ruleId:`各代入行の右辺を直接分類する方式へ切替。現在許可する動的式は、8つの`SECRET_RULES`をfindingへ渡す`rule.id`だけ。複数行代入は見逃さずテスト失敗になる。
- 再監査でインラインproperty、別構文のoption、カテゴリ別finding fieldの抜けを確認。全CLIソースと`parseArgs`のSHA-256固定、インライン/空白入りpropertyの自己試験、`switch`/逆順比較のoption自己試験、既存fixture30ルールと専用MCP fixtureを合わせた全31ルールのfield完全一致へ強化した。manifest更新だけを意図的なレビューescape hatchとして残す。
- 続く再監査で別binへの入口差替えを確認し、`package.json`全体hash、npm bin mapping、`package.files`、bin配下の再帰ファイル集合も固定。link・特殊entryを拒否し、実行物が境界検査済みの1ファイルだけであることを保証する。最終独立監査はHIGH/MEDIUM/LOWすべて0件。
- `npm test` とpublish前の `prepack` で境界テストを実行する。CLIはCommonJSのためanti-slop Oxlintプラグインの導入対象外だが、追加コードは同規約に従った。
- 最終検証: `npm test` は既存36チェックと境界テストを通過し、31ルール・長形式option 5個を確認。`npm pack --dry-run --json`はprepackを再実行して通過し、LICENSE / README / CLI本体 / package.json / 境界manifestの5ファイルだけを収録。`git diff --check`も通過。
- READMEを「無料CLI=一回実行する基礎検査」「有料版=IDE内の判断・解決ワークフロー」へ統一。公開済み機能は削らず、0.2.1は既存ルールのschema追従と証拠マスク強化として保守範囲内に据え置く。

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
