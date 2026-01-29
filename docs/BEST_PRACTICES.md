# Best Practices

Guidelines and recommendations for using the Appnigma Integrations Node.js SDK effectively in production.

## Table of Contents

- [Security](#security)
- [Performance](#performance)
- [Error Handling](#error-handling)
- [Code Organization](#code-organization)
- [Monitoring & Logging](#monitoring--logging)
- [Rate Limiting](#rate-limiting)

## Security

### API Key Management

**✅ DO:**
- Store API keys in environment variables
- Use secrets management services (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate API keys regularly
- Use different API keys for different environments (dev, staging, production)

**❌ DON'T:**
- Commit API keys to version control
- Hardcode API keys in source code
- Share API keys in chat or email
- Use the same API key across multiple applications

```typescript
// ✅ Good
const client = new AppnigmaClient({
  apiKey: process.env.APPNIGMA_API_KEY
});

// ❌ Bad
const client = new AppnigmaClient({
  apiKey: 'hardcoded-key-here'
});
```

### Environment Variables

Use a `.env` file for local development (and add it to `.gitignore`):

```bash
# .env
APPNIGMA_API_KEY=your-api-key-here
APPNIGMA_BASE_URL=https://integrations.appnigma.ai
```

```typescript
import dotenv from 'dotenv';
dotenv.config();

const client = new AppnigmaClient({
  apiKey: process.env.APPNIGMA_API_KEY,
  baseUrl: process.env.APPNIGMA_BASE_URL
});
```

### Debug Mode

**Never enable debug mode in production** - it logs sensitive information:

```typescript
// ✅ Good
const client = new AppnigmaClient({
  apiKey: process.env.APPNIGMA_API_KEY,
  debug: process.env.NODE_ENV === 'development'
});

// ❌ Bad
const client = new AppnigmaClient({
  apiKey: process.env.APPNIGMA_API_KEY,
  debug: true  // Always enabled
});
```

## Performance

### Connection Reuse

Reuse client instances instead of creating new ones for each request:

```typescript
// ✅ Good - Reuse client
class SalesforceService {
  private client: AppnigmaClient;
  
  constructor() {
    this.client = new AppnigmaClient({
      apiKey: process.env.APPNIGMA_API_KEY
    });
  }
  
  async query(connectionId: string, soql: string) {
    return this.client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: { q: soql }
    });
  }
}

// ❌ Bad - Create new client for each request
async function query(connectionId: string, soql: string) {
  const client = new AppnigmaClient({ apiKey: process.env.APPNIGMA_API_KEY });
  return client.proxySalesforceRequest(connectionId, { /* ... */ });
}
```

### Batch Operations

When making multiple requests, batch them to reduce overhead:

```typescript
// ✅ Good - Batch requests
async function updateMultipleContacts(connectionId: string, updates: any[]) {
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(update =>
        client.proxySalesforceRequest(connectionId, {
          method: 'PATCH',
          path: `/services/data/v59.0/sobjects/Contact/${update.id}`,
          data: update.data
        })
      )
    );
    results.push(...batchResults);
  }
  
  return results;
}

// ❌ Bad - Sequential requests
async function updateMultipleContacts(connectionId: string, updates: any[]) {
  const results = [];
  for (const update of updates) {
    const result = await client.proxySalesforceRequest(connectionId, { /* ... */ });
    results.push(result);
  }
  return results;
}
```

### Caching

Cache frequently accessed data to reduce API calls:

```typescript
import NodeCache from 'node-cache';

class CachedSalesforceService {
  private client: AppnigmaClient;
  private cache: NodeCache;
  
  constructor() {
    this.client = new AppnigmaClient({ apiKey: process.env.APPNIGMA_API_KEY });
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL
  }
  
  async getAccount(connectionId: string, accountId: string) {
    const cacheKey = `account:${connectionId}:${accountId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from API
    const account = await this.client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: `/services/data/v59.0/sobjects/Account/${accountId}`
    });
    
    // Store in cache
    this.cache.set(cacheKey, account);
    
    return account;
  }
}
```

## Error Handling

### Comprehensive Error Handling

Always handle errors appropriately:

```typescript
import { AppnigmaAPIError } from '@appnigma/integrations-client';

async function safeOperation(connectionId: string) {
  try {
    return await client.proxySalesforceRequest(connectionId, { /* ... */ });
  } catch (error) {
    if (error instanceof AppnigmaAPIError) {
      // Handle API errors
      switch (error.statusCode) {
        case 400:
          // Bad request - log and return user-friendly error
          logger.error('Invalid request', { error: error.message });
          throw new Error('Invalid request. Please check your parameters.');
        
        case 401:
          // Unauthorized - API key issue
          logger.error('Authentication failed', { error: error.message });
          throw new Error('Authentication failed. Please check your API key.');
        
        case 404:
          // Not found
          logger.warn('Resource not found', { error: error.message });
          throw new Error('Resource not found.');
        
        case 429:
          // Rate limited
          const details = error.getDetails();
          logger.warn('Rate limit exceeded', details);
          throw new Error(`Rate limit exceeded. Limit: ${details.planLimit}, Usage: ${details.currentUsage}`);
        
        case 500:
        case 502:
        case 503:
          // Server errors - retryable
          logger.error('Server error', { statusCode: error.statusCode });
          throw new Error('Service temporarily unavailable. Please try again later.');
        
        default:
          logger.error('Unexpected API error', { statusCode: error.statusCode, error: error.message });
          throw new Error('An unexpected error occurred.');
      }
    } else {
      // Non-API errors
      logger.error('Unexpected error', { error });
      throw error;
    }
  }
}
```

### Retry Logic

Implement retry logic for transient failures:

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppnigmaAPIError) {
        // Don't retry client errors (except 429)
        if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error;
        }
        
        // Last attempt
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

## Code Organization

### Service Layer Pattern

Organize your code into service layers:

```typescript
// services/salesforce.service.ts
export class SalesforceService {
  private client: AppnigmaClient;
  
  constructor(apiKey: string) {
    this.client = new AppnigmaClient({ apiKey });
  }
  
  async getAccount(connectionId: string, accountId: string) {
    return this.client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: `/services/data/v59.0/sobjects/Account/${accountId}`
    });
  }
  
  async queryAccounts(connectionId: string, filters?: any) {
    const soql = this.buildSOQL('Account', ['Id', 'Name', 'Type'], filters);
    return this.client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: { q: soql }
    });
  }
  
  private buildSOQL(objectType: string, fields: string[], filters?: any): string {
    // Build SOQL query logic
    return `SELECT ${fields.join(', ')} FROM ${objectType}`;
  }
}
```

### Type Safety

Use TypeScript types for better code safety:

```typescript
interface Account {
  Id: string;
  Name: string;
  Type?: string;
  Industry?: string;
}

interface QueryResponse<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}

class TypedSalesforceService {
  async getAccount(connectionId: string, accountId: string): Promise<Account> {
    return this.client.proxySalesforceRequest<Account>(connectionId, {
      method: 'GET',
      path: `/services/data/v59.0/sobjects/Account/${accountId}`
    });
  }
  
  async queryAccounts(connectionId: string): Promise<QueryResponse<Account>> {
    return this.client.proxySalesforceRequest<QueryResponse<Account>>(connectionId, {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: { q: 'SELECT Id, Name, Type FROM Account LIMIT 100' }
    });
  }
}
```

## Monitoring & Logging

### Structured Logging

Use structured logging for better observability:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

async function queryWithLogging(connectionId: string, soql: string) {
  const startTime = Date.now();
  
  try {
    logger.info('Salesforce query started', {
      connectionId,
      soql,
      timestamp: new Date().toISOString()
    });
    
    const response = await client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: { q: soql }
    });
    
    const duration = Date.now() - startTime;
    logger.info('Salesforce query completed', {
      connectionId,
      duration,
      recordCount: response.records?.length || 0
    });
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Salesforce query failed', {
      connectionId,
      soql,
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}
```

### Metrics Collection

Track metrics for monitoring:

```typescript
class MetricsCollector {
  private metrics: Map<string, number> = new Map();
  
  increment(metric: string, value: number = 1) {
    this.metrics.set(metric, (this.metrics.get(metric) || 0) + value);
  }
  
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

const metrics = new MetricsCollector();

async function queryWithMetrics(connectionId: string, soql: string) {
  const startTime = Date.now();
  
  try {
    metrics.increment('salesforce.requests.total');
    const response = await client.proxySalesforceRequest(connectionId, { /* ... */ });
    
    const duration = Date.now() - startTime;
    metrics.increment('salesforce.requests.success');
    metrics.increment('salesforce.requests.duration', duration);
    
    return response;
  } catch (error) {
    metrics.increment('salesforce.requests.errors');
    throw error;
  }
}
```

## Rate Limiting

### Handle Rate Limits Gracefully

```typescript
async function handleRateLimit<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppnigmaAPIError && error.statusCode === 429) {
        const details = error.getDetails();
        const retryAfter = details.planLimit ? 
          Math.ceil((details.planLimit - details.currentUsage) / 100) * 60 : // Estimate
          60; // Default 60 seconds
        
        if (attempt < maxRetries - 1) {
          logger.warn('Rate limit exceeded, retrying', {
            attempt: attempt + 1,
            retryAfter,
            details
          });
          
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
      }
      
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

### Rate Limit Monitoring

Monitor your rate limit usage:

```typescript
class RateLimitMonitor {
  private usage: Map<string, { count: number; resetAt: Date }> = new Map();
  
  async checkRateLimit(connectionId: string): Promise<boolean> {
    const key = `rate_limit:${connectionId}`;
    const current = this.usage.get(key);
    
    if (current && current.resetAt > new Date()) {
      return current.count < 100; // Assuming 100 requests per minute
    }
    
    // Reset counter
    this.usage.set(key, {
      count: 0,
      resetAt: new Date(Date.now() + 60000) // 1 minute from now
    });
    
    return true;
  }
  
  increment(connectionId: string) {
    const key = `rate_limit:${connectionId}`;
    const current = this.usage.get(key);
    if (current) {
      current.count++;
    }
  }
}
```

## Additional Tips

1. **Use connection pooling**: Reuse client instances across requests
2. **Implement circuit breakers**: Stop making requests if the service is down
3. **Set timeouts**: Configure appropriate timeouts for your use case
4. **Monitor API usage**: Track your usage to avoid hitting limits
5. **Test error scenarios**: Write tests for error handling paths
6. **Document your integration**: Keep documentation up to date
7. **Version your API calls**: Use specific Salesforce API versions in paths
