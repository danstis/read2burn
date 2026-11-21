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
            if (req.body.secret.length > req.app.locals.maxSecretChars) {
                return res.status(413).send('Argument too large.');
            }
            const cryptor = cf.createCurrent();
            const secret = req.body.secret;

            // Helper function to generate a unique key asynchronously
            function generateUniqueKey(callback) {
                const key = cryptor.createKey();
                nedb.findOne({ key }, function (err, doc) {
                    if (err) {
                        // Handle the error appropriately, e.g., log and return
                        console.error('Error during findOne in generateUniqueKey:', err);
                        return callback(null);
                    }
                    if (doc) {
                        // Key exists, try again
                        generateUniqueKey(callback);
                    } else {
                        // Key is unique
                        callback(key);
                    }
                });
            }

            generateUniqueKey(function (key) {
                if (!key) {
                    // Error occurred during key generation
                    res.status(500);
                    res.send('Unexpected server error.');
                    return;
                }
                const timestamp = Date.now();
                const encrypted = cryptor.encrypt(secret);
                const entry = { key, timestamp, encrypted };
                nedb.insert(entry, function (err) {
                    if (err) {
                        res.status(500);
                        res.send('Failed to save secret.');
                        return;
                    }
                    url = `${req.protocol}://${req.get('host')}/?id=${cryptor.getId()}`;
                    res.render('index', { url: url, secret: secret, error: undefined, found: false, version: version });
                });
            });
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
                return res.status(422).send('Invalid argument.');
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

