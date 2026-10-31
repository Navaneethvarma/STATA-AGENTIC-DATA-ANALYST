import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';

export const handleAuditRoutes: RouteHandler = async (ctx) => {
  const { req, pathname, urlObj, services, getAuthContext, sendJson } = ctx;

  if (pathname === ApiRoute.AUDIT_LOGS && req.method === HttpMethod.GET) {
    const auth = await getAuthContext();
    const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
    const logs = await services.audit.listLogs(auth, limit);
    sendJson(HttpStatus.OK, { logs });
    return true;
  }

  return false;
};
