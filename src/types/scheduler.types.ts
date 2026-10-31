/**
 * Scheduler and recurrence domain and persistence types.
 */

export enum ScheduleType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
}

export type ScheduleTypeValue = ScheduleType | `${ScheduleType}`;

export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export type ScheduleStatusValue = ScheduleStatus | `${ScheduleStatus}`;

export enum ScheduleRunStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export type ScheduleRunStatusValue = ScheduleRunStatus | `${ScheduleRunStatus}`;

export enum ExportReportFormat {
  HTML = 'html',
  PDF = 'pdf',
  BOTH = 'both',
}

export type ExportReportFormatValue = ExportReportFormat | `${ExportReportFormat}`;

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export type DeliveryStatusValue = DeliveryStatus | `${DeliveryStatus}`;

export enum ScheduleSubAction {
  TRIGGER = 'trigger',
  RUNS = 'runs',
}

import type { BiExportStatus } from './bi.types.js';

export interface ScheduleRecord {
  id: string;
  organizationId: string;
  createdByUserId: string;
  datasetId: string;
  name: string;
  userQuery: string;
  scheduleType: ScheduleTypeValue;
  cronExpression?: string | null;
  timezone: string;
  oneTimeRunAt?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  concurrencyLimit: number;
  isEnabled: boolean;
  deliveryDestinationId?: string | null;
  biConnectionId?: string | null;
  exportFormat: ExportReportFormatValue;
  status: ScheduleStatusValue;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  organizationId: string;
  userId: string;
  datasetId: string;
  name: string;
  userQuery: string;
  scheduleType: ScheduleTypeValue;
  cronExpression?: string;
  timezone?: string;
  oneTimeRunAt?: string;
  concurrencyLimit?: number;
  deliveryDestinationId?: string;
  biConnectionId?: string;
  exportFormat?: ExportReportFormatValue;
}

export interface UpdateScheduleInput {
  name?: string;
  userQuery?: string;
  cronExpression?: string;
  timezone?: string;
  oneTimeRunAt?: string;
  concurrencyLimit?: number;
  isEnabled?: boolean;
  deliveryDestinationId?: string | null;
  biConnectionId?: string | null;
  exportFormat?: ExportReportFormat;
}

export interface ScheduleRunRecord {
  id: string;
  scheduleId: string;
  organizationId: string;
  analysisId?: string | null;
  scheduledFor: string;
  startedAt: string;
  completedAt?: string | null;
  status: ScheduleRunStatus | `${ScheduleRunStatus}`;
  errorMessage?: string | null;
  deliveryStatus?: DeliveryStatus | `${DeliveryStatus}` | null;
  deliveryDetailsJson?: string | null;
  biExportStatus?: BiExportStatus | `${BiExportStatus}` | null;
  biExportDetailsJson?: string | null;
  retryCount: number;
  createdAt: string;
}

export type CreateScheduleRunInput = Omit<ScheduleRunRecord, 'createdAt'>;

export type UpdateScheduleRunInput = Partial<Omit<ScheduleRunRecord, 'id' | 'scheduleId' | 'organizationId' | 'createdAt'>>;
