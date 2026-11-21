const test = require('node:test');
const assert = require('node:assert/strict');
const Datastore = require('@seald-io/nedb');
const { cleanupExpired } = require('../lib/cleanup');

test('cleanup removes expired secrets and keeps fresh ones', async () => {
  const db = new Datastore(); // in-memory
  const now = Date.now();
  await db.insertAsync([
    { key: 'old', timestamp: now - 10_000 },
    { key: 'fresh', timestamp: now - 1_000 },
  ]);
  const n = await new Promise((res, rej) => cleanupExpired(db, 5_000, (e, c) => (e ? rej(e) : res(c))));
  assert.equal(n, 1);
  assert.deepEqual((await db.findAsync({})).map((d) => d.key), ['fresh']);
});
