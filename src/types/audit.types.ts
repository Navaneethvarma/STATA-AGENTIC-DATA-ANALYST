/**
 * Audit log domain and persistence types.
 */

export enum AuditAction {
  USER_LOGIN = 'user:login',
  USER_REGISTER = 'user:register',
  USER_LOGOUT = 'user:logout',
  MEMBER_ADDED = 'member:added',
  DATASET_UPLOADED = 'dataset:uploaded',
  DATASET_DELETED = 'dataset:deleted',
  SCHEDULE_CREATED = 'schedule:created',
  SCHEDULE_UPDATED = 'schedule:updated',
  SCHEDULE_DELETED = 'schedule:deleted',
  SCHEDULE_TRIGGERED = 'schedule:triggered',
  DELIVERY_DESTINATION_CREATED = 'delivery:destination_created',
  DELIVERY_DESTINATION_UPDATED = 'delivery:destination_updated',
  DELIVERY_DESTINATION_DELETED = 'delivery:destination_deleted',
  BI_CONNECTION_CREATED = 'bi:connection_created',
  BI_CONNECTION_UPDATED = 'bi:connection_updated',
  BI_CONNECTION_DELETED = 'bi:connection_deleted',
  BI_CONNECTION_TESTED = 'bi:connection_tested',
  BI_CONNECTION_TEST_FAILED = 'bi:connection_test_failed',
  BI_ANALYSIS_EXPORTED = 'bi:analysis_exported',
  BI_ANALYSIS_EXPORT_FAILED = 'bi:analysis_export_failed',
}

export enum AuditResourceType {
  USER = 'user',
  ORGANIZATION = 'organization',
  DATASET = 'dataset',
  ANALYSIS = 'analysis',
  SCHEDULE = 'schedule',
  DELIVERY_DESTINATION = 'delivery_destination',
  BI_CONNECTION = 'bi_connection',
}

export interface AuditLogRecord {
  id: string;
  organizationId: string;
  userId?: string | null;
  action: AuditAction | string;
  resourceType: AuditResourceType | string;
  resourceId: string;
  detailsJson?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export type CreateAuditLogInput = Omit<AuditLogRecord, 'createdAt'>;
