# API Reference

Complete reference documentation for the Appnigma Integrations Node.js SDK.

## Table of Contents

- [AppnigmaClient](#appnigmaclient)
- [Types](#types)
- [Errors](#errors)

## AppnigmaClient

The main client class for interacting with the Appnigma Integrations API.

### Constructor

```typescript
new AppnigmaClient(config?: AppnigmaClientConfig)
```

Creates a new client instance.

#### Parameters

- `config` (optional): Configuration object
  - `apiKey` (optional, string): API key for authentication. If not provided, reads from `APPNIGMA_API_KEY` environment variable.
  - `baseUrl` (optional, string): Base URL for the API. Defaults to `https://integrations.appnigma.ai`.
  - `debug` (optional, boolean): Enable debug logging. Defaults to `false`.

#### Throws

- `Error`: If API key is not provided and `APPNIGMA_API_KEY` environment variable is not set.

#### Example

```typescript
const client = new AppnigmaClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://integrations.appnigma.ai',
  debug: false
});
```

### Methods

#### `getConnectionCredentials(connectionId, integrationId?)`

Retrieves decrypted access token and metadata for a Salesforce connection.

**Signature:**
```typescript
async getConnectionCredentials(
  connectionId: string,
  integrationId?: string
): Promise<ConnectionCredentials>
```

**Parameters:**
- `connectionId` (string, required): The connection ID to retrieve credentials for
- `integrationId` (string, optional): Integration ID. Automatically extracted from API key if not provided.

**Returns:** `Promise<ConnectionCredentials>`

**Throws:** `AppnigmaAPIError` if the API request fails

**Example:**
```typescript
const credentials = await client.getConnectionCredentials('conn-123');

console.log('Access Token:', credentials.accessToken);
console.log('Instance URL:', credentials.instanceUrl);
console.log('Expires At:', credentials.expiresAt);
```

**Response Structure:**
```typescript
{
  accessToken: string;      // Salesforce access token
  instanceUrl: string;      // Salesforce instance URL (e.g., https://na1.salesforce.com)
  environment: string;      // "production" or "sandbox"
  region: string;           // Geographic region code (e.g., "NA", "EU")
  tokenType: string;        // Usually "Bearer"
  expiresAt: string;        // ISO 8601 timestamp when token expires
}
```

**Error Codes:**
- `400`: Bad Request - Invalid connection ID or connection not in 'connected' status
- `401`: Unauthorized - Invalid or revoked API key
- `403`: Forbidden - API key doesn't match integration or connection doesn't belong to integration
- `404`: Not Found - Connection, Integration, or Company not found
- `500`: Internal Server Error - Server error or token refresh failure

#### `proxySalesforceRequest<T>(connectionId, requestData, integrationId?)`

Makes a proxied API call to Salesforce with automatic token refresh and usage tracking.

**Signature:**
```typescript
async proxySalesforceRequest<T = any>(
  connectionId: string,
  requestData: SalesforceProxyRequest,
  integrationId?: string
): Promise<T>
```

**Parameters:**
- `connectionId` (string, required): The connection ID to use for the API call
- `requestData` (SalesforceProxyRequest, required): Request configuration object
  - `method` (required, 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'): HTTP method
  - `path` (required, string): Salesforce API path (e.g., '/services/data/v59.0/query')
  - `query` (optional, Record<string, any>): Query parameters as key-value pairs (for GET requests)
  - `data` (optional, any): Request body data (for POST, PUT, PATCH requests)
- `integrationId` (string, optional): Integration ID. Automatically extracted from API key if not provided.

**Returns:** `Promise<T>` - Raw Salesforce API response (unparsed). Type is inferred from the generic parameter.

**Throws:** `AppnigmaAPIError` if the API request fails

**Example:**
```typescript
// GET request with query parameters
const response = await client.proxySalesforceRequest<{
  totalSize: number;
  records: Array<{ Id: string; Name: string }>;
}>('conn-123', {
  method: 'GET',
  path: '/services/data/v59.0/query',
  query: {
    q: 'SELECT Id, Name FROM Account LIMIT 10'
  }
});

// POST request with body data
const newRecord = await client.proxySalesforceRequest('conn-123', {
  method: 'POST',
  path: '/services/data/v59.0/sobjects/Contact',
  data: {
    FirstName: 'John',
    LastName: 'Doe',
    Email: 'john@example.com'
  }
});
```

**Features:**
- Automatic token refresh if the access token is expired or about to expire
- Usage tracking for billing purposes
- Error handling and retries for transient failures
- Type-safe responses with TypeScript generics

**Error Codes:**
- `400`: Bad Request - Invalid request parameters or connection not in 'connected' status
- `401`: Unauthorized - Invalid or revoked API key
- `403`: Forbidden - API key doesn't match integration or connection doesn't belong to integration
- `404`: Not Found - Connection, Integration, or Company not found
- `429`: Too Many Requests - Monthly rate limit exceeded (includes `planLimit`, `currentUsage`, `offerings` in error details)
- `500`: Internal Server Error - Server error, token refresh failure, or Salesforce API error

## Types

### AppnigmaClientConfig

Configuration options for the client constructor.

```typescript
interface AppnigmaClientConfig {
  apiKey?: string;      // API key for authentication
  baseUrl?: string;     // Base URL for the API
  debug?: boolean;      // Enable debug logging
}
```

### ConnectionCredentials

Response structure for connection credentials.

```typescript
interface ConnectionCredentials {
  accessToken: string;  // Salesforce access token
  instanceUrl: string; // Salesforce instance URL
  environment: string; // "production" or "sandbox"
  region: string;      // Geographic region code
  tokenType: string;   // Usually "Bearer"
  expiresAt: string;  // ISO 8601 expiration timestamp
}
```

### SalesforceProxyRequest

Request data for proxying Salesforce API calls.

```typescript
interface SalesforceProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, any>;  // Optional query parameters
  data?: any;                   // Optional request body
}
```

### AppnigmaError

Error response structure from the API.

```typescript
interface AppnigmaError {
  error: string;              // Error type/code
  message: string;            // Human-readable error message
  planLimit?: number;        // Monthly plan limit (for 429 errors)
  currentUsage?: number;      // Current usage count (for 429 errors)
  offerings?: string[];       // List of offering IDs (for 429 errors)
}
```

## Errors

### AppnigmaAPIError

Custom error class for API errors.

```typescript
class AppnigmaAPIError extends Error {
  readonly statusCode: number;    // HTTP status code
  readonly error: string;         // Error type/code
  readonly responseBody?: any;    // Full response body from API
  message: string;                // Human-readable error message
}
```

#### Properties

- `statusCode` (number): HTTP status code from the API response
- `error` (string): Error type/code from the API response
- `message` (string): Human-readable error message
- `responseBody` (any, optional): Full response body from the API

#### Methods

##### `getDetails()`

Returns error details including rate limit information if available.

**Signature:**
```typescript
getDetails(): AppnigmaError
```

**Returns:** `AppnigmaError` object with error details

**Example:**
```typescript
try {
  await client.proxySalesforceRequest('conn-123', { /* ... */ });
} catch (error) {
  if (error instanceof AppnigmaAPIError && error.statusCode === 429) {
    const details = error.getDetails();
    console.log('Plan Limit:', details.planLimit);
    console.log('Current Usage:', details.currentUsage);
    console.log('Offerings:', details.offerings);
  }
}
```

### Error Handling Best Practices

1. **Always check error type**: Use `instanceof AppnigmaAPIError` to distinguish API errors from other errors
2. **Handle rate limits**: Check for `429` status code and use `getDetails()` to get rate limit information
3. **Log error details**: Include `statusCode`, `error`, and `message` in your error logs
4. **Retry logic**: Implement retry logic for transient errors (5xx status codes)
5. **User-friendly messages**: Translate technical error messages to user-friendly messages

**Example:**
```typescript
async function makeRequestWithRetry(connectionId: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.proxySalesforceRequest(connectionId, { /* ... */ });
    } catch (error) {
      if (error instanceof AppnigmaAPIError) {
        // Don't retry client errors (4xx)
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // Retry server errors (5xx)
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

## Rate Limiting

The API implements two layers of rate limiting:

1. **Per-minute rate limiting**: 100 requests per minute (configurable)
2. **Monthly rate limiting**: Based on your company's subscribed offerings

When rate limits are exceeded, the API returns a `429 Too Many Requests` error with details about your plan limits and current usage.

**Rate Limit Headers:**
All responses include rate limit information:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets

**Handling Rate Limits:**
```typescript
try {
  await client.proxySalesforceRequest('conn-123', { /* ... */ });
} catch (error) {
  if (error instanceof AppnigmaAPIError && error.statusCode === 429) {
    const details = error.getDetails();
    console.error(`Rate limit exceeded. Plan limit: ${details.planLimit}, Current usage: ${details.currentUsage}`);
    // Implement exponential backoff or notify user
  }
}
```

## TypeScript Support

The SDK is fully typed and supports TypeScript generics for type-safe responses:

```typescript
// Define your response type
interface QueryResponse {
  totalSize: number;
  done: boolean;
  records: Array<{
    Id: string;
    Name: string;
    Email?: string;
  }>;
}

// Use generic type parameter
const response = await client.proxySalesforceRequest<QueryResponse>(
  'conn-123',
  {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: { q: 'SELECT Id, Name, Email FROM Contact LIMIT 10' }
  }
);

// TypeScript now knows the structure
console.log(response.totalSize);  // ✅ Type-safe
response.records.forEach(record => {
  console.log(record.Name);       // ✅ Type-safe
});
```
