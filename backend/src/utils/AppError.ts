/** Operational error with an HTTP status code. Thrown by services/controllers. */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg: string) {
    return new AppError(400, msg);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError(401, msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError(403, msg);
  }
  static notFound(msg = 'Not found') {
    return new AppError(404, msg);
  }
  static conflict(msg: string) {
    return new AppError(409, msg);
  }
  static tooManyRequests(msg = 'Rate limit exceeded') {
    return new AppError(429, msg);
  }
}
