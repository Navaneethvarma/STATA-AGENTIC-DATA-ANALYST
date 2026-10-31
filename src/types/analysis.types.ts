/**
 * Analysis domain, job queue payloads, and artifact persistence types.
 */

export enum AnalysisJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIAL_SUCCESS = 'partial_success',
}

export type AnalysisJobStatusType = AnalysisJobStatus | `${AnalysisJobStatus}`;

export enum AnalysisAction {
  CANCEL = 'cancel',
}

export interface AnalysisRecord {
  id: string;
  organizationId: string;
  userId: string;
  datasetId: string;
  userQuery: string;
  jobId: string;
  status: AnalysisJobStatus | `${AnalysisJobStatus}`;
  stage: string;
  progressPercent: number;
  executionResultJson?: string | null;
  validationResultJson?: string | null;
  insightsJson?: string | null;
  dashboardSpecJson?: string | null;
  clarificationQuestion?: string | null;
  finalExplanation?: string | null;
  errorMessage?: string | null;
  errorCategory?: string | null;
  traceId?: string | null;
  runId?: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateAnalysisInput = Omit<AnalysisRecord, 'createdAt' | 'updatedAt'>;

export type UpdateAnalysisInput = Partial<Omit<AnalysisRecord, 'id' | 'organizationId' | 'createdAt'>>;

export enum ArtifactType {
  DASHBOARD_SPEC = 'dashboard_spec',
  REPORT_HTML = 'report_html',
  REPORT_PDF = 'report_pdf',
  TRACE_LOG = 'trace_log',
}

export type ArtifactTypeValue = ArtifactType | `${ArtifactType}`;

export enum ErrorCategory {
  INFRASTRUCTURE = 'infrastructure',
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  TIMEOUT = 'timeout',
  SECURITY = 'security',
}

export interface ArtifactRecord {
  id: string;
  organizationId: string;
  analysisId: string;
  artifactType: ArtifactTypeValue;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface AnalysisJobPayload {
  analysisId: string;
  organizationId: string;
  userId: string;
  datasetId: string;
  datasetPath: string;
  userQuery: string;
}

export interface AnalysisQueueAdapter {
  submitJob(payload: AnalysisJobPayload): Promise<{ jobId: string }>;
  cancelJob(jobId: string, organizationId: string): Promise<boolean>;
  getJobStatus(jobId: string, organizationId: string): Promise<AnalysisRecord | null>;
  close(): Promise<void>;
  isReady(): boolean;
}
