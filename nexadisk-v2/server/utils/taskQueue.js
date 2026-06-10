const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('./logger');

class TaskQueueManager {
    constructor() {
        this.queues = {};
        this.workers = {};
        this.fallbackQueue = [];
        this.useFallback = false;

        if (process.env.USE_IN_MEMORY_QUEUE === 'true') {
            logger.info('USE_IN_MEMORY_QUEUE is set to true. Bypassing Redis and using in-memory Task Queue.');
            this.useFallback = true;
            return;
        }

        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

        // Try to initialize Redis connection for BullMQ
        try {
            this.redisConnection = new Redis({
                host: redisHost,
                port: redisPort,
                maxRetriesPerRequest: null, // Required by BullMQ
                connectTimeout: 2000,
            });

            this.redisConnection.on('error', (err) => {
                if (!this.useFallback) {
                    logger.warn(`Redis connection failed (${err.message}). Falling back to local in-memory Task Queue.`);
                    this.useFallback = true;
                }
            });

            this.redisConnection.on('connect', () => {
                logger.info('Connected to Redis for Task Queue successfully.');
                this.useFallback = false;
            });
        } catch (err) {
            logger.warn(`Failed to instantiate Redis client: ${err.message}. Using in-memory Task Queue fallback.`);
            this.useFallback = true;
        }
    }

    async addJob(queueName, jobName, data) {
        logger.info(`[TaskQueue Add] Queue: "${queueName}", Job: "${jobName}"`, { data });

        if (this.useFallback) {
            // Push to local in-memory array and execute immediately
            const job = {
                id: `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                name: jobName,
                data,
                attempts: 0,
            };
            this.fallbackQueue.push({ queueName, job });
            setImmediate(() => this._processFallbackJobs());
            return { id: job.id, fallback: true };
        }

        try {
            if (!this.queues[queueName]) {
                this.queues[queueName] = new Queue(queueName, { connection: this.redisConnection });
                this.queues[queueName].on('error', (err) => {
                    logger.warn(`BullMQ Queue "${queueName}" error: ${err.message}. Dynamic fallback in use.`);
                    this.useFallback = true;
                });
            }
            // BullMQ custom retry config: 3 retries, exponential backoff (2000ms base)
            const job = await this.queues[queueName].add(jobName, data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true, // Auto clean successful jobs
                removeOnFail: false,    // Keep failed jobs for auditing/DLQ
            });
            return { id: job.id, fallback: false };
        } catch (err) {
            logger.error(`Failed to push job to BullMQ queue "${queueName}": ${err.message}. Falling back to memory.`, err);
            this.useFallback = true;
            return this.addJob(queueName, jobName, data);
        }
    }

    // Register a worker callback function to consume jobs
    processQueue(queueName, processorFn) {
        logger.info(`[TaskQueue Register] Consumer registered for: "${queueName}"`);
        
        if (!this.fallbackProcessors) this.fallbackProcessors = {};
        this.fallbackProcessors[queueName] = processorFn;

        if (!this.useFallback) {
            try {
                this.workers[queueName] = new Worker(queueName, async (job) => {
                    logger.info(`[TaskQueue Processing] Worker starting job: ${job.name} (ID: ${job.id})`);
                    return processorFn(job);
                }, { connection: this.redisConnection, concurrency: 5 });

                this.workers[queueName].on('error', (err) => {
                    logger.warn(`BullMQ Worker "${queueName}" error: ${err.message}. Switching to in-memory fallback.`);
                    this.useFallback = true;
                });

                this.workers[queueName].on('completed', (job) => {
                    logger.info(`[TaskQueue Completed] Job completed: ${job.name} (ID: ${job.id})`);
                });

                this.workers[queueName].on('failed', (job, err) => {
                    logger.error(`[TaskQueue Failed] Job failed: ${job?.name || 'unknown'} (ID: ${job?.id || 'n/a'}). Error: ${err.message}`, err);
                });
            } catch (err) {
                logger.warn(`Failed to create BullMQ worker for ${queueName}: ${err.message}. Registering fallback.`);
                this.useFallback = true;
            }
        }
    }

    async _processFallbackJobs() {
        if (this.fallbackQueue.length === 0) return;
        const { queueName, job } = this.fallbackQueue.shift();
        const processor = this.fallbackProcessors ? this.fallbackProcessors[queueName] : null;

        if (!processor) {
            logger.warn(`[TaskQueue Fallback] No processor registered for queue: "${queueName}". Returning job to queue.`);
            this.fallbackQueue.push({ queueName, job });
            return;
        }

        try {
            logger.info(`[TaskQueue Fallback Processing] Starting job: ${job.name} (ID: ${job.id})`);
            await processor(job);
            logger.info(`[TaskQueue Fallback Completed] Job completed: ${job.name} (ID: ${job.id})`);
        } catch (err) {
            logger.error(`[TaskQueue Fallback Failed] Job failed: ${job.name} (ID: ${job.id}). Error: ${err.message}`, err);
            // Local fallback retry logic: retry up to 3 times
            if (job.attempts < 3) {
                job.attempts++;
                const delay = Math.pow(2, job.attempts) * 1000;
                logger.info(`[TaskQueue Fallback Retry] Scheduling retry ${job.attempts}/3 for job ${job.id} in ${delay}ms`);
                setTimeout(() => {
                    this.fallbackQueue.push({ queueName, job });
                    this._processFallbackJobs();
                }, delay);
            } else {
                logger.error(`[TaskQueue Fallback DLQ] Job failed all retries. Moved to Dead Letter state: ${job.id}`);
            }
        }
    }
}

const taskQueueManager = new TaskQueueManager();
module.exports = taskQueueManager;
