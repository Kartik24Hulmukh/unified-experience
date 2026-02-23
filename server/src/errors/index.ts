/**
 * BErozgar — Application Error Hierarchy
 *
 * Structured error types for consistent API error responses.
 * Every error carries an HTTP status code and a machine-readable code.
 */

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly details: Record<string, string[]>;

  constructor(
    message = 'Validation failed',
    details: Record<string, string[]> = {},
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    const msg = id ? `${resource} '${id}' not found` : `${resource} not found`;
    super(msg, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = 'Duplicate request — already processed') {
    super(message, 409, 'IDEMPOTENCY_CONFLICT');
  }
}

export class InvalidTransitionError extends AppError {
  constructor(machine: string, from: string, event: string) {
    super(
      `[${machine}] Cannot apply "${event}" in state "${from}"`,
      422,
      'INVALID_TRANSITION',
    );
  }
}

/**
 * Serialize any error into a consistent API response shape.
 */
export function serializeError(error: unknown): {
  statusCode: number;
  body: { error: string; code: string; details?: Record<string, string[]> };
} {
  if (error instanceof ValidationError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  // Unknown errors — never leak internals
  return {
    statusCode: 500,
    body: {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  };
}
