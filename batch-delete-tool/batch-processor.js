import { EventEmitter } from 'events';
import { deleteCustomer } from './delete-customer.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// Adaptive rate limiter
class RateLimiter {
  constructor(config) {
    this.currentDelay = config.baseDelayMs;
    this.baseDelay = config.baseDelayMs;
    this.maxDelay = config.maxDelayMs;
    this.backoffMultiplier = config.backoffMultiplier;
    this.consecutiveSuccesses = 0;
  }

  async wait() {
    await sleep(this.currentDelay);
  }

  onSuccess() {
    this.consecutiveSuccesses++;
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
    return { oldDelay, newDelay: this.currentDelay };
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
    this.failedRecordsFile = `${this.logDir}/failed-records-${this.timestamp}.csv`;
    this.failedRecords = [];

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

  saveFailedRecords(columnName) {
    if (this.failedRecords.length === 0) return null;

    const csvHeader = `${columnName},error,status\n`;
    const csvRows = this.failedRecords
      .map(r => `"${r.identifier}","${r.error}",${r.status}`)
      .join('\n');

    writeFileSync(this.failedRecordsFile, csvHeader + csvRows);
    return this.failedRecordsFile;
  }

  getLogFile() {
    return this.logFile;
  }

  hasFailedRecords() {
    return this.failedRecords.length > 0;
  }
}

// Batch Processor
export class BatchProcessor extends EventEmitter {
  constructor(config) {
    super();
    this.records = config.records;
    this.identifierType = config.identifierType;
    this.columnName = config.columnName;
    this.deleteAll = config.deleteAll;
    this.apiKey = config.apiKey;
    this.region = config.region;
    this.rateLimit = config.rateLimit || {
      baseDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 1.5
    };
    this.retry = config.retry || {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2
    };
    this.cancelled = false;
    this.rateLimiter = new RateLimiter(this.rateLimit);
    this.logger = new Logger();
  }

  async deleteWithRetry(identifier, attempt = 1) {
    const deleteOptions = {
      [this.identifierType]: identifier,
      deleteAll: this.deleteAll,
      silent: true,
    };

    // Temporarily override API key in environment
    const originalKey = process.env.BLUESHIFT_USER_API_KEY;
    process.env.BLUESHIFT_USER_API_KEY = this.apiKey;
    process.env.BLUESHIFT_REGION = this.region;

    try {
      const result = await deleteCustomer(deleteOptions);
      return { success: true, result };
    } catch (error) {
      const status = error.status || 500;
      const shouldRetry =
        attempt < this.retry.maxAttempts &&
        (status === 429 || status >= 500);

      if (shouldRetry) {
        const delayMs = this.retry.initialDelayMs * Math.pow(this.retry.backoffMultiplier, attempt - 1);
        await sleep(delayMs);
        return this.deleteWithRetry(identifier, attempt + 1);
      }

      return {
        success: false,
        error: error.message,
        status: status,
        attempt: attempt,
      };
    } finally {
      // Restore original API key
      if (originalKey) {
        process.env.BLUESHIFT_USER_API_KEY = originalKey;
      } else {
        delete process.env.BLUESHIFT_USER_API_KEY;
      }
    }
  }

  cancel() {
    this.cancelled = true;
    this.emit('cancelled');
  }

  async start() {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    this.logger.log('=== Batch Delete Started ===');
    this.logger.log(`Total Records: ${this.records.length}`);
    this.logger.log(`Identifier Type: ${this.identifierType}`);
    this.logger.log(`Column Name: ${this.columnName}`);

    this.emit('start', { total: this.records.length });

    for (let i = 0; i < this.records.length; i++) {
      if (this.cancelled) {
        this.logger.log('Batch processing cancelled by user');
        this.emit('cancelled');
        break;
      }

      const record = this.records[i];
      const identifier = record[this.columnName];
      const current = i + 1;
      const total = this.records.length;
      const percentage = ((current / total) * 100).toFixed(1);

      this.emit('progress', { current, total, percentage });

      const result = await this.deleteWithRetry(identifier);

      if (result.success) {
        successCount++;
        this.logger.log(`SUCCESS: ${identifier}`);
        this.emit('success', { identifier, current, total });
        this.rateLimiter.onSuccess();
      } else {
        failureCount++;
        this.logger.log(`FAILED: ${identifier} - Status: ${result.status} - Error: ${result.error}`);
        this.logger.addFailedRecord(identifier, result.error, result.status);
        this.emit('failure', { identifier, error: result.error, status: result.status, current, total });

        if (result.status === 429) {
          const delays = this.rateLimiter.onRateLimit();
          this.emit('rateLimit', { oldDelay: delays.oldDelay, newDelay: delays.newDelay });
        }
      }

      if (i < this.records.length - 1) {
        await this.rateLimiter.wait();
      }
    }

    const duration = Date.now() - startTime;
    const failedRecordsFile = this.logger.saveFailedRecords(this.columnName);

    this.logger.log('=== Batch Delete Completed ===');
    this.logger.log(`Total Processed: ${this.records.length}`);
    this.logger.log(`Successful: ${successCount}`);
    this.logger.log(`Failed: ${failureCount}`);
    this.logger.log(`Duration: ${formatDuration(duration)}`);

    this.emit('complete', {
      successCount,
      failureCount,
      totalProcessed: this.records.length,
      duration: formatDuration(duration),
      durationMs: duration,
      logFile: this.logger.getLogFile(),
      failedRecordsFile,
      hasFailedRecords: this.logger.hasFailedRecords()
    });

    // Clear API key from memory
    this.apiKey = null;
  }
}
