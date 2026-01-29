# Getting Started with Appnigma Integrations Node.js SDK

Welcome to the Appnigma Integrations Node.js SDK! This guide will help you get up and running quickly.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Basic Usage](#basic-usage)
- [Next Steps](#next-steps)

## Installation

Install the SDK using npm or yarn:

```bash
npm install @appnigma/integrations-client
```

or

```bash
yarn add @appnigma/integrations-client
```

### Requirements

- Node.js 14 or higher
- TypeScript 5.0+ (optional, for TypeScript projects)

## Quick Start

Here's a minimal example to get you started:

```typescript
import { AppnigmaClient } from '@appnigma/integrations-client';

// Initialize the client
const client = new AppnigmaClient({
  apiKey: 'your-api-key-here'
});

// Get connection credentials
const credentials = await client.getConnectionCredentials('connection-id');

console.log('Access Token:', credentials.accessToken);
console.log('Instance URL:', credentials.instanceUrl);
```

## Authentication

The SDK requires an API key for authentication. API keys are integration-scoped, meaning each key is tied to a specific integration.

### Getting Your API Key

1. Log in to your Appnigma dashboard
2. Navigate to your integration settings
3. Generate a new API key
4. **Important**: Copy the key immediately - it's only shown once!

### Setting Your API Key

You can provide your API key in two ways:

#### Option 1: Environment Variable (Recommended)

Set the `APPNIGMA_API_KEY` environment variable:

```bash
export APPNIGMA_API_KEY=your-api-key-here
```

Then initialize the client without providing the key:

```typescript
const client = new AppnigmaClient();
```

#### Option 2: Constructor Parameter

Pass the API key directly when creating the client:

```typescript
const client = new AppnigmaClient({
  apiKey: 'your-api-key-here'
});
```

**Security Note**: Never commit API keys to version control. Always use environment variables in production.

## Basic Usage

### Getting Connection Credentials

Retrieve access tokens and metadata for a Salesforce connection:

```typescript
const credentials = await client.getConnectionCredentials('connection-id');

// Credentials include:
// - accessToken: The Salesforce access token
// - instanceUrl: The Salesforce instance URL
// - environment: Production or sandbox
// - region: Geographic region
// - tokenType: Usually "Bearer"
// - expiresAt: ISO 8601 expiration timestamp
```

### Making Salesforce API Calls

Use the proxy method to make API calls to Salesforce:

```typescript
// Query Salesforce data
const response = await client.proxySalesforceRequest('connection-id', {
  method: 'GET',
  path: '/services/data/v59.0/query',
  query: {
    q: 'SELECT Id, Name FROM Account LIMIT 10'
  }
});

console.log('Records:', response.records);
```

The SDK automatically handles:
- Token refresh when tokens expire
- Usage tracking for billing
- Error handling and retries

### Integration ID

The `integrationId` parameter is optional. If your API key is integration-scoped (which it is by default), the SDK automatically extracts the integration ID from your API key. You only need to provide it explicitly if you're using a company-level API key.

```typescript
// Integration ID is automatically extracted from API key
const credentials = await client.getConnectionCredentials('connection-id');

// Or explicitly provide it (rarely needed)
const credentials = await client.getConnectionCredentials(
  'connection-id',
  'integration-id'
);
```

## Configuration Options

### Base URL

By default, the SDK connects to `https://integrations.appnigma.ai`. For local development or testing, you can override this:

```typescript
const client = new AppnigmaClient({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:3000'
});
```

### Debug Mode

Enable debug logging to see all HTTP requests and responses:

```typescript
const client = new AppnigmaClient({
  apiKey: 'your-api-key',
  debug: true
});
```

Debug logs include:
- HTTP method and URL
- Request headers (API key is automatically redacted)
- Request body
- Response status and body

**Note**: Debug mode should only be enabled during development, not in production.

## Error Handling

The SDK throws `AppnigmaAPIError` for all API errors:

```typescript
import { AppnigmaClient, AppnigmaAPIError } from '@appnigma/integrations-client';

try {
  const credentials = await client.getConnectionCredentials('invalid-id');
} catch (error) {
  if (error instanceof AppnigmaAPIError) {
    console.error(`API Error ${error.statusCode}: ${error.message}`);
    
    // Handle rate limiting
    if (error.statusCode === 429) {
      const details = error.getDetails();
      console.error(`Rate limit exceeded. Plan limit: ${details.planLimit}`);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

Common error codes:
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Invalid or revoked API key
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error

## Next Steps

- Read the [API Reference](./API_REFERENCE.md) for detailed method documentation
- Check out [Examples](./EXAMPLES.md) for common use cases
- Review [Best Practices](./BEST_PRACTICES.md) for production-ready code
- See [Troubleshooting](./TROUBLESHOOTING.md) if you encounter issues

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions. Import types for better IDE support:

```typescript
import {
  AppnigmaClient,
  AppnigmaClientConfig,
  ConnectionCredentials,
  SalesforceProxyRequest,
  AppnigmaAPIError
} from '@appnigma/integrations-client';
```

## Support

- **Documentation**: See the other guides in this `docs` folder
- **Issues**: Report bugs or request features on [GitHub](https://github.com/appnigma/appnigma-integrations-node)
- **Questions**: Contact support at support@appnigma.ai
