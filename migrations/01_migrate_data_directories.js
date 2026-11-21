"use strict";

var Bluebird = require("bluebird");
var fs = require("extfs");
const { rimraf } = require("rimraf");
var path = require("path");
var mv = require("mv");
const legacyDir = () => process.env.LEGACY_DATA_DIR || path.resolve(__dirname, "../data");

const mvAsync = require("util").promisify(mv);

module.exports = {
  up: async function () {
    console.log(
      "MIGRATION 01_migrate_data_directories.js: Migrating old long data directories to 3 character directories."
    );
    // rename data directories to the 3 characters
    const dir = legacyDir();
    if (!fs.existsSync(dir)) {
      return; // fresh install: nothing to migrate
    }
    for (const it of fs.readdirSync(dir)) {
      const itsPath = path.resolve(dir, it);
      if (!fs.statSync(itsPath).isDirectory()) {
        continue;
      }
      if (fs.isEmptySync(itsPath)) {
        await rimraf(itsPath);
        console.log("Removed empty directory:  " + itsPath);
        continue;
      }
      const lastPath = path.basename(itsPath);
      if (lastPath.length <= 3) {
        continue;
      }
      const shortendPath = itsPath.replace(lastPath, lastPath.substr(0, 3));
      if (!fs.existsSync(shortendPath)) {
        await mvAsync(itsPath, shortendPath);
        console.log('Moved directory "' + itsPath + '" -> "' + shortendPath + '"');
        continue;
      }
      // Move all files to the shortened path
      for (const file of fs.readdirSync(itsPath)) {
        const srcPath = path.resolve(itsPath, file);
        const dstPath = path.join(shortendPath, path.basename(srcPath));
        if (fs.existsSync(dstPath)) {
          console.warn("File '" + dstPath + "' exists. Overwriting it!");
        }
        await mvAsync(srcPath, dstPath);
        console.log('Moved file "' + srcPath + '" -> "' + dstPath + '"');
      }
      if (fs.isEmptySync(itsPath)) {
        await rimraf(itsPath);
        console.log("Removed empty directory:  " + itsPath);
      }
    }
  },

  down: function () {
    return new Bluebird(function (resolve, reject) {
      console.log("01_migrate_data_directories.js:down");
      // Describe how to revert the task.
      // Call resolve/reject at some point.
      reject();
    });
  },
};