import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { IAnalysisRepository } from '../db/repositories/analysis.repository.js';
import type { DatasetStorageService } from '../dataset/storage.js';
import type {
  AnalysisQueueAdapter,
  AnalysisRecord,
} from '../../types/analysis.types.js';
import {
  AnalysisJobStatus,
  ErrorCategory,
} from '../../types/analysis.types.js';
import type { AuthenticatedContext } from '../../types/auth.types.js';
import { assertPermission, assertTenantScope, Permission } from '../auth/rbac.js';

export interface AnalysisSubmissionResult {
  analysisId: string;
  jobId: string;
  status: AnalysisJobStatus | string;
  message: string;
  isDuplicate?: boolean;
}

export interface AnalysisDetailResult extends AnalysisRecord {
  executionResult: any;
  validationResult: any;
  insights: any[];
  dashboardSpec: any;
}

export interface ArtifactFileResult {
  content: Buffer | string;
  mimeType: string;
  fileName: string;
}

export class AnalysisService {
  constructor(
    private readonly analysisRepo: IAnalysisRepository,
    private readonly storage: DatasetStorageService,
    private readonly queue: AnalysisQueueAdapter
  ) {}

  /**
   * Submits a new analytical inquiry for background execution.
   */
  async submitAnalysis(
    auth: AuthenticatedContext,
    datasetId: string,
    userQuery: string
  ): Promise<{ result: AnalysisSubmissionResult; isDuplicate: boolean }> {
    assertPermission(auth.role, Permission.ANALYSIS_CREATE);

    const cleanQuery = userQuery.trim();
    if (!cleanQuery) {
      throw new Error('userQuery cannot be empty');
    }

    // Verify dataset belongs to tenant
    const dataset = await this.storage.getDataset(auth, datasetId);

    // Idempotency: Check if an active analysis with the same query and dataset is currently queued or running
    const existingAnalyses = await this.analysisRepo.listForOrganization(auth.organization.id);
    const activeDuplicate = existingAnalyses.find(
      a =>
        a.datasetId === dataset.id &&
        a.userQuery.trim().toLowerCase() === cleanQuery.toLowerCase() &&
        (a.status === AnalysisJobStatus.QUEUED || a.status === AnalysisJobStatus.RUNNING)
    );

    if (activeDuplicate) {
      return {
        isDuplicate: true,
        result: {
          analysisId: activeDuplicate.id,
          jobId: activeDuplicate.jobId,
          status: activeDuplicate.status,
          message: 'An identical analysis is already in progress.',
          isDuplicate: true,
        },
      };
    }

    const analysisId = crypto.randomUUID();
    await this.analysisRepo.create({
      id: analysisId,
      organizationId: auth.organization.id,
      userId: auth.user.id,
      datasetId: dataset.id,
      userQuery: cleanQuery,
      jobId: 'pending',
      status: AnalysisJobStatus.QUEUED,
      stage: AnalysisJobStatus.QUEUED,
      progressPercent: 0,
      retryCount: 0,
    });

    let jobId: string;
    try {
      const submission = await this.queue.submitJob({
        analysisId,
        organizationId: auth.organization.id,
        userId: auth.user.id,
        datasetId: dataset.id,
        datasetPath: dataset.storagePath,
        userQuery: cleanQuery,
      });
      jobId = submission.jobId;
    } catch (queueErr: any) {
      await this.analysisRepo.update(analysisId, {
        status: AnalysisJobStatus.FAILED,
        stage: AnalysisJobStatus.FAILED,
        errorMessage: `Queue submission failed: ${queueErr.message}`,
        errorCategory: ErrorCategory.INFRASTRUCTURE,
      });
      const error = new Error('Operational Failure: Background job queue was unable to accept this analysis. Please retry.');
      (error as any).statusCode = 503;
      (error as any).analysisId = analysisId;
      throw error;
    }

    return {
      isDuplicate: false,
      result: {
        analysisId,
        jobId,
        status: AnalysisJobStatus.QUEUED,
        message: 'Analysis job submitted successfully.',
      },
    };
  }

  /**
   * Lists all analyses for the organization.
   */
  async listAnalyses(auth: AuthenticatedContext): Promise<AnalysisRecord[]> {
    assertPermission(auth.role, Permission.ANALYSIS_READ);
    return this.analysisRepo.listForOrganization(auth.organization.id);
  }

  /**
   * Retrieves single analysis details with parsed JSON results.
   */
  async getAnalysisDetails(auth: AuthenticatedContext, analysisId: string): Promise<AnalysisDetailResult> {
    assertPermission(auth.role, Permission.ANALYSIS_READ);

    const analysis = await this.analysisRepo.findById(analysisId, auth.organization.id);
    if (!analysis) {
      const notFoundErr = new Error('Analysis not found');
      (notFoundErr as any).statusCode = 404;
      throw notFoundErr;
    }
    assertTenantScope(auth.organization.id, analysis.organizationId, 'Analysis');

    return {
      ...analysis,
      executionResult: analysis.executionResultJson ? JSON.parse(analysis.executionResultJson) : null,
      validationResult: analysis.validationResultJson ? JSON.parse(analysis.validationResultJson) : null,
      insights: analysis.insightsJson ? JSON.parse(analysis.insightsJson) : [],
      dashboardSpec: analysis.dashboardSpecJson ? JSON.parse(analysis.dashboardSpecJson) : null,
    };
  }

  /**
   * Cancels an in-flight analysis job.
   */
  async cancelAnalysis(auth: AuthenticatedContext, analysisId: string): Promise<boolean> {
    assertPermission(auth.role, Permission.ANALYSIS_CANCEL);

    const analysis = await this.analysisRepo.findById(analysisId, auth.organization.id);
    if (!analysis) {
      const notFoundErr = new Error('Analysis not found');
      (notFoundErr as any).statusCode = 404;
      throw notFoundErr;
    }
    assertTenantScope(auth.organization.id, analysis.organizationId, 'Analysis');

    return this.queue.cancelJob(analysis.jobId, auth.organization.id);
  }

  /**
   * Retrieves an artifact file or database-backed spec.
   */
  async getArtifact(auth: AuthenticatedContext, artifactId: string): Promise<ArtifactFileResult> {
    assertPermission(auth.role, Permission.ARTIFACT_DOWNLOAD);

    const artifact = await this.analysisRepo.getArtifactById(artifactId, auth.organization.id);
    if (!artifact) {
      const notFoundErr = new Error('Artifact not found');
      (notFoundErr as any).statusCode = 404;
      throw notFoundErr;
    }
    assertTenantScope(auth.organization.id, artifact.organizationId, 'Artifact');

    if (artifact.storagePath.startsWith('db://')) {
      const analysis = await this.analysisRepo.findById(artifact.analysisId, auth.organization.id);
      if (analysis && analysis.dashboardSpecJson) {
        return {
          content: analysis.dashboardSpecJson,
          mimeType: 'application/json',
          fileName: artifact.fileName,
        };
      }
    }

    const normalizedPath = path.resolve(artifact.storagePath);
    const reportsDir = path.resolve(process.cwd(), 'reports');
    const datasetsDir = path.resolve(process.cwd(), 'datasets');

    const isAuthorizedLocation =
      normalizedPath.startsWith(reportsDir) || normalizedPath.startsWith(datasetsDir);

    if (!isAuthorizedLocation || !fs.existsSync(normalizedPath)) {
      const notFoundErr = new Error('Artifact file not found or inaccessible.');
      (notFoundErr as any).statusCode = 404;
      throw notFoundErr;
    }

    const fileContent = fs.readFileSync(normalizedPath);
    return {
      content: fileContent,
      mimeType: artifact.mimeType,
      fileName: artifact.fileName,
    };
  }
}
