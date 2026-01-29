import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { AppnigmaClientConfig, ConnectionCredentials, SalesforceProxyRequest, ListConnectionsResponse, ListConnectionsOptions } from './types.js';
import { AppnigmaAPIError } from './errors.js';

const SDK_VERSION = '0.1.3';
const DEFAULT_BASE_URL = 'https://integrations.appnigma.ai';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Official Node.js SDK for Appnigma Integrations API
 */
export class AppnigmaClient {
  private apiKey: string;
  private baseUrl: string;
  private debug: boolean;

  /**
   * Creates a new AppnigmaClient instance
   * @param config - Configuration options
   * @throws {Error} If API key is not provided and APPNIGMA_API_KEY environment variable is not set
   */
  constructor(config: AppnigmaClientConfig = {}) {
    // Get API key from config or environment variable
    this.apiKey = config.apiKey || process.env.APPNIGMA_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error(
        'API key is required. Provide it in the constructor or set APPNIGMA_API_KEY environment variable.'
      );
    }

    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.debug = config.debug || false;

    // Remove trailing slash from baseUrl if present
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  /**
   * List connections for the integration (integration from API key or options)
   * @param options - Optional filters and pagination (integrationId, environment, status, search, limit, cursor)
   * @returns Promise resolving to list of connection summaries
   * @throws {AppnigmaAPIError} If the API request fails
   */
  async listConnections(options?: ListConnectionsOptions): Promise<ListConnectionsResponse> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': `Appnigma-Integrations-Client-Node/${SDK_VERSION}`
    };

    if (options?.integrationId) {
      headers['X-Integration-Id'] = options.integrationId;
    }

    const params = new URLSearchParams();
    if (options?.environment !== undefined) params.set('environment', String(options.environment));
    if (options?.status !== undefined) params.set('status', String(options.status));
    if (options?.search !== undefined) params.set('search', String(options.search));
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.cursor !== undefined) params.set('cursor', String(options.cursor));

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/v1/connections${queryString ? `?${queryString}` : ''}`;

    if (this.debug) {
      this.logRequest('GET', url, headers, undefined);
    }

    try {
      const response = await axios.get<ListConnectionsResponse>(url, {
        headers,
        timeout: DEFAULT_TIMEOUT
      });

      if (this.debug) {
        this.logResponse('GET', url, response.status, response.data);
      }

      return response.data;
    } catch (error) {
      const apiError = this.handleError(error, 'GET', url);
      throw apiError;
    }
  }

  /**
   * Get connection credentials (access token and metadata)
   * @param connectionId - The connection ID
   * @param integrationId - Optional integration ID (required if API key is not integration-scoped)
   * @returns Promise resolving to connection credentials
   * @throws {AppnigmaAPIError} If the API request fails
   */
  async getConnectionCredentials(
    connectionId: string,
    integrationId?: string
  ): Promise<ConnectionCredentials> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': `Appnigma-Integrations-Client-Node/${SDK_VERSION}`
    };

    if (integrationId) {
      headers['X-Integration-Id'] = integrationId;
    }

    const url = `${this.baseUrl}/api/v1/connections/${connectionId}/credentials`;

    if (this.debug) {
      this.logRequest('GET', url, headers, undefined);
    }

    try {
      const response = await axios.get<ConnectionCredentials>(url, {
        headers,
        timeout: DEFAULT_TIMEOUT
      });

      if (this.debug) {
        this.logResponse('GET', url, response.status, response.data);
      }

      return response.data;
    } catch (error) {
      const apiError = this.handleError(error, 'GET', url);
      throw apiError;
    }
  }

  /**
   * Proxy a Salesforce API request
   * @param connectionId - The connection ID to use
   * @param requestData - Request data (method, path, query, data)
   * @param integrationId - Optional integration ID (required if API key is not integration-scoped)
   * @returns Promise resolving to Salesforce API response (raw, unparsed)
   * @throws {AppnigmaAPIError} If the API request fails
   */
  async proxySalesforceRequest<T = any>(
    connectionId: string,
    requestData: SalesforceProxyRequest,
    integrationId?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Connection-Id': connectionId,
      'User-Agent': `Appnigma-Integrations-Client-Node/${SDK_VERSION}`
    };

    if (integrationId) {
      headers['X-Integration-Id'] = integrationId;
    }

    const url = `${this.baseUrl}/api/v1/proxy/salesforce`;

    if (this.debug) {
      this.logRequest('POST', url, headers, requestData);
    }

    try {
      const response = await axios.post<T>(url, requestData, {
        headers,
        timeout: DEFAULT_TIMEOUT
      });

      if (this.debug) {
        this.logResponse('POST', url, response.status, response.data);
      }

      return response.data;
    } catch (error) {
      const apiError = this.handleError(error, 'POST', url);
      throw apiError;
    }
  }

  /**
   * Handle HTTP errors and convert to AppnigmaAPIError
   */
  private handleError(error: unknown, method: string, url: string): AppnigmaAPIError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;

      // Network/timeout errors
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return new AppnigmaAPIError(
          0,
          'NetworkError',
          `Request timeout: ${method} ${url} exceeded ${DEFAULT_TIMEOUT}ms`,
          undefined
        );
      }

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        return new AppnigmaAPIError(
          0,
          'NetworkError',
          `Connection failed: Unable to reach ${url}`,
          undefined
        );
      }

      // API errors with response
      if (axiosError.response) {
        const statusCode = axiosError.response.status;
        const responseData = axiosError.response.data || {};
        
        return new AppnigmaAPIError(
          statusCode,
          responseData.error || 'APIError',
          responseData.message || `API request failed with status ${statusCode}`,
          responseData
        );
      }

      // Other axios errors
      return new AppnigmaAPIError(
        0,
        'RequestError',
        axiosError.message || 'Unknown request error',
        undefined
      );
    }

    // Non-axios errors
    if (error instanceof Error) {
      return new AppnigmaAPIError(
        0,
        'UnknownError',
        error.message,
        undefined
      );
    }

    return new AppnigmaAPIError(
      0,
      'UnknownError',
      'An unknown error occurred',
      undefined
    );
  }

  /**
   * Log request details (with API key redaction)
   */
  private logRequest(method: string, url: string, headers: Record<string, string>, body?: any): void {
    const redactedHeaders = { ...headers };
    if (redactedHeaders['Authorization']) {
      redactedHeaders['Authorization'] = 'Bearer ***';
    }

    console.log(`[Appnigma SDK] ${method} ${url}`);
    console.log('[Appnigma SDK] Headers:', JSON.stringify(redactedHeaders, null, 2));
    if (body) {
      console.log('[Appnigma SDK] Request Body:', JSON.stringify(body, null, 2));
    }
  }

  /**
   * Log response details
   */
  private logResponse(method: string, url: string, status: number, body: any): void {
    console.log(`[Appnigma SDK] ${method} ${url} - Status: ${status}`);
    console.log('[Appnigma SDK] Response Body:', JSON.stringify(body, null, 2));
  }
}
