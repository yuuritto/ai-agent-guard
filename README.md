# ai-agent-guard

Scan a local project for security risks **before** you point an AI coding agent at it.

AI coding agents (Claude Code, Cursor, Codex, Windsurf, …) can read project files, execute commands, follow instruction files, and call MCP servers. A leaked key or an over-permissioned MCP config can become part of that working context. `ai-agent-guard` does a fast local pass and tells you what to look at first.

```
npx @entet/ai-agent-guard
```

No project install, config, or account. Requires Node.js 18 or newer. `npx` may
download the package from npm; the scanner itself does not make network calls.

## Scope and maintenance policy

This CLI is the free, MIT-licensed terminal and CI preflight. Its detector catalog is frozen at the
31 rules published in 0.2.0. Maintenance releases may fix false positives, follow current schemas,
improve evidence masking, or preserve compatibility; new detector categories and interactive
resolution features go to the paid JetBrains plugin.

The boundary is enforced by `product-boundary.json` and the test suite. Existing public behavior
remains supported instead of being removed from users who already rely on it.

## What it checks

| Category | Examples |
|---|---|
| **Agent permission settings** | `.claude/`, `.cursor/`, `.vscode/`, `.codex/` settings — every project MCP server approved automatically, unbounded `Bash(*)`/`Read(~/**)` grants, pre-approved `sudo`/`rm`/`curl`, hooks that POST your session to an HTTP endpoint, wildcard hook URLs, disabled hooks, relaxed default modes, inline secrets, and `--dangerously-skip-permissions` |
| **Secrets** | AWS keys (`AKIA…`), GitHub tokens (`ghp_/gho_/ghs_/ghu_/ghr_/github_pat_`), Stripe live keys (`sk_live_`), OpenAI / Anthropic keys, private key blocks, DB URLs with embedded credentials, hardcoded `api_key = "…"` assignments |
| **MCP configs** | `mcp.json`, `.mcp.json`, `claude_desktop_config.json` — unpinned `npx`, root/home filesystem access, inline secrets in `env` |
| **AI instruction files** | `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.cursorrules`, `.windsurfrules`, `gemini.md`, `copilot-instructions.md` — flagged so you can review them for prompt-injection or risky directives |
| **GitHub Actions** | `pull_request_target` + checkout, `write-all` permissions, untrusted `github.event.*` interpolated into shell steps |
| **package.json scripts** | `postinstall`/`prepare` piping `curl \| bash`, unpinned `npx` in lifecycle scripts |
| **n8n workflows** | webhook nodes without authentication, code nodes using `exec`/`eval`/`fs`, inline credentials |

## Usage

```bash
# scan the current directory
npx @entet/ai-agent-guard

# scan a specific path
npx @entet/ai-agent-guard --path ./my-repo

# machine-readable output (for CI)
npx @entet/ai-agent-guard --json

# disable colors
npx @entet/ai-agent-guard --no-color
```

Exit code is `0` when no findings were detected, `1` when there are findings, and `2` for an invalid scan path. Existing exit codes are unchanged; incomplete scans are reported separately:

```yaml
- run: npx @entet/ai-agent-guard
```

### Scan coverage

JSON includes `scanComplete` and `coverage` counts. An unreadable directory or file,
a file larger than 512 KiB, or a line longer than 4,000 characters makes
`scanComplete` false. Long lines are skipped by secret matching; other applicable
file checks still run. `filesSkipped` remains the number of skipped files and does
not include unreadable directories or partially scanned lines.

Coverage is relative to the scanner's scope, not a guarantee that a project is safe.
Binary files (a NUL byte in the first 4,096 bytes), symbolic links, and these excluded
directories are counted separately and do not make `scanComplete` false:
`.git`, `node_modules`, `.venv`, `venv`, `dist`, `build`, `.next`, `.nuxt`, `coverage`,
`target`, `out`, `.turbo`, `.cache`. Excluded directories are not traversed, so their
contents are not counted. JSON config checks require parseable JSON.

For CI that must reject incomplete scans, use the JSON result as well as the exit
code (Bash example using this checkout; these coverage fields are not yet in npm 0.2.3):

```bash
status=0
node bin/ai-agent-guard.js --json > guard-report.json || status=$?
node -e 'const r=require("./guard-report.json"); if(r.scanComplete !== true) process.exit(2)'
coverage_status=$?
if [ "$status" -ne 0 ]; then exit "$status"; fi
exit "$coverage_status"
```

Example output:

```
  AI Agent Guard  v0.2.1
  scanned: /home/me/my-repo

  CRITICAL
    ● .env:3  [secret.aws-access-key]
      AWS access key ID
      evidence: AKIA****************

  HIGH
    ● .mcp.json:5  [mcp.unpinned-npx]
      MCP server "fs" runs npx without a pinned version
      evidence: npx ****************************

  ────────────────────────────────────────────────
  files scanned: 142    skipped: 6
  findings: 1 critical  1 high  0 medium  0 low
```

## Private by design

Runs entirely on your machine. **The scanner makes no network calls, needs no API key, and sends no telemetry.** The source is a single dependency-free file — read it: [`bin/ai-agent-guard.js`](bin/ai-agent-guard.js). Secret-shaped values found in any evidence field are masked: the first 4 characters of each match are retained and the remainder is replaced with asterisks. Other command or source excerpts may still be sensitive, so review the report before sharing it.

## CLI vs. paid JetBrains plugin

Use this free CLI for a portable one-shot terminal or CI check. Use the paid **AI Agent Workspace Guard** plugin when you want to review and resolve findings inside a JetBrains IDE. The products share several checks, but their rule sets are not identical: the plugin also inspects instruction content for risky directives and checks whether credential files are covered by `.gitignore`, while the CLI reports instruction-file presence for human review.

Run the IDE plugin from `Tools → Scan AI Agent Workspace`. Its results appear in a tool window grouped by severity, with line navigation, evidence and remediation guidance, a severity filter, and Markdown export. Known false positives can be silenced with an `aiwg:ignore` comment, and suppressed findings stay in the count.

The JetBrains plugin is a separate paid product with a 30-day trial. It is not this rule set with a graphical wrapper.

➡️ https://plugins.jetbrains.com/plugin/32116-ai-agent-workspace-guard

## License

MIT — see [LICENSE](LICENSE).
