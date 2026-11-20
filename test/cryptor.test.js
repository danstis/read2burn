const test = require('node:test');
const assert = require('node:assert');
const cryptors = require('../lib/cryptor');
const { CryptorFactory, CryptorV2, CryptorV3 } = cryptors;

// Generated with the V2 implementation before this change using fixed password,
// IV, and salt. Keep the fixture independent of the current V2 encrypt method.
const LEGACY_ID = '000000000123456789abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyzABCDEF';
const LEGACY_CIPHERTEXT = '7e8dfed31872c809bbbb0b3bd599c9ff';

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
    for (const bad of [ct, `${ct}:`, `${ct}:abcd`, `${ct}:${tag}:x`, `zz:${tag}`, `abc:${tag}`, `:${tag}`, undefined]) {
        assert.throws(() => c.decrypt(bad, id), /Invalid encrypted payload/);
    }
});

test('V2 still decrypts legacy ciphertext', () => {
    assert.strictEqual(LEGACY_ID.length, 72);
    assert.ok(new CryptorV2().validateId(LEGACY_ID));
    assert.strictEqual(new CryptorV2().decrypt(LEGACY_CIPHERTEXT, LEGACY_ID), 'legacy V2 entry');
});

test('factory dispatch', () => {
    const f = new CryptorFactory();
    assert.ok(f.createCurrent() instanceof CryptorV3);
    assert.ok(f.createFromId('a'.repeat(72)) instanceof CryptorV2);
    assert.ok(f.createFromId('a'.repeat(68)) instanceof CryptorV3);
    for (const invalid of ['a'.repeat(19), 'a'.repeat(70), null, undefined, 123]) {
        assert.throws(() => f.createFromId(invalid), /Invalid id/);
    }
    assert.strictEqual(cryptors.CryptorV1, undefined);
});
