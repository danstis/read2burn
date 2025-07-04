/*
 * GET home page.
 */

const crypto = require("crypto");
const app = require("../app");
const version = require("../version");

exports.index = function (req, res) {
  try {
    const nedb = app.nedb;
    const CIPHER_ALGORITHM = "aes256";
    const ERR_NO_SUCH_ENTRY = "ERR_NO_SUCH_ENTRY";
    const FILE_KEY_LENGTH = 8;
    const PASSWORD_KEY_LENGTH = 12;

    let url = "";
    let encrypted = "";

    if (req.body.secret) {
      const secret = req.body.secret;
      const key = uid(FILE_KEY_LENGTH);
      // TODO: Look for key in database
      // if exists, create another key
      const password = uid(PASSWORD_KEY_LENGTH);
      const timestamp = new Date().getTime();
      const iv = crypto.randomBytes(16);
      const derivedKey = crypto.createHash('sha256').update(password).digest();
      const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
      const entry = { key, timestamp, encrypted, iv: iv.toString('hex') };
      nedb.insert(entry, function (err, doc) {
        if (err) {
          console.error("Error inserting record:", err);
          // Handle the error appropriately
          // For now, just log it and don't proceed
          return;
        }
        url = `${req.protocol}://${req.get("host")}/?key=${key + password}`;
        res.render("index", {
          url: url,
          secret: secret,
          error: undefined,
          found: false,
          version: version,
        });
        if (doc) {
          console.log("Inserted", doc.key, "with ID", doc._id);
        }
      });
    } else if (req.query.key || req.body.key) {
      let p = req.query.key;
      if (!p) p = req.body.key;
      const key = p.substr(0, FILE_KEY_LENGTH);
      const password = p.substr(FILE_KEY_LENGTH, PASSWORD_KEY_LENGTH);
      nedb.findOne({ key }, function (err, doc) {
        try {
          if (doc.encrypted && req.body.show) {
            const encrypted = doc.encrypted;
            const iv = Buffer.from(doc.iv, 'hex');
            const derivedKey = crypto.createHash('sha256').update(password).digest();
            const decipher = crypto.createDecipheriv(
              CIPHER_ALGORITHM,
              derivedKey,
              iv
            );
            const decrypted =
              decipher.update(encrypted, "hex", "utf8") +
              decipher.final("utf8");
            /*eslint no-unused-vars: "warn"*/
            nedb.remove({ key }, function (err, numDeleted) {
              nedb.persistence.compactDatafile();
            });
            res.render("index", {
              url: url,
              secret: decrypted,
              error: undefined,
              found: true,
              version: version,
            });
          } else {
            res.render("index", {
              url: url,
              secret: false,
              error: undefined,
              found: true,
              key: p,
              version: version,
            });
          }
        } catch (e) {
          res.render("index", {
            url: url,
            secret: false,
            error: ERR_NO_SUCH_ENTRY,
            found: false,
            version: version,
          });
        }
      });
    } else {
      res.render("index", {
        url: url,
        secret: encrypted,
        error: undefined,
        found: false,
        version: version,
      });
    }
  } catch (err) {
    console.log(err);
  }
};

// Generate a secure random string of a given length, containing characters a-zA-Z0-9. If no length is given, return a random string of length 7.
function uid(len) {
  len = len || 7;
  return crypto
    .randomBytes(len)
    .toString("base64")
    .slice(0, len)
    .replace(/\+/g, "0")
    .replace(/\//g, "0");
}
