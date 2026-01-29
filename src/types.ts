/**
 * Configuration options for AppnigmaClient
 */
export interface AppnigmaClientConfig {
  /** API key for authentication. If not provided, will read from APPNIGMA_API_KEY environment variable */
  apiKey?: string;
  /** Base URL for the API. Defaults to https://integrations.appnigma.ai */
  baseUrl?: string;
  /** Enable debug logging of requests and responses */
  debug?: boolean;
}

/**
 * Connection credentials response
 */
export interface ConnectionCredentials {
  /** Salesforce access token */
  accessToken: string;
  /** Salesforce instance URL */
  instanceUrl: string;
  /** Environment (production, sandbox, etc.) */
  environment: string;
  /** Region code */
  region: string;
  /** Token type (typically "Bearer") */
  tokenType: string;
  /** ISO 8601 timestamp when token expires */
  expiresAt: string;
}

/**
 * Request data for proxying Salesforce API calls
 */
export interface SalesforceProxyRequest {
  /** HTTP method to use */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Salesforce API path (e.g., /services/data/v59.0/query) */
  path: string;
  /** Optional query parameters as key-value pairs */
  query?: Record<string, any>;
  /** Optional request body data (for POST, PUT, PATCH) */
  data?: any;
}

/**
 * Summary of a connection (list response item)
 */
export interface ConnectionSummary {
  connectionId: string;
  userEmail: string;
  userName: string;
  orgName: string;
  environment: string;
  region: string;
  status: string;
  connectedAt: string;
  lastActiveAt: string;
}

/**
 * Response from list connections API
 */
export interface ListConnectionsResponse {
  connections: ConnectionSummary[];
  totalCount: number;
  nextCursor?: string;
}

/**
 * Options for list connections
 */
export interface ListConnectionsOptions {
  integrationId?: string;
  environment?: string;
  status?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Error response structure from API
 */
export interface AppnigmaError {
  /** Error type/code */
  error: string;
  /** Human-readable error message */
  message: string;
  /** Monthly plan limit (for 429 errors) */
  planLimit?: number;
  /** Current usage count (for 429 errors) */
  currentUsage?: number;
  /** List of offering IDs (for 429 errors) */
  offerings?: string[];
}
