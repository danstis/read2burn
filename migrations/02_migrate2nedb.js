"use strict";

const path = require("node:path"),
  fs = require("extfs"),
  rimraf = require("rimraf");
const { series } = require("../lib/series");

// the source file is only deleted once the insert has succeeded
async function migrateFile(nedb, filePath) {
  const timestamp = new Date(fs.statSync(filePath).ctime).getTime();
  const key = path.basename(filePath);
  const encrypted = JSON.parse(fs.readFileSync(filePath, "utf8")).encrypted;
  console.log(`Inserting secret: ${key}`);
  await nedb.insertAsync({ key, timestamp, encrypted });
  rimraf.sync(filePath);
}

async function migrateDir(nedb, dirPath) {
  if (!fs.statSync(dirPath).isDirectory()) {
    return;
  }
  await series(fs.readdirSync(dirPath), (file) => migrateFile(nedb, path.resolve(dirPath, file)));
  if (fs.isEmptySync(dirPath)) {
    rimraf.sync(dirPath);
    console.log(`Removed empty directory: ${dirPath}`);
  }
}

module.exports = {
  up: async function ({ context: nedb }) {
    console.log("MIGRATION 02_migrate2nedb.js: start migration to nedb.");
    const dbPath = process.env.LEGACY_DATA_DIR || path.resolve(__dirname, "../data");
    if (!fs.existsSync(dbPath)) {
      return; // fresh install: nothing to migrate
    }
    await series(fs.readdirSync(dbPath), (item) => migrateDir(nedb, path.resolve(dbPath, item)));
    console.log("MIGRATION 02_migrate2nedb.js: finish migration to nedb.");
  },
};
