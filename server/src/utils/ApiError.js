export class ApiError extends Error {
  constructor(statusCode, message, code = undefined, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Not authenticated') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Not authorized to perform this action') {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, message, 'CONFLICT');
  }

  static tooLarge(message = 'Payload too large') {
    return new ApiError(413, message, 'PAYLOAD_TOO_LARGE');
  }

  static unprocessable(message = 'Unprocessable entity', details) {
    return new ApiError(422, message, 'UNPROCESSABLE', details);
  }

  /** Input failed schema validation; `details` lists field-level problems. */
  static validation(message = 'Validation failed', details) {
    return new ApiError(422, message, 'VALIDATION_ERROR', details);
  }

  static tooMany(message = 'Too many requests') {
    return new ApiError(429, message, 'RATE_LIMITED');
  }

  static notConfigured(message = 'This integration is not configured') {
    return new ApiError(503, message, 'NOT_CONFIGURED');
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}

export default ApiError;
