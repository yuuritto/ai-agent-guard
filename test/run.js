'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'bin', 'ai-agent-guard.js');

function scan(dir) {
  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(process.execPath, [CLI, '--json', '--path', dir], {
      encoding: 'utf8',
    });
  } catch (e) {
    stdout = e.stdout ? e.stdout.toString() : '';
    code = e.status == null ? 1 : e.status;
  }
  return { report: JSON.parse(stdout), code };
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

const masked = vuln.report.findings.find((f) => f.ruleId === 'secret.aws-access-key');
check('evidence is masked', masked && /\*/.test(masked.evidence) && !masked.evidence.includes('IOSFODNN7'));

console.log('clean fixture:');
check('exit code 0', clean.code === 0);
check('no findings', clean.report.findings.length === 0);

console.log('');
if (failures > 0) {
  console.error(failures + ' check(s) failed');
  process.exit(1);
}
console.log('all checks passed');
