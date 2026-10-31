/**
 * Business Intelligence (BI) integration domain and persistence types.
 */

export enum BiPlatformType {
  SUPERSET = 'superset',
  METABASE = 'metabase',
}

export type BiPlatformTypeValue = BiPlatformType | `${BiPlatformType}`;

export enum BiConnectionStatus {
  UNTESTED = 'untested',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export type BiConnectionStatusValue = BiConnectionStatus | `${BiConnectionStatus}`;

export enum BiExportStatus {
  PENDING = 'pending',
  EXPORTED = 'exported',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export type BiExportStatusValue = BiExportStatus | `${BiExportStatus}`;

export enum BiSubAction {
  TEST = 'test',
  EXPORT = 'export',
}

export interface BiConnectionRecord {
  id: string;
  organizationId: string;
  name: string;
  platformType: BiPlatformTypeValue;
  hostUrl: string;
  encryptedCredentials: string; // AES-256-GCM encrypted
  status: BiConnectionStatusValue;
  lastTestedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateBiConnectionInput = Omit<BiConnectionRecord, 'createdAt' | 'updatedAt'>;

export type UpdateBiConnectionInput = Partial<Omit<BiConnectionRecord, 'id' | 'organizationId' | 'createdAt'>>;

export interface SupersetCredentials {
  username: string;
  password: string;
  provider?: 'db' | 'ldap';
}

export interface SupersetDatasetSummary {
  id: number;
  tableName: string;
  schema?: string;
  databaseName?: string;
  description?: string;
}

export interface SupersetChartPublishRequest {
  sliceName: string;
  vizType: string;
  datasourceId: number;
  datasourceType?: 'table';
  params?: Record<string, unknown>;
  description?: string;
}

export interface SupersetChartSummary {
  id: number;
  sliceName: string;
  vizType: string;
  url: string;
}
