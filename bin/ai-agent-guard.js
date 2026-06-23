#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = require('../package.json').version;

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.venv', 'venv', 'dist', 'build',
  '.next', '.nuxt', 'coverage', 'target', 'out', '.turbo', '.cache',
]);

const MAX_FILE_SIZE = 512 * 1024;
const BINARY_SNIFF_BYTES = 4096;

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const COLORS = {
  CRITICAL: '\x1b[31m',
  HIGH: '\x1b[33m',
  MEDIUM: '\x1b[34m',
  LOW: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

function supportsColor() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY === true;
}

let useColor = supportsColor();

function color(name, text) {
  if (!useColor) return text;
  return (COLORS[name] || '') + text + COLORS.reset;
}

function mask(value) {
  const v = String(value).trim();
  if (v.length <= 8) return '*'.repeat(v.length);
  return v.slice(0, 4) + '*'.repeat(v.length - 4);
}

// --- Secret rules (regex matched against each line) ---
// patterns mirror the AI Agent Workspace Guard JetBrains plugin.
const SECRET_RULES = [
  {
    id: 'secret.aws-access-key',
    description: 'AWS access key ID',
    severity: 'CRITICAL',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: 'secret.github-token',
    description: 'GitHub token',
    severity: 'CRITICAL',
    regex: /\b(?:ghp|gho|ghs|ghu|ghr|github_pat)_[A-Za-z0-9_]{36,}\b/,
  },
  {
    id: 'secret.stripe-live-key',
    description: 'Stripe live secret key',
    severity: 'CRITICAL',
    regex: /\bsk_live_[A-Za-z0-9]{16,}\b/,
  },
  {
    id: 'secret.anthropic-key',
    description: 'Anthropic API key',
    severity: 'CRITICAL',
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'secret.openai-key',
    description: 'OpenAI API key',
    severity: 'CRITICAL',
    regex: /\bsk-(?!ant-)(?:proj-|live_test_|org-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'secret.private-key',
    description: 'Private key material',
    severity: 'CRITICAL',
    regex: /-----BEGIN(?:\s+[A-Z0-9]+)*\s+PRIVATE KEY-----/,
  },
  {
    id: 'secret.db-url-credentials',
    description: 'Database URL with embedded credentials',
    severity: 'HIGH',
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:/@]+:[^\s:/@]+@[^\s/]+/,
  },
  {
    id: 'secret.generic-assignment',
    description: 'Hardcoded secret assignment',
    severity: 'MEDIUM',
    regex: /\b(?:api[_-]?key|secret|token|passwd|password|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i,
  },
];

// Placeholder-ish values to suppress generic-assignment noise.
const PLACEHOLDER_RE = /^(?:x{3,}|\.{3,}|<[^>]+>|\$\{[^}]+\}|your[_-]|changeme|example|placeholder|todo|null|true|false|process\.env)/i;

function isBinary(buf) {
  const len = Math.min(buf.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function scanSecrets(relPath, lines, findings) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 4000) continue;
    for (const rule of SECRET_RULES) {
      const m = rule.regex.exec(line);
      if (!m) continue;
      const evidence = m[0];
      if (rule.id === 'secret.generic-assignment') {
        const quoted = /['"]([^'"\s]{8,})['"]/.exec(m[0]);
        const val = quoted ? quoted[1] : evidence;
        if (PLACEHOLDER_RE.test(val)) continue;
      }
      findings.push({
        ruleId: rule.id,
        description: rule.description,
        severity: rule.severity,
        file: relPath,
        line: i + 1,
        evidence: mask(evidence),
      });
    }
  }
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function lineOf(text, needle) {
  const idx = text.indexOf(needle);
  if (idx < 0) return 1;
  return text.slice(0, idx).split('\n').length;
}

function scanMcpConfig(relPath, text, findings, data) {
  if (!data || typeof data !== 'object') return;
  const servers = data.mcpServers || data.servers || {};
  if (!servers || typeof servers !== 'object') return;

  for (const [name, srv] of Object.entries(servers)) {
    if (!srv || typeof srv !== 'object') continue;
    const cmd = String(srv.command || '');
    const args = Array.isArray(srv.args) ? srv.args.map(String) : [];
    const all = [cmd, ...args];
    const joined = all.join(' ');
    const ln = lineOf(text, name);

    if (/\b(npx|npm|pnpm|yarn|bunx)\b/.test(joined)) {
      const hasPin = args.some((a) => /@(?:\d|latest|next|[~^]?\d)/.test(a)) ||
        args.some((a) => /@[0-9a-f]{7,40}$/.test(a));
      const hasYesFlag = args.includes('-y') || args.includes('--yes');
      if (!hasPin) {
        findings.push({
          ruleId: 'mcp.unpinned-npx',
          description: `MCP server "${name}" runs npx without a pinned version` + (hasYesFlag ? ' (-y auto-confirm)' : ''),
          severity: 'HIGH',
          file: relPath,
          line: ln,
          evidence: mask(joined),
        });
      }
    }

    for (const a of all) {
      if (/--allow-all|--dangerously|--yolo|--no-sandbox/.test(a)) {
        findings.push({
          ruleId: 'mcp.broad-permissions',
          description: `MCP server "${name}" grants broad/unsafe permissions (${a})`,
          severity: 'HIGH',
          file: relPath,
          line: ln,
          evidence: a,
        });
      }
      if (/^(?:\/|[A-Za-z]:[\\/])$/.test(a) || a === '~' || a === '/Users' || a === 'C:\\Users') {
        findings.push({
          ruleId: 'mcp.broad-filesystem',
          description: `MCP server "${name}" exposes a root/home filesystem path (${a})`,
          severity: 'HIGH',
          file: relPath,
          line: ln,
          evidence: a,
        });
      }
    }

    const env = srv.env && typeof srv.env === 'object' ? srv.env : {};
    for (const [k, v] of Object.entries(env)) {
      const val = String(v);
      if (val && !/^\$\{?[A-Za-z0-9_]+\}?$/.test(val) && val.length >= 12 &&
          /(key|token|secret|password|pass)/i.test(k)) {
        findings.push({
          ruleId: 'mcp.inline-secret',
          description: `MCP server "${name}" hardcodes a secret in env "${k}"`,
          severity: 'CRITICAL',
          file: relPath,
          line: lineOf(text, k),
          evidence: mask(val),
        });
      }
    }
  }
}

function scanGithubWorkflow(relPath, text, findings) {
  const lower = text.toLowerCase();
  const hasPRTarget = /on:\s*[\s\S]*?pull_request_target/.test(lower) ||
    /\bpull_request_target\b/.test(lower);
  const hasCheckout = /uses:\s*actions\/checkout/.test(lower);
  const refsHeadSha = /github\.event\.pull_request\.head\.(?:sha|ref)/.test(lower);

  if (hasPRTarget && hasCheckout) {
    findings.push({
      ruleId: 'gha.pr-target-checkout',
      description: 'pull_request_target combined with code checkout can run untrusted PR code with write access',
      severity: 'HIGH',
      file: relPath,
      line: lineOf(text, 'pull_request_target'),
      evidence: refsHeadSha ? 'checkout of PR head ref under pull_request_target' : 'checkout under pull_request_target',
    });
  }

  if (/permissions:\s*write-all/.test(lower)) {
    findings.push({
      ruleId: 'gha.broad-permissions',
      description: 'Workflow grants write-all permissions to GITHUB_TOKEN',
      severity: 'MEDIUM',
      file: relPath,
      line: lineOf(text, 'write-all'),
      evidence: 'permissions: write-all',
    });
  }

  // untrusted input interpolated into a run shell -> injection
  const runInjection = /\$\{\{\s*github\.event\.(?:issue|pull_request|comment|review)[^}]*\}\}/;
  if (runInjection.test(text)) {
    const m = runInjection.exec(text);
    findings.push({
      ruleId: 'gha.script-injection',
      description: 'Untrusted github.event input interpolated into workflow (possible script injection)',
      severity: 'HIGH',
      file: relPath,
      line: lineOf(text, m[0]),
      evidence: mask(m[0]),
    });
  }
}

function scanPackageJson(relPath, text, findings, data) {
  if (!data || !data.scripts || typeof data.scripts !== 'object') return;
  const risky = ['postinstall', 'preinstall', 'install', 'prepare', 'prepublish'];
  for (const [name, raw] of Object.entries(data.scripts)) {
    const script = String(raw);
    const ln = lineOf(text, '"' + name + '"');
    if (/\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/.test(script) ||
        /\b(?:curl|wget)\b[^|]*\|\s*node\b/.test(script)) {
      findings.push({
        ruleId: 'pkg.curl-pipe-sh',
        description: `npm script "${name}" pipes a remote download into a shell`,
        severity: 'CRITICAL',
        file: relPath,
        line: ln,
        evidence: mask(script),
      });
    }
    if (risky.includes(name)) {
      if (/\b(?:npx|bunx)\b/.test(script) && !/@(?:\d|latest|next)/.test(script)) {
        findings.push({
          ruleId: 'pkg.lifecycle-unpinned-npx',
          description: `Lifecycle script "${name}" runs npx without a pinned version`,
          severity: 'HIGH',
          file: relPath,
          line: ln,
          evidence: mask(script),
        });
      } else if (/\b(?:curl|wget|node\s+-e|eval)\b/.test(script)) {
        findings.push({
          ruleId: 'pkg.lifecycle-script',
          description: `Lifecycle script "${name}" runs network/eval commands during install`,
          severity: 'HIGH',
          file: relPath,
          line: ln,
          evidence: mask(script),
        });
      }
    }
  }
}

function looksLikeN8n(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.nodes)) return false;
  return data.nodes.some((n) => n && typeof n.type === 'string' &&
    /n8n-nodes|nodes-base/.test(n.type));
}

function scanN8nWorkflow(relPath, text, data, findings) {
  for (const node of data.nodes) {
    if (!node || typeof node !== 'object') continue;
    const type = String(node.type || '');
    const params = node.parameters && typeof node.parameters === 'object' ? node.parameters : {};
    const nodeName = String(node.name || type);
    const ln = lineOf(text, '"' + nodeName + '"');

    if (/webhook/i.test(type)) {
      const auth = params.authentication;
      if (!auth || auth === 'none') {
        findings.push({
          ruleId: 'n8n.webhook-no-auth',
          description: `n8n webhook node "${nodeName}" has no authentication`,
          severity: 'HIGH',
          file: relPath,
          line: ln,
          evidence: 'authentication: none',
        });
      }
    }

    if (/(?:^|\.)code$|function|functionItem/i.test(type)) {
      const codeStr = JSON.stringify(params);
      if (/child_process|require\(\s*['"]child_process|\beval\b|\bexec(?:Sync)?\(|process\.env|require\(\s*['"]fs['"]/.test(codeStr)) {
        findings.push({
          ruleId: 'n8n.dangerous-code',
          description: `n8n code node "${nodeName}" uses dangerous APIs (exec/eval/fs/env)`,
          severity: 'HIGH',
          file: relPath,
          line: ln,
          evidence: 'code node references exec/eval/fs/process.env',
        });
      }
    }

    const flat = JSON.stringify(params);
    const credMatch = /"(?:apiKey|token|password|secret|authorization)"\s*:\s*"((?:Bearer\s+)?[^"]{12,})"/i.exec(flat);
    if (credMatch && !/\{\{|^=|^\$/.test(credMatch[1])) {
      findings.push({
        ruleId: 'n8n.inline-credential',
        description: `n8n node "${nodeName}" contains an inline credential`,
        severity: 'CRITICAL',
        file: relPath,
        line: ln,
        evidence: mask(credMatch[1]),
      });
    }
  }
}

function flagInstructionFile(relPath, findings) {
  findings.push({
    ruleId: 'ai.instruction-file',
    description: 'AI agent instruction file present — review for prompt-injection or risky directives before handing to an agent',
    severity: 'LOW',
    file: relPath,
    line: 1,
    evidence: path.basename(relPath),
  });
}

const INSTRUCTION_BASENAMES = new Set([
  'claude.md', 'agents.md', '.windsurfrules', '.cursorrules', 'gemini.md', 'copilot-instructions.md',
]);

function isInstructionFile(relPath, base) {
  const lower = base.toLowerCase();
  if (INSTRUCTION_BASENAMES.has(lower)) return true;
  const norm = relPath.replace(/\\/g, '/').toLowerCase();
  if (norm.includes('.cursor/rules')) return true;
  if (norm.endsWith('.github/copilot-instructions.md')) return true;
  return false;
}

function isWorkflowFile(relPath) {
  const norm = relPath.replace(/\\/g, '/').toLowerCase();
  return /\.github\/workflows\/[^/]+\.ya?ml$/.test(norm);
}

function scanFile(absPath, relPath, findings, counters) {
  let buf;
  try {
    buf = fs.readFileSync(absPath);
  } catch {
    counters.skipped++;
    return;
  }
  if (isBinary(buf)) {
    counters.skipped++;
    return;
  }
  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);
  const base = path.basename(relPath);
  const lowerBase = base.toLowerCase();

  counters.scanned++;

  scanSecrets(relPath, lines, findings);

  let jsonData;
  if (lowerBase.endsWith('.json')) {
    jsonData = parseJsonLoose(text);
  }

  if (lowerBase === 'package.json') {
    scanPackageJson(relPath, text, findings, jsonData);
  }

  if (lowerBase === 'mcp.json' || lowerBase === '.mcp.json' || lowerBase === 'claude_desktop_config.json') {
    scanMcpConfig(relPath, text, findings, jsonData);
  }

  if (isInstructionFile(relPath, base)) {
    flagInstructionFile(relPath, findings);
  }

  if (isWorkflowFile(relPath)) {
    scanGithubWorkflow(relPath, text, findings);
  }

  if (jsonData && looksLikeN8n(jsonData)) {
    scanN8nWorkflow(relPath, text, jsonData, findings);
  }
}

function walk(root, findings, counters) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      const isDir = ent.isDirectory();
      const isFile = ent.isFile();
      if (isDir) {
        if (SKIP_DIRS.has(ent.name)) continue;
        stack.push(abs);
        continue;
      }
      if (!isFile) continue;
      let stats;
      try {
        stats = fs.statSync(abs);
      } catch {
        counters.skipped++;
        continue;
      }
      if (stats.size > MAX_FILE_SIZE) {
        counters.skipped++;
        continue;
      }
      const rel = path.relative(root, abs) || ent.name;
      scanFile(abs, rel, findings, counters);
    }
  }
}

function dedupe(findings) {
  const seen = new Set();
  const out = [];
  for (const f of findings) {
    const key = [f.ruleId, f.file, f.line, f.evidence].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function sortFindings(findings) {
  return findings.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line;
  });
}

function printReport(findings, counters, root) {
  const out = [];
  out.push('');
  out.push(color('bold', '  AI Agent Guard') + color('dim', `  v${VERSION}`));
  out.push(color('dim', `  scanned: ${path.resolve(root)}`));
  out.push('');

  if (findings.length === 0) {
    out.push('  ' + color('green', '✓ No issues found'));
  } else {
    let lastSeverity = null;
    for (const f of findings) {
      if (f.severity !== lastSeverity) {
        out.push('');
        out.push('  ' + color(f.severity, color('bold', f.severity)));
        lastSeverity = f.severity;
      }
      const loc = color('cyan', `${f.file}:${f.line}`);
      out.push(`    ${color(f.severity, '●')} ${loc}  ${color('dim', '[' + f.ruleId + ']')}`);
      out.push(`      ${f.description}`);
      out.push(`      ${color('dim', 'evidence:')} ${f.evidence}`);
    }
  }

  out.push('');
  out.push(color('dim', '  ' + '─'.repeat(48)));
  const bySev = countBySeverity(findings);
  out.push(`  files scanned: ${counters.scanned}    skipped: ${counters.skipped}`);
  out.push(
    `  findings: ` +
    color('CRITICAL', `${bySev.CRITICAL} critical`) + '  ' +
    color('HIGH', `${bySev.HIGH} high`) + '  ' +
    color('MEDIUM', `${bySev.MEDIUM} medium`) + '  ' +
    color('LOW', `${bySev.LOW} low`)
  );
  out.push('');
  process.stdout.write(out.join('\n') + '\n');
}

function countBySeverity(findings) {
  const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) c[f.severity]++;
  return c;
}

function printHelp() {
  process.stdout.write(`
ai-agent-guard v${VERSION}
Scan a project for security risks before handing it to an AI coding agent.

Usage:
  npx ai-agent-guard [options]

Options:
  --path <dir>   Directory to scan (default: current directory)
  --json         Output findings as JSON
  --no-color     Disable colored output
  --help, -h     Show this help
  --version, -v  Show version

Checks: leaked secrets, risky MCP configs, AI instruction files,
GitHub Actions misconfig, dangerous package.json scripts, n8n workflows.

Private by design: runs locally, no network calls, no telemetry.
Exit code: 0 = clean, 1 = findings.
`);
}

function parseArgs(argv) {
  const opts = { path: '.', json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--no-color') opts.noColor = true;
    else if (a === '--path') { opts.path = argv[++i] || '.'; }
    else if (a.startsWith('--path=')) { opts.path = a.slice(7); }
    else if (!a.startsWith('-')) { opts.path = a; }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.noColor) useColor = false;
  if (opts.help) { printHelp(); process.exit(0); }
  if (opts.version) { process.stdout.write(VERSION + '\n'); process.exit(0); }

  const root = path.resolve(opts.path);
  let st;
  try {
    st = fs.statSync(root);
  } catch {
    process.stderr.write(`error: path not found: ${root}\n`);
    process.exit(2);
  }
  if (!st.isDirectory()) {
    process.stderr.write(`error: not a directory: ${root}\n`);
    process.exit(2);
  }

  const findings = [];
  const counters = { scanned: 0, skipped: 0 };
  walk(root, findings, counters);

  const deduped = sortFindings(dedupe(findings));

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      version: VERSION,
      scannedPath: root,
      filesScanned: counters.scanned,
      filesSkipped: counters.skipped,
      summary: countBySeverity(deduped),
      findings: deduped,
    }, null, 2) + '\n');
  } else {
    printReport(deduped, counters, root);
  }

  process.exit(deduped.length > 0 ? 1 : 0);
}

main();
