/**
 * Dataset persistence models, storage options, and status enumerations.
 */

export enum DatasetFormat {
  CSV = 'csv',
  PARQUET = 'parquet',
}

export type DatasetFormatValue = `${DatasetFormat}`;

export enum DatasetStatus {
  REGISTERED = 'registered',
  PROFILING = 'profiling',
  READY = 'ready',
  ERROR = 'error',
}

export type DatasetStatusValue = `${DatasetStatus}`;

export enum DatasetSubResource {
  PROFILE = 'profile',
  PREVIEW = 'preview',
}

export interface DatasetRecord {
  id: string;
  organizationId: string;
  uploadedByUserId: string;
  originalFilename: string;
  storagePath: string;
  fileSizeBytes: number;
  format: DatasetFormat | DatasetFormatValue;
  rowCount: number;
  columnCount: number;
  schemaFingerprint: string;
  status: DatasetStatus | DatasetStatusValue;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetProfileRecord {
  id: string;
  datasetId: string;
  profileJson: string; // JSON stringified DatasetProfile
  createdAt: string;
}

export interface CreateDatasetInput {
  id: string;
  organizationId: string;
  uploadedByUserId: string;
  originalFilename: string;
  storagePath: string;
  fileSizeBytes: number;
  format: DatasetFormat | DatasetFormatValue;
  rowCount: number;
  columnCount: number;
  schemaFingerprint: string;
  status: DatasetStatus | DatasetStatusValue;
}

export interface DatasetUploadOptions {
  originalFilename: string;
  buffer: Buffer;
}
