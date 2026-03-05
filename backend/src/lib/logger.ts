import type { FastifyBaseLogger } from 'fastify';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  time: string;
  msg: string;
  [key: string]: unknown;
}

// Patterns to redact from log output (security: no tokens/secrets in logs)
const REDACT_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /cookie/i,
  /access_token/i,
  /refresh_token/i,
  /encrypted/i,
];

function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_PATTERNS.some((pattern) => pattern.test(key))) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function log(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(context ? redactSensitiveFields(context) : {}),
  };
  const output = JSON.stringify(entry);

  if (level === 'error' || level === 'fatal') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  trace: (msg: string, context?: Record<string, unknown>) => log('trace', msg, context),
  debug: (msg: string, context?: Record<string, unknown>) => log('debug', msg, context),
  info: (msg: string, context?: Record<string, unknown>) => log('info', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => log('warn', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => log('error', msg, context),
  fatal: (msg: string, context?: Record<string, unknown>) => log('fatal', msg, context),
};

export type Logger = typeof logger;

/**
 * Creates a pino-compatible logger instance for Fastify.
 * Wraps our structured logger with the FastifyBaseLogger interface.
 */
export function createFastifyLogger(): FastifyBaseLogger {
  return {
    trace: (msg: unknown, ...args: unknown[]) =>
      log('trace', typeof msg === 'string' ? msg : JSON.stringify(msg)),
    debug: (msg: unknown, ...args: unknown[]) =>
      log('debug', typeof msg === 'string' ? msg : JSON.stringify(msg)),
    info: (msg: unknown, ...args: unknown[]) =>
      log('info', typeof msg === 'string' ? msg : JSON.stringify(msg)),
    warn: (msg: unknown, ...args: unknown[]) =>
      log('warn', typeof msg === 'string' ? msg : JSON.stringify(msg)),
    error: (msg: unknown, ...args: unknown[]) =>
      log('error', typeof msg === 'string' ? msg : JSON.stringify(msg)),
    fatal: (msg: unknown, ...args: unknown[]) =>
      log('fatal', typeof msg === 'string' ? msg : JSON.stringify(msg)),
    child: () => createFastifyLogger(),
    level: process.env.LOG_LEVEL || 'info',
    silent: () => {},
  } as unknown as FastifyBaseLogger;
}
