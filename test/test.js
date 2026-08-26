'use strict';

// Smoke test for enhanced-dirsize public API + CLI.
// Runs assertions on exported functions, then smoke-runs both CLI entrypoints.

const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const lib = require('../src/index.js');

let passed = 0;
function ok(label, fn) {
  fn();
  passed++;
  console.log('  ✓ ' + label);
}

console.log('# formatSize');
ok('0 → "0 B"', () => assert.strictEqual(lib.formatSize(0), '0 B'));
ok('1024 → "1.0 KB"', () => assert.strictEqual(lib.formatSize(1024), '1.0 KB'));
ok('1536 → "1.5 KB"', () => assert.strictEqual(lib.formatSize(1536), '1.5 KB'));
ok('1048576 → "1.0 MB"', () => assert.strictEqual(lib.formatSize(1048576), '1.0 MB'));

console.log('# parseSize');
ok('"1KB" → 1024', () => assert.strictEqual(lib.parseSize('1KB'), 1024));
ok('"2.5 MB" → 2621440', () => assert.strictEqual(lib.parseSize('2.5 MB'), 2621440));
ok('invalid → -1', () => assert.strictEqual(lib.parseSize('nope'), -1));

console.log('# file type detection');
ok('.js → JavaScript', () => assert.strictEqual(lib.getFileType('a.js'), 'JavaScript'));
ok('.py → Python', () => assert.strictEqual(lib.getFileType('b.py'), 'Python'));
ok('unknown → Other', () => assert.strictEqual(lib.getFileType('x.zzz'), 'Other'));

console.log('# scanDir on temp fixture');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dirsize-test-'));
fs.writeFileSync(path.join(tmp, 'one.js'), 'a'.repeat(10));
fs.writeFileSync(path.join(tmp, 'two.json'), 'b'.repeat(20));
fs.mkdirSync(path.join(tmp, 'sub'));
fs.writeFileSync(path.join(tmp, 'sub', 'three.py'), 'c'.repeat(5));
try {
  const result = lib.scanDir(tmp);
  ok('scanDir returns summary object', () => assert.ok(result && typeof result === 'object'));
  ok('counts 3 files', () => assert.strictEqual(result.fileCount, 3));
  ok('counts 35 bytes', () => assert.strictEqual(result.size, 35));
  ok('toJSON emits valid JSON string', () => assert.ok(JSON.parse(lib.toJSON(result))));
  ok('toMarkdown emits string with bytes', () => assert.ok(lib.toMarkdown(result).length > 0));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('# CLI smoke');
for (const entry of ['cli.js', 'enhanced-cli.js']) {
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'src', entry), '--help'], {
    encoding: 'utf8',
  });
  ok(entry + ' --help exits 0 with usage', () => assert.ok(out.length > 0));
}

console.log('\n' + passed + ' assertions passed');
