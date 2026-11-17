import { z } from 'zod';
import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';

const limitSchema = z.coerce.number().int().min(1).max(1000).default(50);

export const handleAuditRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('Audit');
  const { req, pathname, urlObj, services, getAuthContext, sendJson } = ctx;

  try {
    if (pathname !== ApiRoute.AUDIT_LOGS || req.method !== HttpMethod.GET) {
      return false;
    }

    log.info('Listing audit logs');
    const auth = await getAuthContext();
    const limit = limitSchema.parse(urlObj.searchParams.get('limit') ?? undefined);
    const logs = await services.audit.listLogs(auth, limit);
    sendJson(HttpStatus.OK, { logs });
    log.info({ limit, count: logs.length }, 'Audit logs listed successfully');
    return true;
  } catch (error: unknown) {
    log.error({ error: serializeError(error) }, 'Error while listing audit logs');
    renderError(sendJson, error);
    return true;
  }
};
