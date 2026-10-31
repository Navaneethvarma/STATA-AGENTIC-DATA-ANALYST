import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { assertPermission, Permission } from '../../lib/auth/rbac.js';
import { BiSubAction, type BiPlatformTypeValue } from '../../types/bi.types.js';

const BI_DETAIL_PATTERN = new RegExp(`^${ApiRoute.BI_CONNECTIONS}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);

export const handleBiRoutes: RouteHandler = async (ctx) => {
  const { req, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { bi: biService } = services;

  if (pathname === ApiRoute.BI_CONNECTIONS) {
    const auth = await getAuthContext();

    if (req.method === HttpMethod.GET) {
      const connections = await biService.listConnections(auth);
      sendJson(HttpStatus.OK, { connections });
      return true;
    }

    if (req.method === HttpMethod.POST) {
      const body = await parseJsonBody<{
        name: string;
        platformType: BiPlatformTypeValue;
        hostUrl: string;
        username: string;
        password: string;
      }>();

      const connection = await biService.createConnection(auth, body);
      sendJson(HttpStatus.CREATED, { connection });
      return true;
    }
  }

  const biDetailMatch = pathname.match(BI_DETAIL_PATTERN);
  if (biDetailMatch && biDetailMatch[1]) {
    const connId = biDetailMatch[1];
    const subAction = biDetailMatch[2];
    const auth = await getAuthContext();

    if (!subAction && req.method === HttpMethod.GET) {
      try {
        const connection = await biService.getConnection(auth, connId);
        sendJson(HttpStatus.OK, { connection });
        return true;
      } catch (err: any) {
        if (err.statusCode === 404) {
          sendJson(HttpStatus.NOT_FOUND, { error: err.message });
          return true;
        }
        throw err;
      }
    }

    if (!subAction && req.method === HttpMethod.DELETE) {
      try {
        const deleted = await biService.deleteConnection(auth, connId);
        sendJson(HttpStatus.OK, { success: deleted });
        return true;
      } catch (err: any) {
        if (err.statusCode === 404) {
          sendJson(HttpStatus.NOT_FOUND, { error: err.message });
          return true;
        }
        throw err;
      }
    }

    if (subAction === BiSubAction.TEST && req.method === HttpMethod.POST) {
      assertPermission(auth.role, Permission.BI_MANAGE);
      const resTest = await biService.testConnection(connId, auth.organization.id);
      sendJson(HttpStatus.OK, resTest);
      return true;
    }

    if (subAction === BiSubAction.EXPORT && req.method === HttpMethod.POST) {
      assertPermission(auth.role, Permission.BI_MANAGE);
      const body = await parseJsonBody<{ analysisId: string; datasourceId?: number }>();
      const resExport = await biService.exportAnalysis({
        connectionId: connId,
        organizationId: auth.organization.id,
        analysisId: body.analysisId,
        datasourceId: body.datasourceId,
      });
      sendJson(HttpStatus.OK, resExport);
      return true;
    }
  }

  return false;
};
