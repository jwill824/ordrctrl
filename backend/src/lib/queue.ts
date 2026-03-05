import { Queue, Worker, type Processor, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './logger.js';

export const QUEUE_NAMES = {
  SYNC: 'integration-sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// BullMQ requires its own IORedis connection (not the shared singleton).
// Sharing the singleton causes "already connecting/connected" errors because
// BullMQ calls connect() internally when a Queue/Worker is instantiated.
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createBullConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = createBullConnection() as any;

/**
 * Creates a BullMQ queue for the given queue name.
 */
export function createQueue<T = unknown>(name: string): Queue<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }) as any;
}

/**
 * Creates a BullMQ worker for the given queue name.
 */
export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>
): Worker<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency: 5,
  }) as any;

  worker.on('completed', (job: Job<T>) => {
    logger.info('Job completed', { jobId: job.id, queue: name });
  });

  worker.on('failed', (job: Job<T> | undefined, err: Error) => {
    logger.error('Job failed', { jobId: job?.id, queue: name, error: err.message });
  });

  return worker;
}

// Singleton sync queue
export const syncQueue = createQueue<{ integrationId: string; userId: string }>(
  QUEUE_NAMES.SYNC
);
