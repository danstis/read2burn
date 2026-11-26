// Preload: first R2B_FIXED_KEY_CALLS randomBytes(8) calls (key generation) return a constant => forced collisions.
const crypto = require('node:crypto');
const orig = crypto.randomBytes;
let left = Number(process.env.R2B_FIXED_KEY_CALLS || 0);
crypto.randomBytes = function (n, ...rest) {
  if (n === 8 && left-- > 0) {
    return Buffer.alloc(8, 1);
  }
  return orig.call(this, n, ...rest);
};
