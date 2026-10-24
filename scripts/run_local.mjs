// scripts/run_local.mjs — Fase E runner: executes the TypeScript port of the
// project CRUD test suite (Python archive), aggregates PASS/FAIL and prints
// the accounting line `RESULT: N PASS, M FAIL`. Exit code 0 only when 0 FAIL.
//
// Usage: node scripts/run_local.mjs   (from project root)

import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const TESTS_DIR = join(ROOT, 'scripts', 'tests');

/** Collect eligible test files (dedupe + deterministic order). */
function collectSuites() {
  const entries = readdirSync(TESTS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.test.mjs') && e.name !== '_harness.mjs')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/** Run one test file as a child process; return output + exit code. */
function runSuite(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(TESTS_DIR, file)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', (e) => { err += e.message; });
    child.on('close', (code) => resolve({ file, code: code ?? null, out, err }));
  });
}

const passRe = /\[PASS\]/g;
const failRe = /\[FAIL\]/g;

async function main() {
  const suites = collectSuites();
  if (suites.length === 0) {
    console.error('No test suites found in scripts/tests/');
    process.exit(1);
  }

  let totalPass = 0;
  let totalFail = 0;
  const failed = [];

  for (const file of suites) {
    console.log(`\n===== ${file} =====`);
    const res = await runSuite(file);
    const pass = (res.out.match(passRe) || []).length;
    const fail = (res.out.match(failRe) || []).length;
    totalPass += pass;
    totalFail += fail;
    if (res.err) process.stderr.write(res.err);
    console.log(res.out);
    if (res.code !== 0) {
      failed.push(`${file} (exit ${res.code})`);
    }
    console.log(`[suite] ${file} -> ${pass} PASS, ${fail} FAIL`);
  }

  console.log(`\n===== TOTAL =====`);
  console.log(`RESULT: ${totalPass} PASS, ${totalFail} FAIL`);
  if (totalFail > 0) {
    console.error('\nFAILED suites: ' + failed.join(', '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Runner error:', e);
  process.exit(1);
});
