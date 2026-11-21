"use strict";

const path = require("path"),
  fs = require("extfs"),
  rimraf = require("rimraf");

module.exports = {
  up: async function ({ context: nedb }) {
    console.log("MIGRATION 02_migrate2nedb.js: start migration to nedb.");
    const dbPath = process.env.LEGACY_DATA_DIR || path.resolve(__dirname, "../data");
    if (!fs.existsSync(dbPath)) {
      return; // fresh install: nothing to migrate
    }
    for (const item of fs.readdirSync(dbPath)) {
      const dirPath = path.resolve(dbPath, item);
      if (!fs.statSync(dirPath).isDirectory()) {
        continue;
      }
      for (const file of fs.readdirSync(dirPath)) {
        const filePath = path.resolve(dirPath, file);
        const timestamp = new Date(fs.statSync(filePath).ctime).getTime();
        const key = path.basename(filePath);
        const encrypted = JSON.parse(fs.readFileSync(filePath, "utf8")).encrypted;
        console.log(`Inserting secret: ${key}`);
        // the source file is only deleted once the insert has succeeded
        await nedb.insertAsync({ key, timestamp, encrypted });
        rimraf.sync(filePath);
      }
      if (fs.isEmptySync(dirPath)) {
        rimraf.sync(dirPath);
        console.log(`Removed empty directory: ${dirPath}`);
      }
    }
    console.log("MIGRATION 02_migrate2nedb.js: finish migration to nedb.");
  },
};
