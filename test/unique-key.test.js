const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Datastore = require('@seald-io/nedb');
const { startServer } = require('./helpers/test-server');
const migration = require('../migrations/03_dedupe_keys_and_enforce_unique_index');

test('migration dedupes by unconsumed > newest timestamp > _id, then enforces unique index', async () => {
  const db = new Datastore({ inMemoryOnly: true });
  await db.insertAsync([
    { _id: 'a', key: 'k1', timestamp: 1, consumed: true },
    { _id: 'b', key: 'k1', timestamp: 5 },
    { _id: 'c', key: 'k1', timestamp: 9 },   // newest unconsumed wins
    { _id: 'e', key: 'k2', timestamp: 3 },
    { _id: 'd', key: 'k2', timestamp: 3 },   // tie -> lowest _id
    { _id: 'f', key: 'k3', timestamp: 1 },
    { _id: 'g', key: 'k4', timestamp: 1, consumed: true },
    { _id: 'h', key: 'k4', timestamp: 8, consumed: true }, // all consumed -> newest
    { _id: 'x', timestamp: 1 },                            // missing key -> preserved
    { _id: 'y', key: null, timestamp: 2 },                 // null key -> preserved
  ]);
  await migration.up({ context: db });
  const ids = (await db.findAsync({})).map((d) => d._id).sort();
  assert.deepEqual(ids, ['c', 'd', 'f', 'h', 'x', 'y']);
  await assert.rejects(db.insertAsync({ key: 'k3' }), { errorType: 'uniqueViolated' });
});

const fixed = (calls) => ({
  NODE_OPTIONS: `--require ${path.join(__dirname, 'helpers', 'fixed-key.js')}`,
  R2B_FIXED_KEY_CALLS: String(calls),
});

test('key collision retries with a fresh key', async () => {
  const srv = await startServer(fixed(2));
  try {
    const ids = [];
    for (const secret of ['one', 'two']) {
      const res = await srv.post('/', { secret });
      assert.equal(res.status, 200);
      ids.push(/\?id=([A-Za-z0-9]+)/.exec(await res.text())[1]);
    }
    assert.notEqual(ids[0], ids[1]);
    for (const [i, secret] of ['one', 'two'].entries()) {
      assert.ok((await (await srv.post('/', { id: ids[i], show: '1' })).text()).includes(secret));
    }
  } finally { await srv.stop(); }
});

test('exhausted retries return 500', async () => {
  const srv = await startServer(fixed(1000));
  try {
    assert.equal((await srv.post('/', { secret: 'one' })).status, 200);
    assert.equal((await srv.post('/', { secret: 'two' })).status, 500);
    assert.equal((await srv.get('/')).status, 200); // still alive
  } finally { await srv.stop(); }
});

test('startup dedupes a seeded datafile, enforces the unique index and serves', async () => {
  const line = (o) => JSON.stringify(o);
  const seed = (dir) => {
    fs.mkdirSync(path.join(dir, 'data'));
    fs.writeFileSync(path.join(dir, 'data', 'read2burn.db'), [
      line({ _id: 'a', key: 'dup', timestamp: 1, encrypted: 'old' }),
      line({ _id: 'b', key: 'dup', timestamp: 9, encrypted: 'new' }),
      line({ _id: 'c', key: 'solo', timestamp: 1, encrypted: 'x' }),
    ].join('\n') + '\n');
  };
  const srv = await startServer({}, seed);
  try {
    assert.equal((await srv.get('/')).status, 200);
    const db = new Datastore({ filename: path.join(srv.dir, 'data', 'read2burn.db'), autoload: true });
    await db.autoloadPromise;
    assert.deepEqual((await db.findAsync({})).map((d) => d._id).sort(), ['b', 'c']);
    // unique index is persisted in the datafile and enforced on reload
    await assert.rejects(db.insertAsync({ key: 'solo' }), { errorType: 'uniqueViolated' });
  } finally { await srv.stop(); }
});
