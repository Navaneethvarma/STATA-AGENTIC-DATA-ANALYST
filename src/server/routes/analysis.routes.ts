import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { AnalysisAction } from '../../types/analysis.types.js';

const ANALYSIS_DETAIL_PATTERN = new RegExp(`^${ApiRoute.ANALYSES}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);
const ARTIFACT_DETAIL_PATTERN = new RegExp(`^${ApiRoute.ARTIFACTS}/([a-zA-Z0-9_\\-]+)$`);

export const handleAnalysisRoutes: RouteHandler = async (ctx) => {
  const { req, res, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { analysis: analysisService } = services;

  // =========================================================================
  // ANALYSES
  // =========================================================================
  if (pathname === ApiRoute.ANALYSES && req.method === HttpMethod.POST) {
    const auth = await getAuthContext();
    const body = await parseJsonBody();

    if (!body.datasetId || !body.userQuery) {
      sendJson(HttpStatus.BAD_REQUEST, { error: 'datasetId and userQuery are required' });
      return true;
    }

    try {
      const { result, isDuplicate } = await analysisService.submitAnalysis(
        auth,
        body.datasetId,
        body.userQuery
      );

      sendJson(isDuplicate ? HttpStatus.OK : HttpStatus.ACCEPTED, result);
      return true;
    } catch (err: any) {
      if (err.statusCode === 503) {
        sendJson(HttpStatus.SERVICE_UNAVAILABLE, {
          error: err.message,
          analysisId: err.analysisId,
        });
        return true;
      }
      throw err;
    }
  }

  if (pathname === ApiRoute.ANALYSES && req.method === HttpMethod.GET) {
    const auth = await getAuthContext();
    const analyses = await analysisService.listAnalyses(auth);
    sendJson(HttpStatus.OK, analyses);
    return true;
  }

  const analysisMatch = pathname.match(ANALYSIS_DETAIL_PATTERN);
  if (analysisMatch && analysisMatch[1]) {
    const analysisId = analysisMatch[1];
    const subResource = analysisMatch[2];
    const auth = await getAuthContext();

    if (!subResource && req.method === HttpMethod.GET) {
      try {
        const details = await analysisService.getAnalysisDetails(auth, analysisId);
        sendJson(HttpStatus.OK, details);
        return true;
      } catch (err: any) {
        if (err.statusCode === 404) {
          sendJson(HttpStatus.NOT_FOUND, { error: err.message });
          return true;
        }
        throw err;
      }
    }

    if (subResource === AnalysisAction.CANCEL && req.method === HttpMethod.POST) {
      try {
        const cancelled = await analysisService.cancelAnalysis(auth, analysisId);
        sendJson(HttpStatus.OK, { success: cancelled, message: 'Analysis cancellation initiated' });
        return true;
      } catch (err: any) {
        if (err.statusCode === 404) {
          sendJson(HttpStatus.NOT_FOUND, { error: err.message });
          return true;
        }
        throw err;
      }
    }
  }

  // =========================================================================
  // ARTIFACTS
  // =========================================================================
  const artifactMatch = pathname.match(ARTIFACT_DETAIL_PATTERN);
  if (artifactMatch && artifactMatch[1] && req.method === HttpMethod.GET) {
    const artifactId = artifactMatch[1];
    const auth = await getAuthContext();

    try {
      const artifact = await analysisService.getArtifact(auth, artifactId);
      res.writeHead(HttpStatus.OK, {
        'Content-Type': artifact.mimeType,
        'Content-Length': Buffer.isBuffer(artifact.content)
          ? artifact.content.length
          : Buffer.byteLength(artifact.content),
        'Content-Disposition': `inline; filename="${artifact.fileName}"`,
      });
      res.end(artifact.content);
      return true;
    } catch (err: any) {
      if (err.statusCode === 404) {
        sendJson(HttpStatus.NOT_FOUND, { error: err.message });
        return true;
      }
      throw err;
    }
  }

  return false;
};
