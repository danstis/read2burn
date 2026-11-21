"use strict";

const Bluebird = require("bluebird");
const fs = require("extfs");
const { rimraf } = require("rimraf");
const path = require("node:path");
const mv = require("mv");
const { promisify } = require("node:util");
const { series } = require("../lib/series");

const mvAsync = promisify(mv);
const legacyDir = () => process.env.LEGACY_DATA_DIR || path.resolve(__dirname, "../data");

async function removeEmptyDir(dirPath) {
  await rimraf(dirPath);
  console.log("Removed empty directory:  " + dirPath);
}

async function moveDirectory(from, to) {
  await mvAsync(from, to);
  console.log('Moved directory "' + from + '" -> "' + to + '"');
}

async function moveFile(from, to) {
  if (fs.existsSync(to)) {
    console.warn("File '" + to + "' exists. Overwriting it!");
  }
  await mvAsync(from, to);
  console.log('Moved file "' + from + '" -> "' + to + '"');
}

// Move all files into the already existing shortened directory, one by one, then drop the emptied one.
async function mergeDirectory(from, to) {
  await series(fs.readdirSync(from), (file) => moveFile(path.resolve(from, file), path.join(to, file)));
  if (fs.isEmptySync(from)) {
    await removeEmptyDir(from);
  }
}

async function migrateEntry(dir, it) {
  const itsPath = path.resolve(dir, it);
  if (!fs.statSync(itsPath).isDirectory()) {
    return;
  }
  if (fs.isEmptySync(itsPath)) {
    return removeEmptyDir(itsPath);
  }
  const lastPath = path.basename(itsPath);
  if (lastPath.length <= 3) {
    return;
  }
  const shortendPath = itsPath.replace(lastPath, lastPath.substr(0, 3));
  return fs.existsSync(shortendPath) ? mergeDirectory(itsPath, shortendPath) : moveDirectory(itsPath, shortendPath);
}

module.exports = {
  up: async function () {
    console.log(
      "MIGRATION 01_migrate_data_directories.js: Migrating old long data directories to 3 character directories."
    );
    // rename data directories to the 3 characters, strictly one entry at a time
    const dir = legacyDir();
    if (!fs.existsSync(dir)) {
      return; // fresh install: nothing to migrate
    }
    await series(fs.readdirSync(dir), (it) => migrateEntry(dir, it));
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