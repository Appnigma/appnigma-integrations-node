# Troubleshooting

Common issues and solutions when using the Appnigma Integrations Node.js SDK.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Connection Issues](#connection-issues)
- [API Errors](#api-errors)
- [Performance Issues](#performance-issues)
- [TypeScript Issues](#typescript-issues)
- [Common Mistakes](#common-mistakes)

## Authentication Issues

### Error: "API key is required"

**Problem:** The SDK cannot find your API key.

**Solutions:**
1. Check that you've set the `APPNIGMA_API_KEY` environment variable:
   ```bash
   echo $APPNIGMA_API_KEY
   ```

2. Or provide it explicitly in the constructor:
   ```typescript
   const client = new AppnigmaClient({
     apiKey: 'your-api-key-here'
   });
   ```

3. Verify the API key is correct and hasn't been revoked in your dashboard.

### Error: 401 Unauthorized

**Problem:** The API key is invalid or has been revoked.

**Solutions:**
1. Verify your API key is correct:
   ```typescript
   // Check the key is being read correctly
   console.log('API Key:', process.env.APPNIGMA_API_KEY?.substring(0, 10) + '...');
   ```

2. Check if the API key has been revoked in your dashboard.

3. Generate a new API key if needed.

4. Ensure you're using the correct API key for the correct integration.

### Error: 403 Forbidden

**Problem:** The API key doesn't have permission to access the requested resource.

**Solutions:**
1. Verify the connection belongs to the same integration as your API key.

2. Check that the integration is active and not deleted.

3. Ensure the connection is in 'connected' status.

## Connection Issues

### Error: 404 Not Found - Connection

**Problem:** The connection ID doesn't exist or doesn't belong to your integration.

**Solutions:**
1. Verify the connection ID is correct:
   ```typescript
   // Log the connection ID you're using
   console.log('Connection ID:', connectionId);
   ```

2. Check that the connection exists in your dashboard.

3. Ensure the connection belongs to the same integration as your API key.

4. Verify the connection is not revoked or deleted.

### Error: Connection not in 'connected' status

**Problem:** The connection exists but is not in a connected state.

**Solutions:**
1. Check the connection status in your dashboard.

2. Re-authenticate the connection if needed.

3. Test the connection using the test endpoint in your dashboard.

### Error: Token expired

**Problem:** The access token has expired and refresh failed.

**Solutions:**
1. The SDK should automatically refresh tokens, but if this fails:
   - Check that the refresh token is still valid
   - Verify the OAuth configuration is correct
   - Re-authenticate the connection if needed

2. Check the connection status in your dashboard.

## API Errors

### Error: 400 Bad Request

**Problem:** The request parameters are invalid.

**Common causes:**
1. **Invalid SOQL query:**
   ```typescript
   // ❌ Bad - Missing quotes around string
   query: { q: "SELECT Id FROM Account WHERE Name = John" }
   
   // ✅ Good - Properly quoted
   query: { q: "SELECT Id FROM Account WHERE Name = 'John'" }
   ```

2. **Invalid Salesforce API path:**
   ```typescript
   // ❌ Bad - Missing version
   path: '/services/data/query'
   
   // ✅ Good - Include API version
   path: '/services/data/v59.0/query'
   ```

3. **Invalid request body:**
   ```typescript
   // ❌ Bad - Missing required fields
   data: { Email: 'test@example.com' }
   
   // ✅ Good - Include all required fields
   data: { FirstName: 'John', LastName: 'Doe', Email: 'test@example.com' }
   ```

**Solutions:**
1. Validate your SOQL queries before sending:
   ```typescript
   function validateSOQL(soql: string): boolean {
     // Add validation logic
     return soql.includes('SELECT') && soql.includes('FROM');
   }
   ```

2. Check Salesforce API documentation for required fields.

3. Enable debug mode to see the exact request being sent:
   ```typescript
   const client = new AppnigmaClient({
     apiKey: process.env.APPNIGMA_API_KEY,
     debug: true
   });
   ```

### Error: 429 Too Many Requests

**Problem:** You've exceeded your rate limit.

**Solutions:**
1. **Check your usage:**
   ```typescript
   catch (error) {
     if (error instanceof AppnigmaAPIError && error.statusCode === 429) {
       const details = error.getDetails();
       console.log('Plan Limit:', details.planLimit);
       console.log('Current Usage:', details.currentUsage);
     }
   }
   ```

2. **Implement exponential backoff:**
   ```typescript
   async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       try {
         return await fn();
       } catch (error) {
         if (error instanceof AppnigmaAPIError && error.statusCode === 429) {
           const delay = Math.pow(2, attempt) * 1000;
           await new Promise(resolve => setTimeout(resolve, delay));
           continue;
         }
         throw error;
       }
     }
   }
   ```

3. **Reduce request frequency:**
   - Batch multiple operations
   - Cache frequently accessed data
   - Implement request queuing

4. **Upgrade your plan** if you consistently hit limits.

### Error: 500 Internal Server Error

**Problem:** The server encountered an error processing your request.

**Solutions:**
1. **Retry the request** - This might be a transient error:
   ```typescript
   async function retryOnServerError(fn: () => Promise<any>, maxRetries = 3) {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       try {
         return await fn();
       } catch (error) {
         if (error instanceof AppnigmaAPIError && error.statusCode >= 500) {
           if (attempt < maxRetries - 1) {
             await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
             continue;
           }
         }
         throw error;
       }
     }
   }
   ```

2. **Check the error message** for more details:
   ```typescript
   catch (error) {
     if (error instanceof AppnigmaAPIError) {
       console.error('Error details:', error.responseBody);
     }
   }
   ```

3. **Contact support** if the error persists.

## Performance Issues

### Slow Response Times

**Problem:** Requests are taking too long.

**Solutions:**
1. **Reuse client instances:**
   ```typescript
   // ✅ Good - Reuse client
   const client = new AppnigmaClient({ apiKey: process.env.APPNIGMA_API_KEY });
   
   // ❌ Bad - Create new client each time
   function makeRequest() {
     const client = new AppnigmaClient({ apiKey: process.env.APPNIGMA_API_KEY });
     // ...
   }
   ```

2. **Batch operations:**
   ```typescript
   // ✅ Good - Batch requests
   const results = await Promise.all(requests.map(req => client.proxySalesforceRequest(...)));
   
   // ❌ Bad - Sequential requests
   for (const req of requests) {
     await client.proxySalesforceRequest(...);
   }
   ```

3. **Cache frequently accessed data:**
   ```typescript
   const cache = new Map();
   
   async function getCachedAccount(connectionId: string, accountId: string) {
     const key = `${connectionId}:${accountId}`;
     if (cache.has(key)) {
       return cache.get(key);
     }
     
     const account = await client.proxySalesforceRequest(...);
     cache.set(key, account);
     return account;
   }
   ```

4. **Optimize SOQL queries:**
   - Only select fields you need
   - Use WHERE clauses to filter data
   - Use LIMIT to restrict result size

### Memory Issues

**Problem:** High memory usage when processing large datasets.

**Solutions:**
1. **Process data in chunks:**
   ```typescript
   async function processLargeDataset(connectionId: string) {
     let allRecords = [];
     let nextRecordsUrl;
     
     do {
       const response = await client.proxySalesforceRequest(connectionId, {
         method: 'GET',
         path: nextRecordsUrl || '/services/data/v59.0/query',
         query: { q: 'SELECT Id FROM Account' }
       });
       
       // Process records in batches
       for (const record of response.records) {
         await processRecord(record);
       }
       
       nextRecordsUrl = response.nextRecordsUrl;
     } while (nextRecordsUrl);
   }
   ```

2. **Use streaming for large responses** (if supported by your use case).

## TypeScript Issues

### Type Errors

**Problem:** TypeScript compiler errors when using the SDK.

**Solutions:**
1. **Install TypeScript types:**
   ```bash
   npm install --save-dev typescript @types/node
   ```

2. **Use generic types for responses:**
   ```typescript
   interface Account {
     Id: string;
     Name: string;
   }
   
   const account = await client.proxySalesforceRequest<Account>(connectionId, {
     method: 'GET',
     path: `/services/data/v59.0/sobjects/Account/${accountId}`
   });
   ```

3. **Check your TypeScript version:**
   ```bash
   npx tsc --version
   ```
   Ensure you're using TypeScript 5.0 or higher.

### Import Errors

**Problem:** Cannot find module '@appnigma/integrations-client'.

**Solutions:**
1. **Install the package:**
   ```bash
   npm install @appnigma/integrations-client
   ```

2. **Check your tsconfig.json:**
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "esModuleInterop": true
     }
   }
   ```

3. **Use ES module imports:**
   ```typescript
   import { AppnigmaClient } from '@appnigma/integrations-client';
   ```

## Common Mistakes

### Mistake 1: Not Handling Errors

```typescript
// ❌ Bad - No error handling
const response = await client.proxySalesforceRequest(connectionId, { /* ... */ });

// ✅ Good - Proper error handling
try {
  const response = await client.proxySalesforceRequest(connectionId, { /* ... */ });
} catch (error) {
  if (error instanceof AppnigmaAPIError) {
    // Handle API errors
  } else {
    // Handle other errors
  }
}
```

### Mistake 2: Creating New Client for Each Request

```typescript
// ❌ Bad - Creates new client each time
async function query(connectionId: string) {
  const client = new AppnigmaClient({ apiKey: process.env.APPNIGMA_API_KEY });
  return client.proxySalesforceRequest(connectionId, { /* ... */ });
}

// ✅ Good - Reuse client
const client = new AppnigmaClient({ apiKey: process.env.APPNIGMA_API_KEY });

async function query(connectionId: string) {
  return client.proxySalesforceRequest(connectionId, { /* ... */ });
}
```

### Mistake 3: Not Checking Response Structure

```typescript
// ❌ Bad - Assumes response structure
const records = response.records; // Might be undefined

// ✅ Good - Check response structure
if (response.records && Array.isArray(response.records)) {
  response.records.forEach(record => {
    // Process record
  });
}
```

### Mistake 4: Hardcoding API Versions

```typescript
// ❌ Bad - Hardcoded version
path: '/services/data/v59.0/query'

// ✅ Good - Make version configurable
const API_VERSION = process.env.SALESFORCE_API_VERSION || 'v59.0';
path: `/services/data/${API_VERSION}/query`
```

### Mistake 5: Not Validating Input

```typescript
// ❌ Bad - No validation
async function getAccount(connectionId: string, accountId: string) {
  return client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: `/services/data/v59.0/sobjects/Account/${accountId}`
  });
}

// ✅ Good - Validate input
async function getAccount(connectionId: string, accountId: string) {
  if (!connectionId || !accountId) {
    throw new Error('Connection ID and Account ID are required');
  }
  
  if (!/^[a-zA-Z0-9]{15,18}$/.test(accountId)) {
    throw new Error('Invalid Account ID format');
  }
  
  return client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: `/services/data/v59.0/sobjects/Account/${accountId}`
  });
}
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs:** Enable debug mode to see detailed request/response information
2. **Review the API Reference:** Ensure you're using the SDK correctly
3. **Check the Examples:** Look for similar use cases in the examples
4. **Contact Support:** Reach out to support@appnigma.ai with:
   - Error messages
   - Code snippets (with sensitive data redacted)
   - Steps to reproduce
   - SDK version
   - Node.js version

## Debug Checklist

When troubleshooting, check:

- [ ] API key is set and valid
- [ ] Connection ID exists and is in 'connected' status
- [ ] Integration ID matches your API key (if provided)
- [ ] Request parameters are valid (SOQL syntax, API paths, etc.)
- [ ] Network connectivity is working
- [ ] Rate limits haven't been exceeded
- [ ] SDK version is up to date
- [ ] Node.js version is compatible (14+)
- [ ] Debug mode is enabled to see request/response details
