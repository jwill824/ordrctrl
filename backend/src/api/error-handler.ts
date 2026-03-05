import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { logger } from '../lib/logger.js';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log the error (without sensitive data)
  logger.error('Request error', {
    method: request.method,
    url: request.url,
    statusCode: error.statusCode,
    errorCode: error.code,
    message: error.message,
  });

  // Validation errors (Fastify schema validation)
  if (error.validation) {
    reply.status(422).send({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: error.validation,
    });
    return;
  }

  // Known HTTP errors
  if (error.statusCode && error.statusCode < 500) {
    reply.status(error.statusCode).send({
      error: error.name || 'Error',
      message: error.message,
    });
    return;
  }

  // Unknown / internal server errors — don't leak internals
  reply.status(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}

export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  reply.status(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
  });
}
