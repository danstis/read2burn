// Remove secrets older than `expiryMs`. `cb(err, numDeleted)`.
function cleanupExpired(nedb, expiryMs, cb) {
  const expireTime = Date.now() - expiryMs;
  nedb.remove({ timestamp: { $lte: expireTime } }, { multi: true }, cb);
}

module.exports = { cleanupExpired };
