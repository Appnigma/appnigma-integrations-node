import { AppnigmaError } from './types.js';

/**
 * Custom error class for Appnigma API errors
 */
export class AppnigmaAPIError extends Error {
  public readonly statusCode: number;
  public readonly error: string;
  public readonly responseBody?: any;

  /**
   * Creates a new AppnigmaAPIError
   * @param statusCode - HTTP status code
   * @param error - Error type/code
   * @param message - Human-readable error message
   * @param responseBody - Full response body from API
   */
  constructor(
    statusCode: number,
    error: string,
    message: string,
    responseBody?: any
  ) {
    super(message);
    this.name = 'AppnigmaAPIError';
    this.statusCode = statusCode;
    this.error = error;
    this.responseBody = responseBody;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppnigmaAPIError);
    }
  }

  /**
   * Get error details including rate limit information if available
   */
  getDetails(): AppnigmaError {
    return {
      error: this.error,
      message: this.message,
      ...(this.responseBody?.planLimit !== undefined && {
        planLimit: this.responseBody.planLimit,
        currentUsage: this.responseBody.currentUsage,
        offerings: this.responseBody.offerings
      })
    };
  }
}
