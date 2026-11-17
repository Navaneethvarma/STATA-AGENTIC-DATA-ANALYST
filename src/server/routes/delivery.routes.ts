import { z } from 'zod';
import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { DeliveryDestinationType } from '../../types/delivery.types.js';

const DELIVERY_DETAIL_PATTERN = new RegExp(`^${ApiRoute.DELIVERY_DESTINATIONS}/([a-zA-Z0-9_\\-]+)$`);
const deliveryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Destination name is required'),
  destinationType: z.nativeEnum(DeliveryDestinationType),
  recipientEmails: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  secret: z.string().min(1).optional(),
});

export const handleDeliveryRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('Delivery');
  const { req, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { delivery: deliveryService } = services;

  try {
    if (pathname === ApiRoute.DELIVERY_DESTINATIONS) {
      const auth = await getAuthContext();

      if (req.method === HttpMethod.GET) {
        log.info('Listing delivery destinations');
        const destinations = await deliveryService.listDestinations(auth);
        sendJson(HttpStatus.OK, { destinations });
        log.info({ status: HttpStatus.OK, count: destinations.length }, 'Delivery destinations listed successfully');
        return true;
      }

      if (req.method === HttpMethod.POST) {
        log.info('Creating a delivery destination');
        const body = deliveryCreateSchema.parse(await parseJsonBody<unknown>());
        const destination = await deliveryService.createDestination(auth, body);
        sendJson(HttpStatus.CREATED, { destination });
        log.info({ status: HttpStatus.CREATED, destinationId: destination.id }, 'Delivery destination created successfully');
        return true;
      }
    }

    const deliveryDetailMatch = pathname.match(DELIVERY_DETAIL_PATTERN);
    if (deliveryDetailMatch && deliveryDetailMatch[1]) {
      const destId = deliveryDetailMatch[1];
      const auth = await getAuthContext();

      if (req.method === HttpMethod.GET) {
        log.info({ destinationId: destId }, 'Getting a delivery destination');
        const destination = await deliveryService.getDestination(auth, destId);
        sendJson(HttpStatus.OK, { destination });
        log.info({ status: HttpStatus.OK, destinationId: destId }, 'Delivery destination returned successfully');
        return true;
      }

      if (req.method === HttpMethod.DELETE) {
        log.info({ destinationId: destId }, 'Deleting a delivery destination');
        const deleted = await deliveryService.deleteDestination(auth, destId);
        sendJson(HttpStatus.OK, { success: deleted });
        log.info({ status: HttpStatus.OK, destinationId: destId, deleted }, 'Delivery destination deleted successfully');
        return true;
      }
    }

    return false;
  } catch (error: unknown) {
    log.error({ error: serializeError(error), method: req.method, path: pathname }, 'Error while handling delivery route');
    renderError(sendJson, error);
    return true;
  }
};
