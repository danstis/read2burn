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
            let found = false;
            let key = null;
            const secret = req.body.secret;
            do {
                key = cryptor.createKey();
                nedb.findOne({ key }, function (err, doc) {
                    if (doc) {
                        found = true;
                    }
                });
            } while (found);

            const timestamp = new Date().getTime();
            const encrypted = cryptor.encrypt(secret);
            const entry = { key, timestamp, encrypted }
            nedb.insert(entry, function (err, doc) {
                url = `${req.protocol}://${req.get('host')}/?id=${cryptor.getId()}`;
                res.render('index', { url: url, secret: secret, error: undefined, found: false, version: version });
            });
            // parameter 'key' is deprecated, remove related code after 01.01.2025
        } else if (req.query.key || req.body.id || req.query.id) {
            let id = req.query.key;
            if (!id) id = req.query.id;
            if (!id) id = req.body.id;
            const crypt = cf.createFromId(id);
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
                                    nedb.compactDatafile();
                                });
                                res.render('index', { url: url, secret: decrypted, error: undefined, found: true, version: version });
                            } else {
                                res.render('index', { url: url, secret: false, error: undefined, found: true, id: id, version: version });
                            }
                        } catch (e) {
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

