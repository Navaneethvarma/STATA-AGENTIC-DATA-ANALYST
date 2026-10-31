import { type RouteHandler, HttpMethod, ApiRoute } from '../types.js';

export const handleHealthRoutes: RouteHandler = async (ctx) => {
  const { req, pathname, services, sendJson } = ctx;

  if (pathname === ApiRoute.HEALTH && req.method === HttpMethod.GET) {
    const healthResult = await services.health.checkHealth();
    sendJson(healthResult.statusCode, healthResult.data);
    return true;
  }

  return false;
};
