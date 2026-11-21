const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/test-server');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let srv;
test.before(async () => { srv = await startServer(); });
test.after(() => srv.stop());

const extractId = (html) => /\?id=([A-Za-z0-9]+)/.exec(html)[1];

test('create, preview, read once', async () => {
  const created = await (await srv.post('/', { secret: 'top secret' })).text();
  const id = extractId(created);

  // preview must not consume the secret
  const preview = await srv.get(`/?id=${id}`);
  assert.equal(preview.status, 200);
  assert.ok(!(await preview.text()).includes('top secret'));

  const shown = await (await srv.post('/', { id, show: '1' })).text();
  assert.ok(shown.includes('top secret'));

  const again = await (await srv.post('/', { id, show: '1' })).text();
  assert.ok(!again.includes('top secret'));
});

test('invalid id returns 422', async () => {
  const res = await srv.get('/?id=bogus');
  assert.equal(res.status, 422);
});

test('home page renders', async () => {
  assert.equal((await srv.get('/')).status, 200);
});

test('legacy ?key= request reveals nothing', async () => {
  const res = await srv.get('/?key=' + 'a'.repeat(19));
  assert.equal(res.status, 200);
  assert.ok(!(await res.text()).includes('No entry found'));
});

test('oversize secret returns 413 without leaking a stack trace', async () => {
  const res = await srv.post('/', { secret: 'x'.repeat(200 * 1024) });
  assert.equal(res.status, 413);
  const body = await res.text();
  assert.ok(!/node_modules|\.js:\d+/.test(body), body);
});

test('failing migration is loud: logs and exits 1, never listens', async () => {
  const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'r2b-bad-'));
  try {
    fs.mkdirSync(path.join(legacy, 'abc'));
    fs.writeFileSync(path.join(legacy, 'abc', 'key12345'), 'not json');
    await assert.rejects(startServer({ LEGACY_DATA_DIR: legacy }), /exited early \(1\).*Migration failed/s);
  } finally {
    fs.rmSync(legacy, { recursive: true, force: true });
  }
});

test('migrations run on startup and record state (failure must not be silent)', async () => {
  const f = path.join(srv.dir, 'data', 'migrations.json');
  for (let i = 0; i < 50 && !fs.existsSync(f); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(fs.existsSync(f));
});
