# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a batch processing tool for the Blueshift Delete Customer API. It supports both single customer deletions and batch processing from CSV files with retry logic, adaptive rate limiting, and comprehensive error handling.

## Commands

### Setup
```bash
npm install
cp .env.example .env
# Edit .env and add your Blueshift API keys and region (for CLI usage)
```

### Web Interface (Recommended)
```bash
npm run server  # or npm run dev
# Open http://localhost:3000
```

### CLI - Single Customer Deletion
```bash
npm test
# or
node delete-customer.js
```

### CLI - Batch Processing from CSV
```bash
npm run batch
# or
node batch-delete.js
```

## Architecture

### Configuration
- Uses ES modules (`"type": "module"` in package.json)
- Environment variables loaded via `dotenv` package
- Configuration in `CONFIG` object at top of `delete-customer.js`

### API Keys
The Blueshift API uses two different types of API keys:
- **User API Key** (`BLUESHIFT_USER_API_KEY`): Used for customer management endpoints like delete customer
- **Event API Key** (`BLUESHIFT_EVENT_API_KEY`): Used for event tracking endpoints (not currently used in this project)

Authentication uses HTTP Basic Auth with the API key as the username and an empty password.

### Region Configuration
The API supports two regions:
- `us` (default): `https://api.getblueshift.com`
- `eu`: `https://api.eu.getblueshift.com`

Set via `BLUESHIFT_REGION` environment variable.

### Delete Customer Function
The `deleteCustomer()` function in `delete-customer.js:34` is the core functionality:
- Accepts customer identifiers: `email`, `customer_id`, `cookie`, or `device_id`
- Optional `deleteAll` parameter to delete all matching profiles (up to 50)
- Uses User API Key for authentication
- Makes POST request to `/api/v1/customers/delete`
- Returns success status and response data

### Important API Notes
- Customer deletion is **irreversible** and permanent
- Deletion is asynchronous and may take hours to complete
- By default, only the first matching profile is deleted
- Set `deleteAll: true` to delete up to 50 matching profiles per request
- Multiple requests needed if more than 50 matching profiles exist

### Testing Single Deletions
To test, edit the `main()` function in `delete-customer.js` and uncomment one of the example calls. The script is designed to prevent accidental deletions by requiring explicit uncommenting of test cases.

## Batch Processing

### Configuration (config.json)
The batch processor uses a JSON configuration file with the following structure:
- **csvFile**: Path to the CSV file containing customer identifiers
- **identifierType**: Type of identifier to use (`email`, `customer_id`, `device_id`, or `cookie`)
- **csvColumnName**: Name of the column in the CSV containing the identifier values
- **deleteAll**: Whether to delete all matching profiles (default: false)
- **rateLimit**: Adaptive rate limiting configuration
  - `baseDelayMs`: Starting delay between requests (default: 100ms)
  - `maxDelayMs`: Maximum delay when rate limited (default: 5000ms)
  - `backoffMultiplier`: Multiplier for increasing delay on rate limits (default: 1.5)
- **retry**: Exponential backoff retry configuration
  - `maxAttempts`: Maximum retry attempts per record (default: 3)
  - `initialDelayMs`: Initial retry delay (default: 1000ms)
  - `backoffMultiplier`: Multiplier for exponential backoff (default: 2)

### CSV File Format
The CSV must have headers and can contain multiple columns. The `csvColumnName` in config.json specifies which column contains the identifier values to delete.

Example CSV:
```csv
email,name,status
user1@example.com,User One,inactive
user2@example.com,User Two,inactive
```

### Batch Processor Components (batch-delete.js)

#### Retry Logic
- Automatically retries failed requests up to `maxAttempts` times
- Uses exponential backoff: 1s, 2s, 4s delays
- Retries on 429 (rate limit) and 5xx (server errors)
- Does not retry on 4xx client errors (except 429)

#### Adaptive Rate Limiter
- Starts with `baseDelayMs` between requests
- Increases delay by `backoffMultiplier` on 429 responses
- Gradually decreases delay after consecutive successes
- Caps at `maxDelayMs`

#### Error Handling
- Continues processing all records even if some fail
- Logs all failures with details
- Saves failed records to `logs/failed-records.csv` for retry
- Creates detailed log file at `logs/batch-log-{timestamp}.txt`

#### Progress Tracking
- Real-time console output showing progress (X/Y records)
- Success/failure indicators for each record
- Summary statistics at completion

### Batch Processing Flow
1. Load and validate `config.json`
2. Parse CSV file and validate column exists
3. Display summary and require user confirmation
4. Process each record sequentially with:
   - Retry logic on failures
   - Adaptive rate limiting between requests
   - Detailed logging
5. Generate summary report
6. Save failed records CSV if any failures occurred

### Silent Mode
The `deleteCustomer()` function supports a `silent: true` parameter to suppress console output during batch processing while still providing structured error information for retry logic.

## Web Interface

### Architecture
- **Frontend**: Single-page application with HTML/CSS/JavaScript (no frameworks)
- **Backend**: Express.js server with Server-Sent Events (SSE) for real-time updates
- **File Upload**: Multer middleware handles CSV uploads to temporary `uploads/` directory
- **Batch Processing**: Uses `batch-processor.js` module with EventEmitter for progress events

### Key Files
- `server.js` - Express server with API endpoints and SSE support
- `public/index.html` - Frontend UI with step-by-step wizard
- `public/app.js` - Client-side JavaScript handling state and SSE
- `public/styles.css` - UI styling
- `batch-processor.js` - Reusable batch processing module with event emitters

### API Endpoints
- `POST /api/parse-csv` - Upload and parse CSV file
- `POST /api/start-batch` - Start batch processing job
- `GET /api/progress` - SSE endpoint for real-time progress updates
- `GET /api/download-failed` - Download failed records CSV
- `GET /api/download-log` - Download full log file
- `DELETE /api/cancel` - Cancel running batch job
- `GET /api/status` - Get current job status

### Security Features
- API keys entered per session (not stored on disk or in browser)
- API key only exists in server memory during active job
- Keys cleared immediately after batch completes
- File uploads validated and cleaned up after processing
- 10MB file size limit

### User Flow
1. Enter API key and select region
2. Upload CSV file (drag-and-drop or click)
3. Preview CSV and select identifier column
4. Configure identifier type and deletion options
5. Confirm and start batch processing
6. Monitor real-time progress with live log
7. Download failed records and logs if needed
8. Reset form for new batch

### SSE Events
- `connected` - Initial connection established
- `start` - Batch processing started
- `progress` - Progress update (current/total/percentage)
- `success` - Successful deletion
- `failure` - Failed deletion with error details
- `rateLimit` - Rate limit triggered, delay increased
- `complete` - Batch processing completed with summary
- `cancelled` - Batch cancelled by user
