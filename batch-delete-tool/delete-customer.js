import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

// Configuration
const CONFIG = {
  userApiKey: process.env.BLUESHIFT_USER_API_KEY,
  eventApiKey: process.env.BLUESHIFT_EVENT_API_KEY,
  region: process.env.BLUESHIFT_REGION || 'us',
};

// Get base URL based on region
const getBaseUrl = (region) => {
  return region === 'eu'
    ? 'https://api.eu.getblueshift.com'
    : 'https://api.getblueshift.com';
};

/**
 * Delete a customer from Blueshift
 * @param {Object} options - Customer identifier and options
 * @param {string} options.email - Customer email
 * @param {string} options.customer_id - Customer ID
 * @param {string} options.cookie - Cookie ID
 * @param {string} options.device_id - Device ID
 * @param {boolean} options.deleteAll - Delete all matching profiles (default: false)
 * @param {boolean} options.silent - Suppress console output (default: false)
 * @returns {Promise<Object>} API response
 */
async function deleteCustomer(options) {
  const silent = options.silent || false;
  // Validate configuration (Delete Customer API uses User API Key)
  if (!CONFIG.userApiKey) {
    throw new Error('Missing User API key. Please set BLUESHIFT_USER_API_KEY in .env file');
  }

  // Validate at least one identifier is provided
  const identifiers = ['email', 'customer_id', 'cookie', 'device_id'];
  const hasIdentifier = identifiers.some(id => options[id]);

  if (!hasIdentifier) {
    throw new Error('At least one customer identifier (email, customer_id, cookie, or device_id) is required');
  }

  // Build request body
  const body = {};
  identifiers.forEach(id => {
    if (options[id]) body[id] = options[id];
  });

  // Build URL with query parameter
  const baseUrl = getBaseUrl(CONFIG.region);
  const url = new URL('/api/v1/customers/delete', baseUrl);
  if (options.deleteAll) {
    url.searchParams.set('delete_all_matching_customers', 'true');
  }

  // Create Basic Auth header (User API key as username, empty password)
  // Format: "api_key:" (note the trailing colon with empty password)
  const authString = Buffer.from(`${CONFIG.userApiKey}:`).toString('base64');

  if (!silent) {
    console.log('\n🔵 Blueshift Delete Customer API Test');
    console.log('=====================================');
    console.log(`Region: ${CONFIG.region.toUpperCase()}`);
    console.log(`Endpoint: ${url.toString()}`);
    console.log(`Request Body:`, JSON.stringify(body, null, 2));
    console.log(`Delete All Matching: ${options.deleteAll ? 'Yes' : 'No'}`);
    console.log('=====================================\n');
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!silent) {
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log('Response:', JSON.stringify(responseData, null, 2));
    }

    if (!response.ok) {
      const error = new Error(`API Error: ${response.status} - ${JSON.stringify(responseData)}`);
      error.status = response.status;
      error.responseData = responseData;
      throw error;
    }

    return {
      success: true,
      status: response.status,
      data: responseData,
    };
  } catch (error) {
    if (!silent) {
      console.error('\n❌ Error:', error.message);
    }
    // Preserve error properties for retry logic
    if (!error.status && error.code) {
      error.status = error.code === 'ECONNREFUSED' ? 503 : 500;
    }
    throw error;
  }
}

// Example usage (uncomment and modify to test)
async function main() {
  try {
    // ⚠️ WARNING: This will permanently delete customer data!
    // Uncomment and modify ONE of the examples below to test:

    // Example 1: Delete single customer by email
    // const result = await deleteCustomer({
    //   email: 'test@example.com'
    // });

    // Example 2: Delete all matching customers by email (up to 50)
    // const result = await deleteCustomer({
    //   email: 'test@example.com',
    //   deleteAll: true
    // });

    // Example 3: Delete by customer_id
    // const result = await deleteCustomer({
    //   customer_id: '12345'
    // });

    // Example 4: Delete by multiple identifiers
    // const result = await deleteCustomer({
    //   email: 'test@example.com',
    //   customer_id: '12345'
    // });

    // Delete by device_id
    const result = await deleteCustomer({
      device_id: '8abe3faa-d48d-4e4a-00ca-beae01f1c987'
    });

    console.log('\n✅ Customer deletion completed:', result);
  } catch (error) {
    console.error('\n❌ Failed to delete customer:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { deleteCustomer };
