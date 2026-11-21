const test = require('node:test');
const assert = require('node:assert/strict');
const { URL } = require('node:url');
const Datastore = require('@seald-io/nedb');
const { CryptorV2 } = require('../lib/cryptor');

const LEGACY_ID = '000000000123456789abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyzABCDEF';
const LEGACY_CIPHERTEXT = '7e8dfed31872c809bbbb0b3bd599c9ff';

test('create, confirm, reveal, and burn V3 secrets; reveal legacy V2 entries', async () => {
    const nedb = new Datastore();
    const appPath = require.resolve('../app');
    const previousApp = require.cache[appPath];
    require.cache[appPath] = { id: appPath, filename: appPath, loaded: true, exports: { nedb } };
    const { index } = require('../routes/index');

    function request(body = {}, query = {}) {
        return new Promise((resolve, reject) => {
            const req = { body, query, protocol: 'http', get: () => 'localhost' };
            const res = {
                status(code) { this.code = code; return this; },
                send(message) { resolve({ code: this.code, message }); },
                render(view, data) { resolve({ code: this.code || 200, data }); },
            };
            try { index(req, res); } catch (err) { reject(err); }
        });
    }

    try {
        const created = await request({ secret: 'V3 secret' });
        const id = new URL(created.data.url).searchParams.get('id');
        assert.strictEqual(id.length, 68);
        assert.strictEqual((await request({}, { id })).data.found, true);
        assert.strictEqual((await request({ id, show: '1' })).data.secret, 'V3 secret');
        assert.strictEqual((await request({ id, show: '1' })).data.error, 'ERR_NO_SUCH_ENTRY');

        const tampered = await request({ secret: 'tamper target' });
        const tamperedId = new URL(tampered.data.url).searchParams.get('id');
        const entry = await new Promise((resolve, reject) => nedb.findOne({ key: tamperedId.slice(0, 8) }, (err, doc) => err ? reject(err) : resolve(doc)));
        const [ciphertext, tag] = entry.encrypted.split(':');
        const changedTag = `${tag[0] === '0' ? '1' : '0'}${tag.slice(1)}`;
        await new Promise((resolve, reject) => nedb.update({ key: entry.key }, { $set: { encrypted: `${ciphertext}:${changedTag}` } }, {}, (err) => err ? reject(err) : resolve()));
        assert.strictEqual((await request({ id: tamperedId, show: '1' })).data.error, 'ERR_NO_SUCH_ENTRY');

        await new Promise((resolve, reject) => nedb.insert({ key: LEGACY_ID.slice(0, 8), encrypted: LEGACY_CIPHERTEXT }, (err) => err ? reject(err) : resolve()));
        assert.ok(new CryptorV2().validateId(LEGACY_ID));
        assert.strictEqual((await request({ id: LEGACY_ID, show: '1' })).data.secret, 'legacy V2 entry');
        assert.strictEqual((await request({}, { id: 'a'.repeat(19), key: 'old-key' })).code, 422);
    } finally {
        if (previousApp) {
            require.cache[appPath] = previousApp;
        } else {
            delete require.cache[appPath];
        }
    }
});
