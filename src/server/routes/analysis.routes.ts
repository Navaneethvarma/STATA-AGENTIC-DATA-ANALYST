import { z } from 'zod';
import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { AnalysisAction } from '../../types/analysis.types.js';

const ANALYSIS_DETAIL_PATTERN = new RegExp(`^${ApiRoute.ANALYSES}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);
const ARTIFACT_DETAIL_PATTERN = new RegExp(`^${ApiRoute.ARTIFACTS}/([a-zA-Z0-9_\\-]+)$`);
const analysisCreateSchema = z.object({
  datasetId: z.string().min(1, 'Dataset ID is required'),
  userQuery: z.string().trim().min(1, 'User query is required'),
});

export const handleAnalysisRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('Analysis');
  const { req, res, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { analysis: analysisService } = services;

  try {
    // =========================================================================
    // ANALYSES
    // =========================================================================
    if (pathname === ApiRoute.ANALYSES && req.method === HttpMethod.POST) {
      log.info('Submitting an analysis');
      const auth = await getAuthContext();
      const body = analysisCreateSchema.parse(await parseJsonBody<unknown>());
      const { result, isDuplicate } = await analysisService.submitAnalysis(
        auth,
        body.datasetId,
        body.userQuery
      );

      sendJson(isDuplicate ? HttpStatus.OK : HttpStatus.ACCEPTED, result);
      log.info(
        { status: isDuplicate ? HttpStatus.OK : HttpStatus.ACCEPTED, analysisId: result.analysisId },
        'Analysis submitted successfully'
      );
      return true;
    }

    if (pathname === ApiRoute.ANALYSES && req.method === HttpMethod.GET) {
      log.info('Listing analyses');
      const auth = await getAuthContext();
      const analyses = await analysisService.listAnalyses(auth);
      sendJson(HttpStatus.OK, analyses);
      log.info({ status: HttpStatus.OK, count: analyses.length }, 'Analyses listed successfully');
      return true;
    }

    // =========================================================================
    // ANALYSIS DETAILS AND ACTIONS
    // =========================================================================
    const analysisMatch = pathname.match(ANALYSIS_DETAIL_PATTERN);
    if (analysisMatch && analysisMatch[1]) {
      const analysisId = analysisMatch[1];
      const subResource = analysisMatch[2];
      const auth = await getAuthContext();

      if (!subResource && req.method === HttpMethod.GET) {
        log.info({ analysisId }, 'Getting analysis details');
        const details = await analysisService.getAnalysisDetails(auth, analysisId);
        sendJson(HttpStatus.OK, details);
        log.info({ status: HttpStatus.OK, analysisId }, 'Analysis details returned successfully');
        return true;
      }

      if (subResource === AnalysisAction.CANCEL && req.method === HttpMethod.POST) {
        log.info({ analysisId }, 'Cancelling an analysis');
        const cancelled = await analysisService.cancelAnalysis(auth, analysisId);
        sendJson(HttpStatus.OK, { success: cancelled, message: 'Analysis cancellation initiated' });
        log.info({ status: HttpStatus.OK, analysisId, cancelled }, 'Analysis cancellation requested successfully');
        return true;
      }
    }

    // =========================================================================
    // ARTIFACTS
    // =========================================================================
    const artifactMatch = pathname.match(ARTIFACT_DETAIL_PATTERN);
    if (artifactMatch && artifactMatch[1] && req.method === HttpMethod.GET) {
      const artifactId = artifactMatch[1];
      log.info({ artifactId }, 'Getting an analysis artifact');
      const auth = await getAuthContext();
      const artifact = await analysisService.getArtifact(auth, artifactId);
      res.writeHead(HttpStatus.OK, {
        'Content-Type': artifact.mimeType,
        'Content-Length': Buffer.isBuffer(artifact.content)
          ? artifact.content.length
          : Buffer.byteLength(artifact.content),
        'Content-Disposition': `inline; filename="${artifact.fileName}"`,
      });
      res.end(artifact.content);
      log.info({ status: HttpStatus.OK, artifactId }, 'Analysis artifact returned successfully');
      return true;
    }

    return false;
  } catch (error: unknown) {
    log.error({ error: serializeError(error), method: req.method, path: pathname }, 'Error while handling analysis route');
    renderError(sendJson, error);
    return true;
  }
};
