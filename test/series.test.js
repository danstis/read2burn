const test = require('node:test');
const assert = require('node:assert/strict');
const { series } = require('../lib/series');

test('series runs strictly in order, never overlapping', async () => {
  const log = [];
  await series([1, 2, 3], async (n) => {
    log.push(`start${n}`);
    await new Promise((r) => setTimeout(r, 10 - n * 3));
    log.push(`end${n}`);
  });
  assert.deepEqual(log, ['start1', 'end1', 'start2', 'end2', 'start3', 'end3']);
});

test('series stops at the first failure', async () => {
  const seen = [];
  await assert.rejects(series([1, 2, 3], async (n) => { seen.push(n); if (n === 2) { throw new Error('boom'); } }), /boom/);
  assert.deepEqual(seen, [1, 2]);
});
