import type { IHealthRepository } from '../db/repositories/health.repository.js';
import type { AnalysisQueueAdapter } from '../../types/analysis.types.js';
import {
  HealthStatus,
  DatabaseHealth,
  QueueHealth,
  type SystemHealthResult,
} from '../../types/health.types.js';
import { HttpStatus } from '../../server/types.js';

export class HealthService {
  constructor(
    private readonly healthRepo: IHealthRepository,
    private readonly queue: AnalysisQueueAdapter
  ) {}

  /**
   * Evaluates the health status of database connectivity and queue daemon.
   */
  async checkHealth(): Promise<SystemHealthResult> {
    const dbHealth = await this.healthRepo.checkDatabase();
    const isHealthy = dbHealth.ok;

    return {
      isHealthy,
      statusCode: isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
      data: {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        database: dbHealth.ok ? DatabaseHealth.CONNECTED : DatabaseHealth.ERROR,
        queue: this.queue.isReady() ? QueueHealth.READY : QueueHealth.IN_MEMORY,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

