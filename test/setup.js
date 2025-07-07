const fs = require('fs');
const path = require('path');

const testDataDir = path.join(__dirname, '../data');

// Clean up test database before each test
beforeEach(() => {
  // Ensure the test data directory exists.
  fs.mkdirSync(testDataDir, { recursive: true });
  const testDbPath = path.join(testDataDir, 'read2burn.db');
  // Now, safely attempt to remove the file.
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Clean up any test files after tests
afterAll(() => {
  // Use rmSync to remove the directory and its contents.
  // The force option prevents an exception if the path does not exist.
  fs.rmSync(testDataDir, { recursive: true, force: true });
});