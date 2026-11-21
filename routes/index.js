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
                res.status(422);
                res.send('Invalid argument.');
            } else {
                const key = crypt.parseKey(id);
                const notFound = () => res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false, version: version });
                const live = { key, consumed: { $ne: true } };
                if (req.body.show) {
                    // Atomically claim the entry; only one concurrent request gets the doc back.
                    nedb.update(live, { $set: { consumed: true, consumedAt: new Date().getTime() } }, { returnUpdatedDocs: true }, function (err, numAffected, doc) {
                        if (err || !numAffected || !doc || !doc.encrypted) {
                            return notFound();
                        }
                        let decrypted;
                        try {
                            decrypted = crypt.decrypt(doc.encrypted, id);
                        } catch {
                            return notFound();
                        } finally {
                            nedb.remove({ key, consumed: true }, function (err) {
                                if (err) {
                                    console.error('Error removing entry:', err);
                                } else {
                                    nedb.compactDatafile();
                                }
                            });
                        }
                        res.render('index', { url: url, secret: decrypted, error: undefined, found: true, version: version });
                    });
                } else {
                    nedb.findOne(live, function (err, doc) {
                        if (err || !doc || !doc.encrypted) {
                            return notFound();
                        }
                        res.render('index', { url: url, secret: false, error: undefined, found: true, id: id, version: version });
                    });
                }
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

