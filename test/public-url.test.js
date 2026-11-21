const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { startServer } = require('./helpers/test-server');

const forged = { host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'http' };

async function shareUrl(srv, headers) {
  const html = await new Promise((resolve, reject) => {
    const req = http.request(srv.base + '/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    }, (res) => {
      assert.equal(res.statusCode, 200);
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(new URLSearchParams({ secret: 's' }).toString());
  });
  return /(https?:\/\/[^\s"'<>]*\?id=[A-Za-z0-9]+)/.exec(html)[1];
}

for (const [name, env, prefix] of [
  ['root', 'https://r2b.example.com', 'https://r2b.example.com/?id='],
  ['sub path without trailing slash and with query/hash', 'https://r2b.example.com/read2burn?x=1#h', 'https://r2b.example.com/read2burn/?id='],
]) {
  test(`canonical URL (${name}) ignores forged headers`, async () => {
    const srv = await startServer({ READ2BURN_PUBLIC_URL: env });
    try {
      assert.ok((await shareUrl(srv, forged)).startsWith(prefix));
    } finally {
      await srv.stop();
    }
  });
}

test('unset uses request host and forwarded protocol', async () => {
  const srv = await startServer();
  try {
    assert.ok((await shareUrl(srv, {})).startsWith(srv.base + '/?id='));
    assert.ok((await shareUrl(srv, forged)).startsWith('http://evil.example/?id='));
    assert.ok((await shareUrl(srv, { ...forged, 'x-forwarded-proto': 'https' })).startsWith('https://evil.example/?id='));
  } finally {
    await srv.stop();
  }
});

for (const bad of ['not a url', 'ftp://example.com']) {
  test(`startup fails for ${bad}`, async () => {
    await assert.rejects(startServer({ READ2BURN_PUBLIC_URL: bad }), /server exited early.*READ2BURN_PUBLIC_URL/s);
  });
}
