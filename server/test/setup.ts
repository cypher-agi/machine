import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Test data directory
const TEST_DATA_DIR = path.join(process.cwd(), '.test-data');

// Setup test environment
beforeAll(() => {
  // Create test data directory
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }

  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Clean up test data directory
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// Mock console methods to reduce noise during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
// Keep console.error and console.warn for debugging
