const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Datastore = require('@seald-io/nedb');

const dirs = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'r2b-mig-'));
  dirs.push(d);
  return d;
};
const origEnv = process.env.LEGACY_DATA_DIR;
test.after(() => {
  if (origEnv === undefined) {
    delete process.env.LEGACY_DATA_DIR;
  } else {
    process.env.LEGACY_DATA_DIR = origEnv;
  }
  dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
});

test('missing legacy dir is a no-op (fresh install)', async () => {
  const missing = (process.env.LEGACY_DATA_DIR = path.join(tmp(), 'nope'));
  await require('../migrations/01_migrate_data_directories').up();
  const db = new Datastore();
  await require('../migrations/02_migrate2nedb').up({ context: db });
  assert.ok(!fs.existsSync(missing));
  assert.equal((await db.findAsync({})).length, 0);
});

test('01 shortens long legacy dir names to 3 chars (resolves only after the move)', async () => {
  const dir = (process.env.LEGACY_DATA_DIR = tmp());
  fs.mkdirSync(path.join(dir, 'abcdef'));
  fs.writeFileSync(path.join(dir, 'abcdef', 'file1'), '{}');
  await require('../migrations/01_migrate_data_directories').up();
  assert.ok(fs.existsSync(path.join(dir, 'abc', 'file1')));
  assert.ok(!fs.existsSync(path.join(dir, 'abcdef')));
});

test('01 merges into an existing short dir and removes the emptied one', async () => {
  const dir = (process.env.LEGACY_DATA_DIR = tmp());
  fs.mkdirSync(path.join(dir, 'abc'));
  fs.writeFileSync(path.join(dir, 'abc', 'existing'), '{}'); // non-empty, so the merge branch runs
  fs.mkdirSync(path.join(dir, 'abcdef'));
  fs.writeFileSync(path.join(dir, 'abcdef', 'file1'), '{}');
  await require('../migrations/01_migrate_data_directories').up();
  assert.ok(fs.existsSync(path.join(dir, 'abc', 'existing')));
  assert.ok(fs.existsSync(path.join(dir, 'abc', 'file1')));
  assert.ok(!fs.existsSync(path.join(dir, 'abcdef')));
});

test('02 moves legacy secret files into nedb and deletes the files', async () => {
  const dir = (process.env.LEGACY_DATA_DIR = tmp());
  fs.mkdirSync(path.join(dir, 'abc'));
  fs.writeFileSync(path.join(dir, 'abc', 'key12345'), JSON.stringify({ encrypted: 'deadbeef' }));
  const db = new Datastore();
  await require('../migrations/02_migrate2nedb').up({ context: db });
  const docs = await db.findAsync({});
  assert.equal(docs.length, 1);
  assert.equal(docs[0].key, 'key12345');
  assert.equal(docs[0].encrypted, 'deadbeef');
  assert.ok(!fs.existsSync(path.join(dir, 'abc', 'key12345')));
});

test('02 keeps the source file when the insert fails', async () => {
  const dir = (process.env.LEGACY_DATA_DIR = tmp());
  fs.mkdirSync(path.join(dir, 'abc'));
  const f = path.join(dir, 'abc', 'key12345');
  fs.writeFileSync(f, JSON.stringify({ encrypted: 'deadbeef' }));
  const db = { insertAsync: () => Promise.reject(new Error('disk full')) };
  await assert.rejects(require('../migrations/02_migrate2nedb').up({ context: db }), /disk full/);
  assert.ok(fs.existsSync(f));
});
