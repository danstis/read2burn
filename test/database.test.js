const Datastore = require('@seald-io/nedb');

describe('Database operations', () => {
  let nedb;

  beforeEach(() => {
    // Create in-memory database for each test
    nedb = new Datastore();
  });

  describe('CRUD operations', () => {
    test('should insert a record', async () => {
      const record = {
        key: 'testkey123',
        timestamp: Date.now(),
        encrypted: 'encrypted_data',
        iv: 'test_iv',
        authTag: 'test_auth_tag'
      };

      const doc = await new Promise((resolve, reject) => {
        nedb.insert(record, (err, doc) => {
          if (err) {reject(err);}
          else {resolve(doc);}
        });
      });

      expect(doc).toHaveProperty('_id');
      expect(doc.key).toBe(record.key);
      expect(doc.encrypted).toBe(record.encrypted);
    });

    test('should find a record by key', async () => {
      const record = {
        key: 'testkey123',
        timestamp: Date.now(),
        encrypted: 'encrypted_data',
        iv: 'test_iv',
        authTag: 'test_auth_tag'
      };

      await new Promise((resolve, reject) => {
        nedb.insert(record, (err, doc) => {
          if (err) {reject(err);}
          else {resolve(doc);}
        });
      });

      const found = await new Promise((resolve, reject) => {
        nedb.findOne({ key: 'testkey123' }, (err, doc) => {
          if (err) {reject(err);}
          else {resolve(doc);}
        });
      });

      expect(found).toBeTruthy();
      expect(found.key).toBe('testkey123');
    });

    test('should remove a record', async () => {
      const record = {
        key: 'testkey123',
        timestamp: Date.now(),
        encrypted: 'encrypted_data',
        iv: 'test_iv',
        authTag: 'test_auth_tag'
      };

      await new Promise((resolve, reject) => {
        nedb.insert(record, (err, doc) => {
          if (err) {reject(err);}
          else {resolve(doc);}
        });
      });

      const numRemoved = await new Promise((resolve, reject) => {
        nedb.remove({ key: 'testkey123' }, (err, numRemoved) => {
          if (err) {reject(err);}
          else {resolve(numRemoved);}
        });
      });

      expect(numRemoved).toBe(1);

      const found = await new Promise((resolve, reject) => {
        nedb.findOne({ key: 'testkey123' }, (err, doc) => {
          if (err) {reject(err);}
          else {resolve(doc);}
        });
      });

      expect(found).toBeNull();
    });

    test('should remove expired records', async () => {
      const now = Date.now();
      const expiredTime = now - 100000; // 100 seconds ago
      
      const records = [
        {
          key: 'key1',
          timestamp: now,
          encrypted: 'data1',
          iv: 'iv1',
          authTag: 'tag1'
        },
        {
          key: 'key2',
          timestamp: expiredTime,
          encrypted: 'data2',
          iv: 'iv2',
          authTag: 'tag2'
        },
        {
          key: 'key3',
          timestamp: expiredTime,
          encrypted: 'data3',
          iv: 'iv3',
          authTag: 'tag3'
        }
      ];

      // Insert records
      for (const record of records) {
        await new Promise((resolve, reject) => {
          nedb.insert(record, (err, doc) => {
            if (err) {reject(err);}
            else {resolve(doc);}
          });
        });
      }

      // Remove expired records
      const expireTime = now - 50000; // 50 seconds ago
      const numRemoved = await new Promise((resolve, reject) => {
        nedb.remove(
          { timestamp: { $lte: expireTime } },
          { multi: true },
          (err, numRemoved) => {
            if (err) {reject(err);}
            else {resolve(numRemoved);}
          }
        );
      });

      expect(numRemoved).toBe(2);

      // Check remaining records
      const remaining = await new Promise((resolve, reject) => {
        nedb.find({}, (err, docs) => {
          if (err) {reject(err);}
          else {resolve(docs);}
        });
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].key).toBe('key1');
    });
  });

  describe('Data integrity', () => {
    test('should handle concurrent inserts', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const record = {
          key: `key${i}`,
          timestamp: Date.now(),
          encrypted: `data${i}`,
          iv: `iv${i}`,
          authTag: `tag${i}`
        };
        
        promises.push(new Promise((resolve, reject) => {
          nedb.insert(record, (err, doc) => {
            if (err) {reject(err);}
            else {resolve(doc);}
          });
        }));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      const allDocs = await new Promise((resolve, reject) => {
        nedb.find({}, (err, docs) => {
          if (err) {reject(err);}
          else {resolve(docs);}
        });
      });

      expect(allDocs).toHaveLength(10);
    });

    test('should handle unique key constraint', async () => {
      const record1 = {
        key: 'duplicate_key',
        timestamp: Date.now(),
        encrypted: 'data1',
        iv: 'iv1',
        authTag: 'tag1'
      };

      const record2 = {
        key: 'duplicate_key',
        timestamp: Date.now(),
        encrypted: 'data2',
        iv: 'iv2',
        authTag: 'tag2'
      };

      await new Promise((resolve, reject) => {
        nedb.insert(record1, (err, doc) => {
          if (err) {reject(err);}
          else {resolve(doc);}
        });
      });

      // Second insert should succeed (NeDB allows duplicates by default)
      await new Promise((resolve, reject) => {
        nedb.insert(record2, (err, doc) => {
          if (err) {reject(err);}
          else {resolve(doc);}
        });
      });

      const docs = await new Promise((resolve, reject) => {
        nedb.find({ key: 'duplicate_key' }, (err, docs) => {
          if (err) {reject(err);}
          else {resolve(docs);}
        });
      });

      expect(docs).toHaveLength(2);
    });
  });
});