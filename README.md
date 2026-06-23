# ai-agent-guard

Scan a local project for security risks **before** you point an AI coding agent at it.

AI coding agents (Claude Code, Cursor, Codex, Windsurf, …) read your whole repo and can execute commands, follow instruction files, and call MCP servers. A leaked key, an over-permissioned MCP config, or a hostile `CLAUDE.md` becomes the agent's problem the moment it starts. `ai-agent-guard` does a fast local pass and tells you what to look at first.

```
npx ai-agent-guard
```

No install, no config, no account.

## What it checks

| Category | Examples |
|---|---|
| **Secrets** | AWS keys (`AKIA…`), GitHub tokens (`ghp_/gho_/ghs_/ghu_/ghr_/github_pat_`), Stripe live keys (`sk_live_`), OpenAI / Anthropic keys, private key blocks, DB URLs with embedded credentials, hardcoded `api_key = "…"` assignments |
| **MCP configs** | `mcp.json`, `.mcp.json`, `claude_desktop_config.json` — unpinned `npx`, root/home filesystem access, inline secrets in `env` |
| **AI instruction files** | `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.cursorrules`, `.windsurfrules`, `gemini.md`, `copilot-instructions.md` — flagged so you can review them for prompt-injection or risky directives |
| **GitHub Actions** | `pull_request_target` + checkout, `write-all` permissions, untrusted `github.event.*` interpolated into shell steps |
| **package.json scripts** | `postinstall`/`prepare` piping `curl \| bash`, unpinned `npx` in lifecycle scripts |
| **n8n workflows** | webhook nodes without authentication, code nodes using `exec`/`eval`/`fs`, inline credentials |

## Usage

```bash
# scan the current directory
npx ai-agent-guard

# scan a specific path
npx ai-agent-guard --path ./my-repo

# machine-readable output (for CI)
npx ai-agent-guard --json

# disable colors
npx ai-agent-guard --no-color
```

Exit code is `0` when clean and `1` when there are findings, so it drops straight into CI:

```yaml
- run: npx ai-agent-guard
```

Example output:

```
  AI Agent Guard  v0.1.0
  scanned: /home/me/my-repo

  CRITICAL
    ● .env:3  [secret.aws-access-key]
      AWS access key ID
      evidence: AKIA****************WXYZ

  HIGH
    ● .mcp.json:5  [mcp.unpinned-npx]
      MCP server "fs" runs npx without a pinned version
      evidence: npx ****************r-fs

  ────────────────────────────────────────────────
  files scanned: 142    skipped: 6
  findings: 1 critical  1 high  0 medium  0 low
```

## Private by design

Runs entirely on your machine. **No network calls, no API key, no telemetry.** The source is a single dependency-free file — read it: [`bin/ai-agent-guard.js`](bin/ai-agent-guard.js). Evidence is masked in output (first 4 and last 4 characters only).

## Want this in your IDE?

This CLI is the free, open-source companion to the **AI Agent Workspace Guard** plugin for JetBrains IDEs, which runs these checks continuously inside your editor with inline highlighting, quick-fixes, and per-workspace policy:

➡️ https://plugins.jetbrains.com/plugin/32116-ai-agent-workspace-guard

## License

MIT — see [LICENSE](LICENSE).
