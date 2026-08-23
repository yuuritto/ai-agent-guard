# ai-agent-guard

Scan a local project for security risks **before** you point an AI coding agent at it.

AI coding agents (Claude Code, Cursor, Codex, Windsurf, …) read your whole repo and can execute commands, follow instruction files, and call MCP servers. A leaked key, an over-permissioned MCP config, or a hostile `CLAUDE.md` becomes the agent's problem the moment it starts. `ai-agent-guard` does a fast local pass and tells you what to look at first.

```
npx @entet/ai-agent-guard
```

No project install, config, or account. Requires Node.js 18 or newer. `npx` may
download the package from npm; the scanner itself does not make network calls.

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

Exit code is `0` when clean and `1` when there are findings, so it drops straight into CI:

```yaml
- run: npx @entet/ai-agent-guard
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

## Want this in your IDE?

This CLI is the free, open-source companion to the **AI Agent Workspace Guard** plugin for JetBrains IDEs. The products share several checks, but their rule sets are not identical: the IDE plugin also inspects instruction content for risky directives and warns about credential files that Git is not ignoring, while the CLI reports instruction-file presence for human review.

Run the IDE plugin from `Tools → Scan AI Agent Workspace`. Its results appear in a tool window grouped by severity, with line navigation, evidence and remediation guidance, a severity filter, and Markdown export. Known false positives can be silenced with an `aiwg:ignore` comment, and suppressed findings stay in the count.

➡️ https://plugins.jetbrains.com/plugin/32116-ai-agent-workspace-guard

## License

MIT — see [LICENSE](LICENSE).
