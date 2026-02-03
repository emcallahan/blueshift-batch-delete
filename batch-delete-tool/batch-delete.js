import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { deleteCustomer } from './delete-customer.js';

// Load environment variables
dotenv.config();

// Load configuration
function loadConfig() {
  try {
    const configData = readFileSync('./config.json', 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('❌ Error loading config.json:', error.message);
    console.error('Please ensure config.json exists in the current directory.');
    process.exit(1);
  }
}

// Validate configuration
function validateConfig(config) {
  const errors = [];

  // Check required fields
  if (!config.csvFile) errors.push('csvFile is required');
  if (!config.identifierType) errors.push('identifierType is required');
  if (!config.csvColumnName) errors.push('csvColumnName is required');

  // Validate identifier type
  const validIdentifiers = ['email', 'customer_id', 'cookie', 'device_id'];
  if (config.identifierType && !validIdentifiers.includes(config.identifierType)) {
    errors.push(`identifierType must be one of: ${validIdentifiers.join(', ')}`);
  }

  // Check CSV file exists
  if (config.csvFile && !existsSync(config.csvFile)) {
    errors.push(`CSV file not found: ${config.csvFile}`);
  }

  // Validate rate limit settings
  if (config.rateLimit) {
    if (typeof config.rateLimit.baseDelayMs !== 'number' || config.rateLimit.baseDelayMs < 0) {
      errors.push('rateLimit.baseDelayMs must be a positive number');
    }
    if (typeof config.rateLimit.maxDelayMs !== 'number' || config.rateLimit.maxDelayMs < 0) {
      errors.push('rateLimit.maxDelayMs must be a positive number');
    }
  }

  // Validate retry settings
  if (config.retry) {
    if (typeof config.retry.maxAttempts !== 'number' || config.retry.maxAttempts < 1) {
      errors.push('retry.maxAttempts must be a positive number');
    }
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  return true;
}

// Load and parse CSV
function loadCSV(config) {
  try {
    const csvContent = readFileSync(config.csvFile, 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      console.error('❌ CSV file is empty');
      process.exit(1);
    }

    // Validate column exists
    if (!records[0].hasOwnProperty(config.csvColumnName)) {
      console.error(`❌ Column '${config.csvColumnName}' not found in CSV`);
      console.error(`Available columns: ${Object.keys(records[0]).join(', ')}`);
      process.exit(1);
    }

    return records;
  } catch (error) {
    console.error('❌ Error reading CSV file:', error.message);
    process.exit(1);
  }
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper with exponential backoff
async function deleteWithRetry(identifier, config, attempt = 1) {
  const { retry } = config;
  const deleteOptions = {
    [config.identifierType]: identifier,
    deleteAll: config.deleteAll,
    silent: true,
  };

  try {
    const result = await deleteCustomer(deleteOptions);
    return { success: true, result };
  } catch (error) {
    const status = error.status || 500;

    // Determine if we should retry
    const shouldRetry =
      attempt < retry.maxAttempts &&
      (status === 429 || status >= 500);

    if (shouldRetry) {
      const delayMs = retry.initialDelayMs * Math.pow(retry.backoffMultiplier, attempt - 1);
      await sleep(delayMs);
      return deleteWithRetry(identifier, config, attempt + 1);
    }

    // Return failure
    return {
      success: false,
      error: error.message,
      status: status,
      attempt: attempt,
    };
  }
}

// Adaptive rate limiter
class RateLimiter {
  constructor(config) {
    this.currentDelay = config.rateLimit.baseDelayMs;
    this.baseDelay = config.rateLimit.baseDelayMs;
    this.maxDelay = config.rateLimit.maxDelayMs;
    this.backoffMultiplier = config.rateLimit.backoffMultiplier;
    this.consecutiveSuccesses = 0;
  }

  async wait() {
    await sleep(this.currentDelay);
  }

  onSuccess() {
    this.consecutiveSuccesses++;
    // Gradually decrease delay after multiple successes
    if (this.consecutiveSuccesses >= 10 && this.currentDelay > this.baseDelay) {
      this.currentDelay = Math.max(
        this.baseDelay,
        this.currentDelay / this.backoffMultiplier
      );
      this.consecutiveSuccesses = 0;
    }
  }

  onRateLimit() {
    this.consecutiveSuccesses = 0;
    const oldDelay = this.currentDelay;
    this.currentDelay = Math.min(
      this.maxDelay,
      this.currentDelay * this.backoffMultiplier
    );
    console.log(`⚠️  Rate limited - increasing delay from ${oldDelay}ms to ${this.currentDelay}ms`);
  }

  getCurrentDelay() {
    return this.currentDelay;
  }
}

// Logger
class Logger {
  constructor() {
    this.logDir = './logs';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    this.logFile = `${this.logDir}/batch-log-${this.timestamp}.txt`;
    this.failedRecordsFile = `${this.logDir}/failed-records.csv`;
    this.failedRecords = [];

    // Create logs directory if it doesn't exist
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    writeFileSync(this.logFile, logMessage, { flag: 'a' });
  }

  addFailedRecord(identifier, error, status) {
    this.failedRecords.push({ identifier, error, status });
  }

  saveFailedRecords(config) {
    if (this.failedRecords.length === 0) return;

    const csvHeader = `${config.csvColumnName},error,status\n`;
    const csvRows = this.failedRecords
      .map(r => `"${r.identifier}","${r.error}",${r.status}`)
      .join('\n');

    writeFileSync(this.failedRecordsFile, csvHeader + csvRows);
  }

  getLogFile() {
    return this.logFile;
  }

  getFailedRecordsFile() {
    return this.failedRecordsFile;
  }

  hasFailedRecords() {
    return this.failedRecords.length > 0;
  }
}

// Get user confirmation
async function getUserConfirmation(message) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'yes');
    });
  });
}

// Format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Main batch processing function
async function batchDelete() {
  console.log('\n🔵 Blueshift Batch Delete');
  console.log('=========================\n');

  // Load and validate configuration
  const config = loadConfig();
  validateConfig(config);

  // Load CSV
  const records = loadCSV(config);

  // Display summary
  console.log(`CSV File: ${config.csvFile}`);
  console.log(`Identifier: ${config.identifierType} (column: ${config.csvColumnName})`);
  console.log(`Total Records: ${records.length}`);
  console.log(`Delete All: ${config.deleteAll ? 'Yes' : 'No'}`);
  console.log('=========================\n');

  // Get confirmation
  const confirmed = await getUserConfirmation(
    `⚠️  WARNING: This will permanently delete ${records.length} customer records!\nContinue? (yes/no): `
  );

  if (!confirmed) {
    console.log('\nOperation cancelled.');
    process.exit(0);
  }

  console.log('\nStarting batch deletion...\n');

  // Initialize tracking
  const startTime = Date.now();
  const logger = new Logger();
  const rateLimiter = new RateLimiter(config);
  let successCount = 0;
  let failureCount = 0;

  // Log start
  logger.log('=== Batch Delete Started ===');
  logger.log(`CSV File: ${config.csvFile}`);
  logger.log(`Total Records: ${records.length}`);
  logger.log(`Identifier Type: ${config.identifierType}`);
  logger.log(`Column Name: ${config.csvColumnName}`);

  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const identifier = record[config.csvColumnName];
    const progress = ((i + 1) / records.length * 100).toFixed(1);

    console.log(`Processing... [${i + 1}/${records.length}] (${progress}%)`);

    // Delete with retry
    const result = await deleteWithRetry(identifier, config);

    if (result.success) {
      successCount++;
      console.log(`✓ Deleted: ${identifier}`);
      logger.log(`SUCCESS: ${identifier}`);
      rateLimiter.onSuccess();
    } else {
      failureCount++;
      console.log(`✗ Failed: ${identifier} (${result.status}: ${result.error})`);
      logger.log(`FAILED: ${identifier} - Status: ${result.status} - Error: ${result.error}`);
      logger.addFailedRecord(identifier, result.error, result.status);

      // Increase delay if rate limited
      if (result.status === 429) {
        rateLimiter.onRateLimit();
      }
    }

    // Apply rate limiting (except for last record)
    if (i < records.length - 1) {
      await rateLimiter.wait();
    }
  }

  // Calculate duration
  const duration = Date.now() - startTime;

  // Save failed records
  logger.saveFailedRecords(config);
  logger.log('=== Batch Delete Completed ===');
  logger.log(`Total Processed: ${records.length}`);
  logger.log(`Successful: ${successCount}`);
  logger.log(`Failed: ${failureCount}`);
  logger.log(`Duration: ${formatDuration(duration)}`);

  // Display summary
  console.log('\n=========================');
  console.log('Summary:');
  console.log('=========================');
  console.log(`Total Processed: ${records.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Duration: ${formatDuration(duration)}`);
  console.log('=========================\n');

  if (logger.hasFailedRecords()) {
    console.log(`Failed records saved to: ${logger.getFailedRecordsFile()}`);
  }
  console.log(`Full log saved to: ${logger.getLogFile()}\n`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  batchDelete().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export { batchDelete };
