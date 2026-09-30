'use strict';

const { spawnSync } = require('child_process');
const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI = path.join(__dirname, '..', 'bin', 'ai-agent-guard.js');

function run(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.strictEqual(result.signal, null);
  return result;
}

function scan(dir) {
  const result = run(['--json', '--path', dir]);
  assert.strictEqual(result.stderr, '');
  return { report: JSON.parse(result.stdout), code: result.status };
}

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    console.error('  FAIL ' + name);
    failures++;
  }
}

const fixtures = path.join(__dirname, 'fixtures');
const vuln = scan(path.join(fixtures, 'vulnerable'));
const clean = scan(path.join(fixtures, 'clean'));

const rules = new Set(vuln.report.findings.map((f) => f.ruleId));

console.log('vulnerable fixture:');
check('exit code 1', vuln.code === 1);
check('detects AWS key', rules.has('secret.aws-access-key'));
check('detects GitHub token', rules.has('secret.github-token'));
check('detects Stripe live key', rules.has('secret.stripe-live-key'));
check('detects OpenAI key', rules.has('secret.openai-key'));
check('detects Anthropic key', rules.has('secret.anthropic-key'));
check('detects private key', rules.has('secret.private-key'));
check('detects DB url creds', rules.has('secret.db-url-credentials'));
check('detects generic secret assignment', rules.has('secret.generic-assignment'));
check('detects MCP broad filesystem', rules.has('mcp.broad-filesystem'));
check('detects MCP unpinned npx', rules.has('mcp.unpinned-npx'));
check('detects MCP inline secret', rules.has('mcp.inline-secret'));
check('detects AI instruction file', rules.has('ai.instruction-file'));
check('detects GHA pr_target checkout', rules.has('gha.pr-target-checkout'));
check('detects GHA broad permissions', rules.has('gha.broad-permissions'));
check('detects GHA script injection', rules.has('gha.script-injection'));
check('detects pkg curl|bash', rules.has('pkg.curl-pipe-sh'));
check('detects pkg unpinned lifecycle npx', rules.has('pkg.lifecycle-unpinned-npx'));
check('detects n8n webhook no auth', rules.has('n8n.webhook-no-auth'));
check('detects n8n dangerous code', rules.has('n8n.dangerous-code'));
check('detects n8n inline credential', rules.has('n8n.inline-credential'));

check('detects auto-approved MCP servers', rules.has('agent.auto-approve-mcp'));
check('detects disabled hooks', rules.has('agent.hooks-disabled'));
check('detects relaxed default mode', rules.has('agent.relaxed-default-mode'));
check('detects unbounded permission grant', rules.has('agent.unbounded-permission'));
check('detects dangerous permission grant', rules.has('agent.dangerous-permission'));
check('detects HTTP hook', rules.has('agent.http-hook'));
check('detects wildcard hook URL', rules.has('agent.wildcard-hook-url'));
check('detects inline secret in agent settings', rules.has('agent.inline-secret'));
check('detects skipped permission prompts', rules.has('agent.skip-permissions'));

const nestedHttpHook = vuln.report.findings.find(
  (finding) => finding.ruleId === 'agent.http-hook' &&
    finding.file.replace(/\\/g, '/').endsWith('.claude/nested-hooks.json'),
);
check('detects HTTP hook in the documented nested handler shape', Boolean(nestedHttpHook));

const denyLeak = vuln.report.findings.find(
  (f) => (f.ruleId === 'agent.unbounded-permission' || f.ruleId === 'agent.dangerous-permission') &&
    /deny/i.test(String(f.evidence)),
);
check('deny-list entries are not reported', !denyLeak);

const masked = vuln.report.findings.find((f) => f.ruleId === 'secret.aws-access-key');
check('evidence is masked', masked && /\*/.test(masked.evidence) && !masked.evidence.includes('IOSFODNN7'));

const crossRuleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-guard-cross-mask-'));
try {
  const crossRuleValue = ['cross', 'rule', 'redaction', 'value'].join('-');
  fs.writeFileSync(
    path.join(crossRuleDir, 'run.sh'),
    `claude --dangerously-skip-permissions token="${crossRuleValue}"\n`,
  );
  const crossRule = scan(crossRuleDir);
  const crossRuleEvidence = crossRule.report.findings
    .map((finding) => finding.evidence)
    .join('\n');
  check(
    'secret-like values are masked across every finding rule',
    crossRule.code === 1 &&
      crossRuleEvidence.includes('*') &&
      !crossRuleEvidence.includes(crossRuleValue),
  );
} finally {
  fs.rmSync(crossRuleDir, { recursive: true, force: true });
}

console.log('clean fixture:');
check('exit code 0', clean.code === 0);
check('no findings', clean.report.findings.length === 0);

check('clean scan is complete', clean.report.scanComplete === true);

const coverageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-agent-guard-coverage-'));
try {
  const largeOutputFile = path.join(coverageDir, 'many.txt');
  fs.writeFileSync(largeOutputFile, ('AKIA' + 'Z'.repeat(16) + '\n').repeat(2000));
  const large = scan(coverageDir);
  check('large piped JSON is complete', large.code === 1 &&
    large.report.findings.length === 2000 && large.report.findings.at(-1).line === 2000);
  check('large piped text is complete', run(['--path', coverageDir]).stdout.endsWith('0 low\n\n'));
  fs.unlinkSync(largeOutputFile);

  fs.writeFileSync(path.join(coverageDir, 'long.txt'), 'x'.repeat(4001));
  fs.writeFileSync(path.join(coverageDir, 'large.txt'), 'x'.repeat(512 * 1024 + 1));
  const incomplete = scan(coverageDir);
  check('incomplete scan preserves exit code and counts limits', incomplete.code === 0 &&
    incomplete.report.scanComplete === false && incomplete.report.coverage.longLines === 1 &&
    incomplete.report.coverage.oversizedFiles === 1 && incomplete.report.filesSkipped === 1);
  const text = run(['--path', coverageDir]).stdout;
  check('incomplete text does not claim a clean scan', text.includes('Scan incomplete') &&
    !text.includes('✓ No issues found'));
  fs.writeFileSync(path.join(coverageDir, 'finding.txt'), 'AKIA' + 'Z'.repeat(16));
  check('incomplete scan with findings keeps exit 1', scan(coverageDir).code === 1);
  check('findings report also warns about incomplete coverage',
    run(['--path', coverageDir]).stdout.includes('Scan incomplete'));
  for (const file of fs.readdirSync(coverageDir)) fs.unlinkSync(path.join(coverageDir, file));

  fs.writeFileSync(path.join(coverageDir, 'boundary.txt'), 'x'.repeat(4000));
  fs.writeFileSync(path.join(coverageDir, 'binary.bin'), Buffer.from([0, 1, 2]));
  fs.mkdirSync(path.join(coverageDir, 'node_modules'));
  fs.writeFileSync(path.join(coverageDir, 'node_modules', 'ignored.txt'), 'x'.repeat(4001));
  const scoped = scan(coverageDir);
  check('scope exclusions are counted separately from incomplete coverage',
    scoped.report.scanComplete && scoped.report.coverage.binaryFiles === 1 &&
    scoped.report.coverage.excludedDirectories === 1 && scoped.report.coverage.longLines === 0);

  // Inject filesystem failures so these checks also work as root and on Windows.
  const source = fs.readFileSync(CLI, 'utf8');
  for (const [method, counter] of [
    ['readdirSync', 'unreadableDirectories'],
    ['statSync', 'unreadableFiles'],
    ['readFileSync', 'unreadableFiles'],
  ]) {
    let output = '';
    const failingFs = { ...fs, [method](target, ...args) {
      if (method !== 'statSync' || target !== coverageDir) throw new Error('unreadable');
      return fs[method](target, ...args);
    } };
    const fakeProcess = {
      argv: [process.execPath, CLI, '--json', '--path', coverageDir], env: {},
      stdout: { write: (text) => { output += text; } },
      stderr: { write: () => assert.fail('unexpected stderr') },
    };
    vm.runInNewContext(source, {
      require: (name) => name === 'fs' ? failingFs : name === '../package.json'
        ? require('../package.json') : require(name),
      process: fakeProcess,
    });
    const report = JSON.parse(output);
    check(method + ' failures are reported', !report.scanComplete && report.coverage[counter] > 0);
  }
  check('invalid scan path exits 2', run(['--path', path.join(coverageDir, 'missing')]).status === 2);
  check('non-directory scan path exits 2', run(['--path', path.join(coverageDir, 'boundary.txt')]).status === 2);
  check('help and version exit successfully', run(['--help']).status === 0 && run(['--version']).status === 0);
} finally {
  fs.rmSync(coverageDir, { recursive: true, force: true });
}

console.log('');
if (failures > 0) {
  console.error(failures + ' check(s) failed');
  process.exit(1);
}
console.log('all checks passed');
