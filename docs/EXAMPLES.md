# Examples

Practical examples demonstrating common use cases with the Appnigma Integrations Node.js SDK.

## Table of Contents

- [Basic Operations](#basic-operations)
- [Salesforce API Operations](#salesforce-api-operations)
- [Error Handling](#error-handling)
- [Advanced Patterns](#advanced-patterns)
- [Real-World Scenarios](#real-world-scenarios)

## Basic Operations

### Initialize Client

```typescript
import { AppnigmaClient } from '@appnigma/integrations-client';

// Using environment variable
const client = new AppnigmaClient();

// Or with explicit configuration
const client = new AppnigmaClient({
  apiKey: process.env.APPNIGMA_API_KEY,
  baseUrl: 'https://integrations.appnigma.ai',
  debug: process.env.NODE_ENV === 'development'
});
```

### Get Connection Credentials

```typescript
async function getCredentials(connectionId: string) {
  const credentials = await client.getConnectionCredentials(connectionId);
  
  console.log('Access Token:', credentials.accessToken);
  console.log('Instance URL:', credentials.instanceUrl);
  console.log('Environment:', credentials.environment);
  console.log('Region:', credentials.region);
  console.log('Expires At:', credentials.expiresAt);
  
  return credentials;
}
```

### List Connections

```typescript
async function listConnections(client: AppnigmaClient) {
  const result = await client.listConnections();
  console.log(`Total connections: ${result.totalCount}`);
  result.connections.forEach(conn => {
    console.log(`${conn.connectionId}: ${conn.userEmail} - ${conn.status}`);
  });
  return result;
}

// With filters and pagination
async function listConnectedUsers(client: AppnigmaClient) {
  const result = await client.listConnections({
    status: 'connected',
    environment: 'production',
    limit: 50
  });
  return result.connections;
}
```

## Salesforce API Operations

### SOQL Queries

#### Simple Query

```typescript
async function queryAccounts(connectionId: string) {
  const response = await client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: {
      q: 'SELECT Id, Name, Type FROM Account LIMIT 10'
    }
  });
  
  console.log(`Found ${response.totalSize} accounts`);
  response.records.forEach(account => {
    console.log(`${account.Name} (${account.Type})`);
  });
  
  return response.records;
}
```

#### Query with Filters

```typescript
async function queryContactsByAccount(connectionId: string, accountId: string) {
  const soql = `SELECT Id, Name, Email, Phone 
                FROM Contact 
                WHERE AccountId = '${accountId}' 
                ORDER BY Name 
                LIMIT 100`;
  
  const response = await client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: { q: soql }
  });
  
  return response.records;
}
```

#### Paginated Query

```typescript
async function queryAllAccounts(connectionId: string) {
  let allRecords: any[] = [];
  let nextRecordsUrl: string | undefined;
  
  do {
    const path = nextRecordsUrl 
      ? nextRecordsUrl.replace(/^https?:\/\/[^\/]+/, '')  // Remove base URL
      : '/services/data/v59.0/query';
    
    const query = nextRecordsUrl 
      ? undefined 
      : { q: 'SELECT Id, Name FROM Account' };
    
    const response = await client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path,
      query
    });
    
    allRecords = allRecords.concat(response.records);
    nextRecordsUrl = response.nextRecordsUrl;
    
  } while (nextRecordsUrl);
  
  return allRecords;
}
```

### Create Records

```typescript
async function createContact(connectionId: string, contactData: {
  FirstName: string;
  LastName: string;
  Email: string;
  Phone?: string;
  AccountId?: string;
}) {
  const response = await client.proxySalesforceRequest(connectionId, {
    method: 'POST',
    path: '/services/data/v59.0/sobjects/Contact',
    data: contactData
  });
  
  console.log(`Created contact with ID: ${response.id}`);
  return response;
}
```

### Update Records

```typescript
async function updateContact(connectionId: string, contactId: string, updates: {
  Email?: string;
  Phone?: string;
}) {
  const response = await client.proxySalesforceRequest(connectionId, {
    method: 'PATCH',
    path: `/services/data/v59.0/sobjects/Contact/${contactId}`,
    data: updates
  });
  
  console.log(`Updated contact ${contactId}`);
  return response;
}
```

### Delete Records

```typescript
async function deleteContact(connectionId: string, contactId: string) {
  await client.proxySalesforceRequest(connectionId, {
    method: 'DELETE',
    path: `/services/data/v59.0/sobjects/Contact/${contactId}`
  });
  
  console.log(`Deleted contact ${contactId}`);
}
```

### Bulk Operations

```typescript
async function bulkCreateContacts(connectionId: string, contacts: any[]) {
  const results = await Promise.all(
    contacts.map(contact => 
      client.proxySalesforceRequest(connectionId, {
        method: 'POST',
        path: '/services/data/v59.0/sobjects/Contact',
        data: contact
      }).catch(error => ({ error, contact }))
    )
  );
  
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  
  console.log(`Created ${successful.length} contacts`);
  if (failed.length > 0) {
    console.error(`Failed to create ${failed.length} contacts`);
  }
  
  return { successful, failed };
}
```

### Describe Objects

```typescript
async function describeObject(connectionId: string, objectType: string) {
  const response = await client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: `/services/data/v59.0/sobjects/${objectType}/describe`
  });
  
  console.log(`Object: ${response.name}`);
  console.log(`Fields: ${response.fields.length}`);
  
  return response;
}
```

## Error Handling

### Basic Error Handling

```typescript
import { AppnigmaAPIError } from '@appnigma/integrations-client';

async function safeQuery(connectionId: string) {
  try {
    const response = await client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: { q: 'SELECT Id FROM Account LIMIT 10' }
    });
    
    return response;
  } catch (error) {
    if (error instanceof AppnigmaAPIError) {
      console.error(`API Error ${error.statusCode}: ${error.message}`);
      
      switch (error.statusCode) {
        case 400:
          console.error('Bad request - check your query syntax');
          break;
        case 401:
          console.error('Unauthorized - check your API key');
          break;
        case 404:
          console.error('Connection not found');
          break;
        case 429:
          const details = error.getDetails();
          console.error(`Rate limit exceeded. Limit: ${details.planLimit}, Usage: ${details.currentUsage}`);
          break;
        default:
          console.error('Unexpected API error');
      }
    } else {
      console.error('Unexpected error:', error);
    }
    
    throw error;
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppnigmaAPIError) {
        // Don't retry client errors (4xx)
        if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error;
        }
        
        // For rate limits, wait longer
        if (error.statusCode === 429) {
          const delay = baseDelay * Math.pow(2, attempt) * 2; // Longer delay for rate limits
          console.log(`Rate limited. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Last attempt or non-retryable error
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Request failed. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
async function queryWithRetry(connectionId: string) {
  return retryRequest(() => 
    client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: { q: 'SELECT Id FROM Account LIMIT 10' }
    })
  );
}
```

## Advanced Patterns

### Type-Safe Queries

```typescript
interface Account {
  Id: string;
  Name: string;
  Type?: string;
  Industry?: string;
}

interface QueryResponse {
  totalSize: number;
  done: boolean;
  records: Account[];
}

async function getAccounts(connectionId: string): Promise<Account[]> {
  const response = await client.proxySalesforceRequest<QueryResponse>(
    connectionId,
    {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: {
        q: 'SELECT Id, Name, Type, Industry FROM Account LIMIT 100'
      }
    }
  );
  
  // TypeScript knows the structure
  return response.records;
}
```

### Connection Pooling

```typescript
class ConnectionManager {
  private clients: Map<string, AppnigmaClient> = new Map();
  
  getClient(apiKey: string): AppnigmaClient {
    if (!this.clients.has(apiKey)) {
      this.clients.set(apiKey, new AppnigmaClient({ apiKey }));
    }
    return this.clients.get(apiKey)!;
  }
  
  async query(apiKey: string, connectionId: string, soql: string) {
    const client = this.getClient(apiKey);
    return client.proxySalesforceRequest(connectionId, {
      method: 'GET',
      path: '/services/data/v59.0/query',
      query: { q: soql }
    });
  }
}

// Usage
const manager = new ConnectionManager();
await manager.query('api-key-1', 'conn-1', 'SELECT Id FROM Account');
await manager.query('api-key-1', 'conn-2', 'SELECT Id FROM Contact');
```

### Batch Operations

```typescript
async function batchUpdateContacts(
  connectionId: string,
  updates: Array<{ id: string; data: any }>
) {
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(({ id, data }) =>
        client.proxySalesforceRequest(connectionId, {
          method: 'PATCH',
          path: `/services/data/v59.0/sobjects/Contact/${id}`,
          data
        })
      )
    );
    
    results.push(...batchResults);
    
    // Rate limit protection - small delay between batches
    if (i + batchSize < updates.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
```

## Real-World Scenarios

### Sync Contacts from Salesforce

```typescript
async function syncContacts(connectionId: string, lastSyncTime?: Date) {
  const whereClause = lastSyncTime
    ? `WHERE LastModifiedDate >= ${lastSyncTime.toISOString()}`
    : '';
  
  const soql = `SELECT Id, FirstName, LastName, Email, Phone, LastModifiedDate
                FROM Contact
                ${whereClause}
                ORDER BY LastModifiedDate
                LIMIT 2000`;
  
  const response = await client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: { q: soql }
  });
  
  // Process contacts
  for (const contact of response.records) {
    // Save to your database, send webhooks, etc.
    console.log(`Syncing contact: ${contact.FirstName} ${contact.LastName}`);
  }
  
  return {
    synced: response.records.length,
    total: response.totalSize,
    nextSyncTime: new Date()
  };
}
```

### Generate Report

```typescript
async function generateAccountReport(connectionId: string) {
  // Get account statistics
  const accounts = await client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: {
      q: 'SELECT Type, COUNT(Id) total FROM Account GROUP BY Type'
    }
  });
  
  // Get contact statistics
  const contacts = await client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: '/services/data/v59.0/query',
    query: {
      q: 'SELECT COUNT(Id) total FROM Contact'
    }
  });
  
  return {
    accountsByType: accounts.records,
    totalContacts: contacts.totalSize,
    generatedAt: new Date().toISOString()
  };
}
```

### Webhook Integration

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/webhook/salesforce', async (req, res) => {
  const { connectionId, event, data } = req.body;
  
  try {
    switch (event) {
      case 'contact.created':
        // Handle new contact
        await handleNewContact(connectionId, data);
        break;
      
      case 'account.updated':
        // Handle account update
        await handleAccountUpdate(connectionId, data);
        break;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleNewContact(connectionId: string, contactId: string) {
  const contact = await client.proxySalesforceRequest(connectionId, {
    method: 'GET',
    path: `/services/data/v59.0/sobjects/Contact/${contactId}`
  });
  
  // Process contact (save to database, send notifications, etc.)
  console.log('New contact:', contact);
}
```

### Scheduled Sync Job

```typescript
import cron from 'node-cron';

// Sync every hour
cron.schedule('0 * * * *', async () => {
  console.log('Starting scheduled sync...');
  
  try {
    const connectionId = process.env.SALESFORCE_CONNECTION_ID!;
    const lastSyncTime = await getLastSyncTime(); // From your database
    
    const result = await syncContacts(connectionId, lastSyncTime);
    
    await saveLastSyncTime(new Date()); // Save to your database
    
    console.log(`Sync completed: ${result.synced} contacts synced`);
  } catch (error) {
    console.error('Sync failed:', error);
    // Send alert, log to monitoring service, etc.
  }
});
```
