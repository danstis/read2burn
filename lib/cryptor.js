const crypto = require('crypto');
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const base62 = require('base-x').default(BASE62);

class CryptorFactory {
    createFromId(id) {
        return id.length === CryptorV3.ID_LENGTH ? new CryptorV3() : new CryptorV2();
    }

    createCurrent() {
        return new CryptorV3();
    }
}

class Cryptor {
    static KEY_LENGTH = 8;

    constructor() {
        this.KEY_LENGTH = Cryptor.KEY_LENGTH;
        this.key = null;
    }

    encrypt() {
        throw new Error('This method must be implemented by concrete classes.');
    }

    decrypt() {
        throw new Error('This method must be implemented by concrete classes.');
    }

    getId() {
        throw new Error('This method must be implemented by concrete classes.');
    }

    validateId() {
        throw new Error('This method must be implemented by concrete classes.');
    }

    parseKey(id) {
        return id.substr(0, this.KEY_LENGTH);
    }

    createKey() {
        this.key = this.uid(this.KEY_LENGTH);
        return this.key;
    }

    uid(len) {
        return base62.encode(crypto.randomBytes(len)).slice(0, len);
    }
}

class CryptorV2 extends Cryptor {
    static PASSWORD_LENGTH = 32;
    static IV_LENGTH = 16;
    static SALT_LENGTH = 16;
    static ID_LENGTH = Cryptor.KEY_LENGTH + CryptorV2.PASSWORD_LENGTH + CryptorV2.IV_LENGTH + CryptorV2.SALT_LENGTH;
    static CIPHER_ALGORITHM = 'aes-256-cbc';

    constructor() {
        super();
        this.password = null;
        this.iV = null;
        this.salt = null;
    }

    encrypt(message) {
        // store in members to be used later to create the parameter 'id'
        this.password = Buffer.from(this.uid(CryptorV2.PASSWORD_LENGTH));
        this.iV = Buffer.from(this.uid(CryptorV2.IV_LENGTH));
        this.salt = Buffer.from(this.uid(CryptorV2.SALT_LENGTH));
        const passKey = crypto.scryptSync(this.password, this.salt, 32);
        const cipher = crypto.createCipheriv(CryptorV2.CIPHER_ALGORITHM, passKey, this.iV);
        return cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
    }

    decrypt(message, id) {
        const { password, iV, salt } = this.splitId(id);
        const passKey = crypto.scryptSync(password, salt, 32);
        const decipher = crypto.createDecipheriv(CryptorV2.CIPHER_ALGORITHM, passKey, iV);
        return decipher.update(message, 'hex', 'utf8') + decipher.final('utf8');
    }

    splitId(id) {
        const buf = Buffer.from(id);
        let o = Cryptor.KEY_LENGTH;
        const take = (n) => buf.subarray(o, (o += n));
        return { password: take(CryptorV2.PASSWORD_LENGTH), iV: take(CryptorV2.IV_LENGTH), salt: take(CryptorV2.SALT_LENGTH) };
    }

    getId() {
        return this.key.toString() + this.password.toString() + this.iV.toString() + this.salt.toString();
    }

    validateId(id) {
        return id.length === CryptorV2.ID_LENGTH && /^[a-zA-Z0-9]+$/.test(id);
    }
}

/**
 * AES-256-GCM authenticated encryption. Stored payload: `<cipherHex>:<authTagHex>`.
 */
class CryptorV3 extends Cryptor {
    static PASSWORD_LENGTH = 32;
    static IV_LENGTH = 12;
    static SALT_LENGTH = 16;
    static TAG_LENGTH = 16;
    static ID_LENGTH = Cryptor.KEY_LENGTH + CryptorV3.PASSWORD_LENGTH + CryptorV3.IV_LENGTH + CryptorV3.SALT_LENGTH;
    static CIPHER_ALGORITHM = 'aes-256-gcm';

    constructor() {
        super();
        this.password = null;
        this.iV = null;
        this.salt = null;
    }

    encrypt(message) {
        this.password = Buffer.from(this.uid(CryptorV3.PASSWORD_LENGTH));
        this.iV = Buffer.from(this.uid(CryptorV3.IV_LENGTH));
        this.salt = Buffer.from(this.uid(CryptorV3.SALT_LENGTH));
        const passKey = crypto.scryptSync(this.password, this.salt, 32);
        const cipher = crypto.createCipheriv(CryptorV3.CIPHER_ALGORITHM, passKey, this.iV);
        const encrypted = cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
        return `${encrypted}:${cipher.getAuthTag().toString('hex')}`;
    }

    decrypt(message, id) {
        const parts = typeof message === 'string' ? message.split(':') : [];
        if (parts.length !== 2 || !/^([0-9a-f]{2})*$/i.test(parts[0]) || !new RegExp(`^[0-9a-f]{${CryptorV3.TAG_LENGTH * 2}}$`, 'i').test(parts[1])) {
            throw new Error('Invalid encrypted payload.');
        }
        const buf = Buffer.from(id);
        let o = Cryptor.KEY_LENGTH;
        const take = (n) => buf.subarray(o, (o += n));
        const password = take(CryptorV3.PASSWORD_LENGTH);
        const iV = take(CryptorV3.IV_LENGTH);
        const salt = take(CryptorV3.SALT_LENGTH);
        const decipher = crypto.createDecipheriv(CryptorV3.CIPHER_ALGORITHM, crypto.scryptSync(password, salt, 32), iV);
        decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
        return decipher.update(parts[0], 'hex', 'utf8') + decipher.final('utf8');
    }

    getId() {
        return this.key.toString() + this.password.toString() + this.iV.toString() + this.salt.toString();
    }

    validateId(id) {
        return id.length === CryptorV3.ID_LENGTH && /^[a-zA-Z0-9]+$/.test(id);
    }
}

module.exports = { CryptorFactory, Cryptor, CryptorV2, CryptorV3 };
