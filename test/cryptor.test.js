const test = require('node:test');
const assert = require('node:assert');
const { CryptorFactory, CryptorV2, CryptorV3 } = require('../lib/cryptor');

function roundTrip(c, text) {
    c.createKey();
    const enc = c.encrypt(text);
    return { enc, id: c.getId() };
}

test('V3 round trip', () => {
    const c = new CryptorV3();
    const { enc, id } = roundTrip(c, 'héllo secret');
    assert.strictEqual(id.length, 68);
    assert.ok(c.validateId(id));
    assert.match(enc, /^[0-9a-f]*:[0-9a-f]{32}$/);
    assert.strictEqual(new CryptorV3().decrypt(enc, id), 'héllo secret');
});

test('V3 rejects tampering and bad format', () => {
    const c = new CryptorV3();
    const { enc, id } = roundTrip(c, 'secret');
    const [ct, tag] = enc.split(':');
    const flip = (h) => (h[0] === '0' ? '1' : '0') + h.slice(1);
    assert.throws(() => c.decrypt(`${flip(ct)}:${tag}`, id));
    assert.throws(() => c.decrypt(`${ct}:${flip(tag)}`, id));
    for (const bad of [ct, `${ct}:`, `${ct}:abcd`, `${ct}:${tag}:x`, `zz:${tag}`, undefined]) {
        assert.throws(() => c.decrypt(bad, id), /Invalid encrypted payload/);
    }
});

test('V2 still decrypts legacy ciphertext', () => {
    const c = new CryptorV2();
    const { enc, id } = roundTrip(c, 'legacy');
    assert.strictEqual(id.length, 72);
    assert.ok(c.validateId(id));
    assert.strictEqual(new CryptorV2().decrypt(enc, id), 'legacy');
});

test('factory dispatch', () => {
    const f = new CryptorFactory();
    assert.ok(f.createCurrent() instanceof CryptorV3);
    assert.ok(f.createFromId('a'.repeat(72)) instanceof CryptorV2);
    assert.ok(f.createFromId('a'.repeat(68)) instanceof CryptorV3);
});
