const fs = require('fs');
const path = require('path');

// Ensure test data directory exists
const testDataDir = path.join(__dirname, '../data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Clean up test database before each test
beforeEach(() => {
  const testDbPath = path.join(testDataDir, 'read2burn.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Clean up any test files after tests
afterAll(() => {
  const testDbPath = path.join(testDataDir, 'read2burn.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});