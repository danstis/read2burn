const crypto = require('crypto');
const Datastore = require('@seald-io/nedb');

describe('Route Logic Unit Tests', () => {
  let nedb;
  const CIPHER_ALGORITHM = "aes-256-gcm";
  const FILE_KEY_LENGTH = 8;
  const PASSWORD_KEY_LENGTH = 12;

  function uid(len) {
    len = len || 7;
    return crypto
      .randomBytes(len)
      .toString("base64")
      .slice(0, len)
      .replace(/\+/g, "0")
      .replace(/\//g, "0");
  }

  beforeEach(() => {
    nedb = new Datastore();
  });

  test('should create and store a secret', async () => {
    const secret = 'Test secret message';
    const key = uid(FILE_KEY_LENGTH);
    const password = uid(PASSWORD_KEY_LENGTH);
    const timestamp = new Date().getTime();
    const iv = crypto.randomBytes(12);
    const derivedKey = crypto.createHash('sha256').update(password).digest();
    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
    const encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const entry = { key, timestamp, encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
    
    const doc = await new Promise((resolve, reject) => {
      nedb.insert(entry, (err, doc) => {
        if (err) {reject(err);}
        else {resolve(doc);}
      });
    });

    expect(doc).toHaveProperty('_id');
    expect(doc.key).toBe(key);
    expect(doc.encrypted).toBe(encrypted);
  });

  test('should retrieve and decrypt a secret', async () => {
    const secret = 'Test secret message';
    const key = uid(FILE_KEY_LENGTH);
    const password = uid(PASSWORD_KEY_LENGTH);
    const timestamp = new Date().getTime();
    const iv = crypto.randomBytes(12);
    const derivedKey = crypto.createHash('sha256').update(password).digest();
    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
    const encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const entry = { key, timestamp, encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
    
    // Insert the entry
    await new Promise((resolve, reject) => {
      nedb.insert(entry, (err, doc) => {
        if (err) {reject(err);}
        else {resolve(doc);}
      });
    });

    // Find and decrypt
    const doc = await new Promise((resolve, reject) => {
      nedb.findOne({ key }, (err, doc) => {
        if (err) {reject(err);}
        else {resolve(doc);}
      });
    });

    expect(doc).toBeTruthy();
    
    const retrievedIv = Buffer.from(doc.iv, 'hex');
    const retrievedAuthTag = Buffer.from(doc.authTag, 'hex');
    const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, derivedKey, retrievedIv);
    decipher.setAuthTag(retrievedAuthTag);
    const decrypted = decipher.update(doc.encrypted, 'hex', 'utf8') + decipher.final('utf8');
    
    expect(decrypted).toBe(secret);
  });

  test('should delete secret after retrieval', async () => {
    const secret = 'Test secret message';
    const key = uid(FILE_KEY_LENGTH);
    const password = uid(PASSWORD_KEY_LENGTH);
    const timestamp = new Date().getTime();
    const iv = crypto.randomBytes(12);
    const derivedKey = crypto.createHash('sha256').update(password).digest();
    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
    const encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const entry = { key, timestamp, encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
    
    // Insert the entry
    await new Promise((resolve, reject) => {
      nedb.insert(entry, (err, doc) => {
        if (err) {reject(err);}
        else {resolve(doc);}
      });
    });

    // Remove the entry
    const numRemoved = await new Promise((resolve, reject) => {
      nedb.remove({ key }, (err, numRemoved) => {
        if (err) {reject(err);}
        else {resolve(numRemoved);}
      });
    });

    expect(numRemoved).toBe(1);

    // Verify it's gone
    const doc = await new Promise((resolve, reject) => {
      nedb.findOne({ key }, (err, doc) => {
        if (err) {reject(err);}
        else {resolve(doc);}
      });
    });

    expect(doc).toBeNull();
  });
});