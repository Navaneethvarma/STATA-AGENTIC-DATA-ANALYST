import { z } from 'zod';
import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { assertPermission, Permission } from '../../lib/auth/rbac.js';
import { BiPlatformType, BiSubAction } from '../../types/bi.types.js';

const BI_DETAIL_PATTERN = new RegExp(`^${ApiRoute.BI_CONNECTIONS}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);
const biCreateSchema = z.object({
  name: z.string().trim().min(1, 'Connection name is required'),
  platformType: z.nativeEnum(BiPlatformType),
  hostUrl: z.string().url('Host URL must be a valid URL'),
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
const biExportSchema = z.object({
  analysisId: z.string().min(1, 'Analysis ID is required'),
  datasourceId: z.number().int().positive().optional(),
});

export const handleBiRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('BI');
  const { req, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { bi: biService } = services;

  try {
    if (pathname === ApiRoute.BI_CONNECTIONS) {
      const auth = await getAuthContext();

      if (req.method === HttpMethod.GET) {
        log.info('Listing BI connections');
        const connections = await biService.listConnections(auth);
        sendJson(HttpStatus.OK, { connections });
        log.info({ status: HttpStatus.OK, count: connections.length }, 'BI connections listed successfully');
        return true;
      }

      if (req.method === HttpMethod.POST) {
        log.info('Creating a BI connection');
        const body = biCreateSchema.parse(await parseJsonBody<unknown>());
        const connection = await biService.createConnection(auth, body);
        sendJson(HttpStatus.CREATED, { connection });
        log.info({ status: HttpStatus.CREATED, connectionId: connection.id }, 'BI connection created successfully');
        return true;
      }
    }

    const biDetailMatch = pathname.match(BI_DETAIL_PATTERN);
    if (biDetailMatch && biDetailMatch[1]) {
      const connId = biDetailMatch[1];
      const subAction = biDetailMatch[2];
      const auth = await getAuthContext();

      if (!subAction && req.method === HttpMethod.GET) {
        log.info({ connectionId: connId }, 'Getting a BI connection');
        const connection = await biService.getConnection(auth, connId);
        sendJson(HttpStatus.OK, { connection });
        log.info({ status: HttpStatus.OK, connectionId: connId }, 'BI connection returned successfully');
        return true;
      }

      if (!subAction && req.method === HttpMethod.DELETE) {
        log.info({ connectionId: connId }, 'Deleting a BI connection');
        const deleted = await biService.deleteConnection(auth, connId);
        sendJson(HttpStatus.OK, { success: deleted });
        log.info({ status: HttpStatus.OK, connectionId: connId, deleted }, 'BI connection deleted successfully');
        return true;
      }

      if (subAction === BiSubAction.TEST && req.method === HttpMethod.POST) {
        log.info({ connectionId: connId }, 'Testing a BI connection');
        assertPermission(auth.role, Permission.BI_MANAGE);
        const resTest = await biService.testConnection(connId, auth.organization.id);
        sendJson(HttpStatus.OK, resTest);
        log.info({ status: HttpStatus.OK, connectionId: connId }, 'BI connection tested successfully');
        return true;
      }

      if (subAction === BiSubAction.EXPORT && req.method === HttpMethod.POST) {
        log.info({ connectionId: connId }, 'Exporting an analysis to BI');
        assertPermission(auth.role, Permission.BI_MANAGE);
        const body = biExportSchema.parse(await parseJsonBody<unknown>());
        const resExport = await biService.exportAnalysis({
          connectionId: connId,
          organizationId: auth.organization.id,
          analysisId: body.analysisId,
          datasourceId: body.datasourceId,
        });
        sendJson(HttpStatus.OK, resExport);
        log.info({ status: HttpStatus.OK, connectionId: connId, analysisId: body.analysisId }, 'Analysis exported to BI successfully');
        return true;
      }
    }

    return false;
  } catch (error: unknown) {
    log.error({ error: serializeError(error), method: req.method, path: pathname }, 'Error while handling BI route');
    renderError(sendJson, error);
    return true;
  }
};
