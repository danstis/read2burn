"use strict";

// Keep policy per duplicate key: unconsumed > newest timestamp > lowest _id.
const rank = (a, b) =>
  (a.consumed ? 1 : 0) - (b.consumed ? 1 : 0) ||
  (b.timestamp || 0) - (a.timestamp || 0) ||
  (String(a._id) < String(b._id) ? -1 : String(a._id) > String(b._id) ? 1 : 0);

module.exports = {
  // Umzug v3: context is the NeDB datastore.
  up: async function ({ context: nedb }) {
    const groups = new Map();
    for (const doc of await nedb.findAsync({})) {
      if (!groups.has(doc.key)) {
        groups.set(doc.key, []);
      }
      groups.get(doc.key).push(doc);
    }
    for (const docs of groups.values()) {
      docs.sort(rank);
      for (const doc of docs.slice(1)) {
        await nedb.removeAsync({ _id: doc._id }, {});
      }
    }
    await nedb.ensureIndexAsync({ fieldName: "key", unique: true });
  },
};
