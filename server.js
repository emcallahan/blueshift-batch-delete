import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { BatchProcessor } from './batch-processor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Job state
let currentJob = {
  processor: null,
  status: 'idle', // idle, running, completed, cancelled, error
  filePath: null,
  sseClients: [],
};

// Helper to broadcast SSE events
function broadcastSSE(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  currentJob.sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error broadcasting to SSE client:', error);
    }
  });
}

// API: Parse CSV and return column info
app.post('/api/parse-csv', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const hasHeaders = req.body.hasHeaders === 'true';
    const csvContent = readFileSync(req.file.path, 'utf8');

    const records = parse(csvContent, {
      columns: hasHeaders,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Get column names
    let columns;
    if (hasHeaders) {
      columns = Object.keys(records[0]);
    } else {
      // If no headers, create column names like "Column 1", "Column 2", etc.
      const firstRow = records[0];
      columns = Object.keys(firstRow).map((key, index) => `Column ${index + 1}`);
    }

    // Get preview (first 5 rows)
    const preview = records.slice(0, 5);

    // Store file path for later use
    currentJob.filePath = req.file.path;

    res.json({
      columns,
      rowCount: records.length,
      preview,
      filePath: req.file.path
    });
  } catch (error) {
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    console.error('Error parsing CSV:', error);
    res.status(500).json({ error: 'Failed to parse CSV file: ' + error.message });
  }
});

// API: Start batch processing
app.post('/api/start-batch', async (req, res) => {
  try {
    if (currentJob.status === 'running') {
      return res.status(409).json({ error: 'A batch job is already running' });
    }

    const { apiKey, region, identifierType, columnName, deleteAll, hasHeaders, filePath } = req.body;

    // Validation
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    if (!region || !['us', 'eu'].includes(region)) {
      return res.status(400).json({ error: 'Invalid region. Must be "us" or "eu"' });
    }
    if (!identifierType || !['email', 'customer_id', 'device_id', 'cookie'].includes(identifierType)) {
      return res.status(400).json({ error: 'Invalid identifier type' });
    }
    if (!columnName) {
      return res.status(400).json({ error: 'Column name is required' });
    }
    if (!filePath || !existsSync(filePath)) {
      return res.status(400).json({ error: 'CSV file not found. Please upload again.' });
    }

    // Parse CSV
    const csvContent = readFileSync(filePath, 'utf8');
    const records = parse(csvContent, {
      columns: hasHeaders === true || hasHeaders === 'true',
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Validate column exists
    if (!records[0].hasOwnProperty(columnName)) {
      return res.status(400).json({
        error: `Column '${columnName}' not found in CSV. Available columns: ${Object.keys(records[0]).join(', ')}`
      });
    }

    // Create batch processor
    const processor = new BatchProcessor({
      records,
      identifierType,
      columnName,
      deleteAll: deleteAll === true || deleteAll === 'true',
      apiKey,
      region,
      rateLimit: {
        baseDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 1.5
      },
      retry: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2
      }
    });

    // Set up event listeners
    processor.on('start', (data) => {
      broadcastSSE('start', data);
    });

    processor.on('progress', (data) => {
      broadcastSSE('progress', data);
    });

    processor.on('success', (data) => {
      broadcastSSE('success', data);
    });

    processor.on('failure', (data) => {
      broadcastSSE('failure', data);
    });

    processor.on('rateLimit', (data) => {
      broadcastSSE('rateLimit', data);
    });

    processor.on('complete', (data) => {
      broadcastSSE('complete', data);
      currentJob.status = 'completed';

      // Clean up uploaded file
      setTimeout(() => {
        if (currentJob.filePath && existsSync(currentJob.filePath)) {
          try {
            unlinkSync(currentJob.filePath);
            currentJob.filePath = null;
          } catch (error) {
            console.error('Error cleaning up file:', error);
          }
        }
      }, 1000);
    });

    processor.on('cancelled', () => {
      broadcastSSE('cancelled', {});
      currentJob.status = 'cancelled';

      // Clean up uploaded file
      if (currentJob.filePath && existsSync(currentJob.filePath)) {
        try {
          unlinkSync(currentJob.filePath);
          currentJob.filePath = null;
        } catch (error) {
          console.error('Error cleaning up file:', error);
        }
      }
    });

    // Store processor and start
    currentJob.processor = processor;
    currentJob.status = 'running';

    // Start processing (don't await - let it run in background)
    processor.start().catch(error => {
      console.error('Batch processing error:', error);
      broadcastSSE('error', { message: error.message });
      currentJob.status = 'error';
    });

    res.json({
      jobId: Date.now(),
      totalRecords: records.length,
      message: 'Batch processing started'
    });

  } catch (error) {
    console.error('Error starting batch:', error);
    currentJob.status = 'error';
    res.status(500).json({ error: 'Failed to start batch processing: ' + error.message });
  }
});

// API: SSE endpoint for progress updates
app.get('/api/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add client to list
  currentJob.sseClients.push(res);

  // Send initial connection message
  res.write(`event: connected\ndata: ${JSON.stringify({ status: currentJob.status })}\n\n`);

  // Remove client on disconnect
  req.on('close', () => {
    currentJob.sseClients = currentJob.sseClients.filter(client => client !== res);
  });
});

// API: Download failed records
app.get('/api/download-failed', (req, res) => {
  const { file } = req.query;

  if (!file || !existsSync(file)) {
    return res.status(404).json({ error: 'Failed records file not found' });
  }

  res.download(file, 'failed-records.csv', (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });
});

// API: Download log file
app.get('/api/download-log', (req, res) => {
  const { file } = req.query;

  if (!file || !existsSync(file)) {
    return res.status(404).json({ error: 'Log file not found' });
  }

  res.download(file, 'batch-log.txt', (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });
});

// API: Cancel batch job
app.delete('/api/cancel', (req, res) => {
  if (currentJob.status !== 'running') {
    return res.status(400).json({ error: 'No batch job is currently running' });
  }

  if (currentJob.processor) {
    currentJob.processor.cancel();
  }

  res.json({ message: 'Batch job cancelled' });
});

// API: Get current job status
app.get('/api/status', (req, res) => {
  res.json({ status: currentJob.status });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🔵 Blueshift Batch Delete Web Interface`);
  console.log(`========================================`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
