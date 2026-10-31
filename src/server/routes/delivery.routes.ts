import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import type { DeliveryDestinationTypeValue } from '../../types/delivery.types.js';

const DELIVERY_DETAIL_PATTERN = new RegExp(`^${ApiRoute.DELIVERY_DESTINATIONS}/([a-zA-Z0-9_\\-]+)$`);

export const handleDeliveryRoutes: RouteHandler = async (ctx) => {
  const { req, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { delivery: deliveryService } = services;

  if (pathname === ApiRoute.DELIVERY_DESTINATIONS) {
    const auth = await getAuthContext();

    if (req.method === HttpMethod.GET) {
      const destinations = await deliveryService.listDestinations(auth);
      sendJson(HttpStatus.OK, { destinations });
      return true;
    }

    if (req.method === HttpMethod.POST) {
      const body = await parseJsonBody<{
        name: string;
        destinationType: DeliveryDestinationTypeValue;
        recipientEmails?: string;
        webhookUrl?: string;
        secret?: string;
      }>();

      const destination = await deliveryService.createDestination(auth, body);
      sendJson(HttpStatus.CREATED, { destination });
      return true;
    }
  }

  const deliveryDetailMatch = pathname.match(DELIVERY_DETAIL_PATTERN);
  if (deliveryDetailMatch && deliveryDetailMatch[1]) {
    const destId = deliveryDetailMatch[1];
    const auth = await getAuthContext();

    if (req.method === HttpMethod.GET) {
      try {
        const destination = await deliveryService.getDestination(auth, destId);
        sendJson(HttpStatus.OK, { destination });
        return true;
      } catch (err: any) {
        if (err.statusCode === 404) {
          sendJson(HttpStatus.NOT_FOUND, { error: err.message });
          return true;
        }
        throw err;
      }
    }

    if (req.method === HttpMethod.DELETE) {
      try {
        const deleted = await deliveryService.deleteDestination(auth, destId);
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
  }

  return false;
};
