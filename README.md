# @appnigma/integrations-client

Official Node.js SDK for the Appnigma Integrations API. This SDK provides a simple interface for managing Salesforce connections and making proxied API calls to Salesforce.

## Installation

```bash
npm install @appnigma/integrations-client
```

or with yarn:

```bash
yarn add @appnigma/integrations-client
```

## Quick Start

```typescript
import { AppnigmaClient } from '@appnigma/integrations-client';

// Initialize client
const client = new AppnigmaClient({
  apiKey: 'your-api-key' // Optional if APPNIGMA_API_KEY is set
});

// Get connection credentials
const credentials = await client.getConnectionCredentials(
  'connectionId',
  'integrationId' // Optional - extracted from API key if not provided
);

// Make a proxied Salesforce API call
const response = await client.proxySalesforceRequest(
  'connectionId',
  {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: { q: 'SELECT Id, Name FROM Account LIMIT 10' }
  },
  'integrationId' // Optional - extracted from API key if not provided
);
```

## Authentication

The SDK supports two ways to provide your API key:

### Environment Variable (Recommended)

Set the `APPNIGMA_API_KEY` environment variable:

```bash
export APPNIGMA_API_KEY=your-api-key
```

Then initialize the client without providing the API key:

```typescript
const client = new AppnigmaClient();
```

### Explicit Configuration

Pass the API key directly in the constructor:

```typescript
const client = new AppnigmaClient({
  apiKey: 'your-api-key'
});
```

**Note**: API keys are integration-scoped. The `integrationId` parameter is optional and will be automatically extracted from your API key if not provided.

## API Reference

### `AppnigmaClient`

Main client class for interacting with the Appnigma Integrations API.

#### Constructor

```typescript
new AppnigmaClient(config?: AppnigmaClientConfig)
```

**Parameters:**
- `config.apiKey` (optional): API key for authentication. Defaults to `APPNIGMA_API_KEY` environment variable.
- `config.baseUrl` (optional): Base URL for the API. Defaults to `https://integrations.appnigma.ai`.
- `config.debug` (optional): Enable debug logging. Defaults to `false`.

#### Methods

##### `getConnectionCredentials(connectionId, integrationId?)`

Retrieve decrypted access token and metadata for a Salesforce connection.

**Parameters:**
- `connectionId` (string, required): The connection ID
- `integrationId` (string, optional): Integration ID. Automatically extracted from API key if not provided.

**Returns:** `Promise<ConnectionCredentials>`

**Example:**
```typescript
const credentials = await client.getConnectionCredentials('conn-123', 'int-456');
console.log(credentials.accessToken);
console.log(credentials.instanceUrl);
```

**Response:**
```typescript
{
  accessToken: string;
  instanceUrl: string;
  environment: string;
  region: string;
  tokenType: string;
  expiresAt: string;
}
```

##### `proxySalesforceRequest<T>(connectionId, requestData, integrationId?)`

Make a proxied API call to Salesforce with automatic token refresh and usage tracking.

**Parameters:**
- `connectionId` (string, required): The connection ID to use
- `requestData` (SalesforceProxyRequest, required): Request configuration
  - `method` (required): HTTP method - 'GET', 'POST', 'PUT', 'PATCH', or 'DELETE'
  - `path` (required): Salesforce API path (e.g., '/services/data/v59.0/query')
  - `query` (optional): Query parameters as key-value pairs
  - `data` (optional): Request body data (for POST, PUT, PATCH)
- `integrationId` (string, optional): Integration ID. Automatically extracted from API key if not provided.

**Returns:** `Promise<T>` - Raw Salesforce API response (unparsed)

**Example:**
```typescript
const response = await client.proxySalesforceRequest<{ records: any[] }>(
  'conn-123',
  {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: { q: 'SELECT Id, Name FROM Account LIMIT 10' }
  }
);
```

## Error Handling

The SDK throws `AppnigmaAPIError` for all API errors. This error includes:
- `statusCode`: HTTP status code
- `error`: Error type/code
- `message`: Human-readable error message
- `responseBody`: Full response body from API

**Example:**
```typescript
import { AppnigmaClient, AppnigmaAPIError } from '@appnigma/integrations-client';

try {
  const credentials = await client.getConnectionCredentials('invalid-id');
} catch (error) {
  if (error instanceof AppnigmaAPIError) {
    console.error(`API Error ${error.statusCode}: ${error.message}`);
    if (error.statusCode === 429) {
      console.error(`Rate limit exceeded. Plan limit: ${error.responseBody?.planLimit}`);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

**Common Error Codes:**
- `400`: Bad Request - Missing required parameters or connection not in 'connected' status
- `401`: Unauthorized - Invalid or revoked API key
- `403`: Forbidden - API key doesn't match integration or connection doesn't belong to integration
- `404`: Not Found - Connection, Integration, or Company not found
- `429`: Too Many Requests - Monthly limit exceeded (includes `planLimit`, `currentUsage`, `offerings`)
- `500`: Internal Server Error - Server errors or token refresh failures

## Salesforce-Specific Examples

### SOQL Query

```typescript
const response = await client.proxySalesforceRequest('conn-123', {
  method: 'GET',
  path: '/services/data/v59.0/query',
  query: {
    q: 'SELECT Id, Name, Email FROM Contact WHERE AccountId = \'001xx000003DGbQAAW\' LIMIT 10'
  }
});

console.log(response.records);
```

### Create Record (POST)

```typescript
const newContact = await client.proxySalesforceRequest('conn-123', {
  method: 'POST',
  path: '/services/data/v59.0/sobjects/Contact',
  data: {
    FirstName: 'John',
    LastName: 'Doe',
    Email: 'john.doe@example.com',
    Phone: '555-1234'
  }
});

console.log('Created contact:', newContact.id);
```

### Update Record (PATCH)

```typescript
await client.proxySalesforceRequest('conn-123', {
  method: 'PATCH',
  path: '/services/data/v59.0/sobjects/Contact/003xx000004DGbQAAW',
  data: {
    Email: 'newemail@example.com',
    Phone: '555-5678'
  }
});
```

### Delete Record (DELETE)

```typescript
await client.proxySalesforceRequest('conn-123', {
  method: 'DELETE',
  path: '/services/data/v59.0/sobjects/Contact/003xx000004DGbQAAW'
});
```

### Using Generic Types

For better TypeScript support, you can specify the expected response type:

```typescript
interface QueryResponse {
  totalSize: number;
  done: boolean;
  records: Array<{
    Id: string;
    Name: string;
    Email: string;
  }>;
}

const response = await client.proxySalesforceRequest<QueryResponse>('conn-123', {
  method: 'GET',
  path: '/services/data/v59.0/query',
  query: { q: 'SELECT Id, Name, Email FROM Contact LIMIT 10' }
});

// TypeScript now knows the structure
console.log(response.totalSize);
response.records.forEach(record => {
  console.log(record.Name);
});
```

## Configuration Options

### Base URL

The default base URL is `https://integrations.appnigma.ai`. You can override it for testing:

```typescript
const client = new AppnigmaClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:3000' // For local development
});
```

### Debug Logging

Enable debug logging to see all HTTP requests and responses:

```typescript
const client = new AppnigmaClient({
  apiKey: 'your-api-key',
  debug: true
});
```

Debug logs will show:
- HTTP method and URL
- Headers (with API key redacted)
- Request body
- Response status and body

**Note**: API keys are automatically redacted in debug logs for security.

## TypeScript Support

This SDK is written in TypeScript and includes full type definitions. All types are exported for use in your code:

```typescript
import {
  AppnigmaClient,
  AppnigmaClientConfig,
  ConnectionCredentials,
  SalesforceProxyRequest,
  AppnigmaAPIError
} from '@appnigma/integrations-client';
```

## License

MIT

## Support

For issues, questions, or contributions, please visit our [GitHub repository](https://github.com/appnigma/appnigma-integrations-node).
