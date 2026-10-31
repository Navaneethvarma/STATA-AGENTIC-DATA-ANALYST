/**
 * Health check domain types and status enumerations.
 */

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
}

export enum DatabaseHealth {
  CONNECTED = 'connected',
  ERROR = 'error',
}

export enum QueueHealth {
  READY = 'ready',
  IN_MEMORY = 'in-memory',
}

export interface SystemHealthData {
  status: HealthStatus;
  database: DatabaseHealth;
  queue: QueueHealth;
  timestamp: string;
}

export interface SystemHealthResult {
  isHealthy: boolean;
  statusCode: number;
  data: SystemHealthData;
}

