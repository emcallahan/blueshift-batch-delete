# Blueshift Delete Customer API Tool

Batch processing tool for the Blueshift Delete Customer API with support for single deletions and CSV batch processing.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API credentials:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Blueshift API key:
   ```
   BLUESHIFT_API_KEY=your_api_key_here
   BLUESHIFT_REGION=us  # or 'eu' for European region
   ```

   The API uses HTTP Basic Authentication with your API key as the username and an empty password.

## Usage

### Web Interface (Recommended for Teams)

Start the web server:

```bash
npm run server
# or
npm run dev
```

Then open http://localhost:3000 in your browser.

The web interface provides:
- Step-by-step wizard for configuration
- Drag-and-drop CSV file upload
- Real-time progress tracking with live updates
- Automatic retry logic and rate limiting
- Downloadable logs and failed records
- No stored API keys - enter per session

### Single Customer Deletion

Edit `delete-customer.js` and uncomment one of the example calls in the `main()` function:

```javascript
// Delete single customer by email
const result = await deleteCustomer({
  email: 'test@example.com'
});
```

Run the test:

```bash
npm test
# or
node delete-customer.js
```

### Batch Processing from CSV

1. **Prepare your CSV file** with customer identifiers:
   ```csv
   email,name,status
   user1@example.com,User One,inactive
   user2@example.com,User Two,inactive
   ```

2. **Configure `config.json`** to specify your CSV file and settings:
   ```json
   {
     "csvFile": "customers.csv",
     "identifierType": "email",
     "csvColumnName": "email",
     "deleteAll": false,
     "rateLimit": {
       "baseDelayMs": 100,
       "maxDelayMs": 5000,
       "backoffMultiplier": 1.5
     },
     "retry": {
       "maxAttempts": 3,
       "initialDelayMs": 1000,
       "backoffMultiplier": 2
     }
   }
   ```

3. **Run batch processing**:
   ```bash
   npm run batch
   # or
   node batch-delete.js
   ```

The script will:
- Display a summary and request confirmation
- Process each record with automatic retries
- Adapt request rate based on API responses
- Log all activity to `logs/batch-log-{timestamp}.txt`
- Save failed records to `logs/failed-records.csv` for retry

## Batch Processing Features

- **Automatic Retry Logic**: Retries failed requests with exponential backoff (1s, 2s, 4s)
- **Adaptive Rate Limiting**: Automatically adjusts delay between requests based on API responses
- **Error Resilience**: Continues processing even if some deletions fail
- **Comprehensive Logging**: Detailed logs and failed record tracking
- **Progress Tracking**: Real-time progress display with success/failure indicators
- **Multi-column CSV Support**: Flexible CSV format with configurable column mapping

## Configuration Options

### config.json

| Parameter | Type | Description |
|-----------|------|-------------|
| `csvFile` | string | Path to CSV file with customer identifiers |
| `identifierType` | string | Type of identifier: `email`, `customer_id`, `device_id`, or `cookie` |
| `csvColumnName` | string | Name of column in CSV containing identifier values |
| `deleteAll` | boolean | Delete all matching profiles (up to 50) per request |
| `rateLimit.baseDelayMs` | number | Starting delay between requests (default: 100ms) |
| `rateLimit.maxDelayMs` | number | Maximum delay when rate limited (default: 5000ms) |
| `rateLimit.backoffMultiplier` | number | Multiplier for increasing delay (default: 1.5) |
| `retry.maxAttempts` | number | Maximum retry attempts per record (default: 3) |
| `retry.initialDelayMs` | number | Initial retry delay (default: 1000ms) |
| `retry.backoffMultiplier` | number | Retry delay multiplier (default: 2) |

## API Options

The `deleteCustomer()` function accepts the following options:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | No* | Customer email address |
| `customer_id` | string | No* | Customer ID |
| `cookie` | string | No* | Cookie ID |
| `device_id` | string | No* | Device ID |
| `deleteAll` | boolean | No | Delete all matching profiles (up to 50) |

\* At least one identifier is required

## Examples

### Delete by email (single profile)
```javascript
await deleteCustomer({
  email: 'john.doe@example.com'
});
```

### Delete all matching profiles
```javascript
await deleteCustomer({
  email: 'john.doe@example.com',
  deleteAll: true
});
```

### Delete by customer_id
```javascript
await deleteCustomer({
  customer_id: '48759893'
});
```

### Delete by multiple identifiers
```javascript
await deleteCustomer({
  email: 'john.doe@example.com',
  customer_id: '48759893'
});
```

## Important Notes

⚠️ **WARNING**: This API permanently deletes customer data. This action is **irreversible**.

- Customer deletion is asynchronous and may take a couple of hours to complete
- By default, only the first matching profile is deleted
- Set `deleteAll: true` to delete up to 50 matching profiles per request
- If you have more than 50 matching profiles, multiple API requests are needed

## API Response

Success response:
```json
{
  "status": "ok"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid request |
| 401 | Unauthorized - Invalid API credentials |
| 403 | Forbidden - Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict - Retry with exponential backoff |
| 413 | Too many users (max 50 per request) |
| 422 | Validation failed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 502/503/504 | Service unavailable - Retry with exponential backoff |
