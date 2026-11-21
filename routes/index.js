/*
 * GET home page.
 */

const app = require('../app');
const { CryptorFactory } = require('../lib/cryptor');
const version = require('../version');

exports.index = function (req, res) {
    try {
        const nedb = app.nedb;
        const ERR_NO_SUCH_ENTRY = 'ERR_NO_SUCH_ENTRY';
        let url = "";
        let encrypted = "";
        const cf = new CryptorFactory();

        if (req.body.secret) {
            if (req.body.secret.length > 10000000) {
                res.status(413);
                res.send('Argument too large.');
            }
            const cryptor = cf.createCurrent();
            const secret = req.body.secret;

            const MAX_INSERT_RETRIES = 10;
            // Unique index on key makes insert atomic; retry with a fresh key on collision.
            const tryInsert = function (attempt) {
                const key = cryptor.createKey();
                const encrypted = cryptor.encrypt(secret);
                nedb.insert({ key, timestamp: Date.now(), encrypted }, function (err) {
                    if (err && err.errorType === 'uniqueViolated' && attempt < MAX_INSERT_RETRIES) {
                        return tryInsert(attempt + 1);
                    }
                    if (err) {
                        res.status(500);
                        res.send('Failed to save secret.');
                        return;
                    }
                    url = `${req.protocol}://${req.get('host')}/?id=${cryptor.getId()}`;
                    res.render('index', { url: url, secret: secret, error: undefined, found: false, version: version });
                });
            };
            tryInsert(1);
        } else if (req.body.id || req.query.id) {
            const id = req.query.id || req.body.id;
            let crypt;
            try {
                crypt = cf.createFromId(id);
            } catch {
                res.status(422);
                res.send('Invalid argument.');
                return;
            }
            if (!crypt.validateId(id)) {
                res.status(422);
                res.send('Invalid argument.');
            } else {
                const key = crypt.parseKey(id);
                nedb.findOne({ key }, function (err, doc) {
                    if (err) {
                        res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false, version: version });
                    } else {
                        try {
                            if (doc.encrypted && req.body.show) {
                                const encrypted = doc.encrypted;
                                const decrypted = crypt.decrypt(encrypted, id);
                                nedb.remove({ key }, function (err, numDeleted) {
                                    if (err) {
                                        console.error('Error removing entry:', err);
                                    } else {
                                        nedb.compactDatafile();
                                    }
                                });
                                res.render('index', { url: url, secret: decrypted, error: undefined, found: true, version: version });
                            } else {
                                res.render('index', { url: url, secret: false, error: undefined, found: true, id: id, version: version });
                            }
                        } catch {
                            res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false, version: version });
                        }
                    }
                });
            }
        } else {
            res.render('index', { url: url, secret: encrypted, error: undefined, found: false, version: version });
        }
    } catch (err) {
        console.log(err);
        res.status(500);
        res.send('Unexpected server error.');
    }
};

