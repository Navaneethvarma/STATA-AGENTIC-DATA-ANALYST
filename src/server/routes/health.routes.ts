import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, ApiRoute } from '../types.js';

export const handleHealthRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('Health');
  const { req, pathname, services, sendJson } = ctx;

  try {
    if (pathname !== ApiRoute.HEALTH || req.method !== HttpMethod.GET) {
      return false;
    }

    log.info('Checking API health');
    const healthResult = await services.health.checkHealth();
    sendJson(healthResult.statusCode, healthResult.data);
    log.info({ status: healthResult.statusCode }, 'API health checked successfully');
    return true;
  } catch (error: unknown) {
    log.error({ error: serializeError(error) }, 'Error while checking API health');
    renderError(sendJson, error);
    return true;
  }
};
