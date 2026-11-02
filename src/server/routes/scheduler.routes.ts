import { z } from 'zod';
import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { assertPermission, Permission } from '../../lib/auth/rbac.js';
import {
  ScheduleSubAction,
  ScheduleType,
  ExportReportFormat,
} from '../../types/scheduler.types.js';

const SCHEDULE_DETAIL_PATTERN = new RegExp(`^${ApiRoute.SCHEDULES}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);
const scheduleCreateSchema = z.object({
  datasetId: z.string().min(1, 'Dataset ID is required'),
  name: z.string().trim().min(1, 'Schedule name is required'),
  userQuery: z.string().trim().min(1, 'User query is required'),
  scheduleType: z.nativeEnum(ScheduleType),
  cronExpression: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).optional(),
  oneTimeRunAt: z.string().trim().min(1).optional(),
  concurrencyLimit: z.number().int().positive().optional(),
  deliveryDestinationId: z.string().min(1).optional(),
  biConnectionId: z.string().min(1).optional(),
  exportFormat: z.nativeEnum(ExportReportFormat).optional(),
});

const scheduleUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    userQuery: z.string().trim().min(1).optional(),
    cronExpression: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).optional(),
    oneTimeRunAt: z.string().trim().min(1).optional(),
    concurrencyLimit: z.number().int().positive().optional(),
    isEnabled: z.boolean().optional(),
    deliveryDestinationId: z.string().min(1).nullable().optional(),
    biConnectionId: z.string().min(1).nullable().optional(),
    exportFormat: z.nativeEnum(ExportReportFormat).optional(),
  })
  .refine(body => Object.keys(body).length > 0, { message: 'At least one update field is required' });

export const handleSchedulerRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('Scheduler');
  const { req, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { schedule: scheduleService, schedulerDaemon } = services;

  try {
    if (pathname === ApiRoute.SCHEDULES) {
      const auth = await getAuthContext();

      if (req.method === HttpMethod.GET) {
        log.info('Listing schedules');
        assertPermission(auth.role, Permission.SCHEDULE_READ);
        const schedules = await scheduleService.listSchedules(auth);
        sendJson(HttpStatus.OK, { schedules });
        log.info({ status: HttpStatus.OK, count: schedules.length }, 'Schedules listed successfully');
        return true;
      }

      if (req.method === HttpMethod.POST) {
        log.info('Creating a schedule');
        assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
        const body = scheduleCreateSchema.parse(await parseJsonBody<unknown>());
        const schedule = await scheduleService.createSchedule({
          ...body,
          organizationId: auth.organization.id,
          userId: auth.user.id,
        });
        sendJson(HttpStatus.CREATED, { schedule });
        log.info({ status: HttpStatus.CREATED, scheduleId: schedule.id }, 'Schedule created successfully');
        return true;
      }
    }

    const scheduleDetailMatch = pathname.match(SCHEDULE_DETAIL_PATTERN);
    if (scheduleDetailMatch && scheduleDetailMatch[1]) {
      const scheduleId = scheduleDetailMatch[1];
      const subAction = scheduleDetailMatch[2];
      const auth = await getAuthContext();

      if (!subAction && req.method === HttpMethod.GET) {
        log.info({ scheduleId }, 'Getting a schedule');
        const schedule = await scheduleService.getSchedule(auth, scheduleId);
        sendJson(HttpStatus.OK, { schedule });
        log.info({ status: HttpStatus.OK, scheduleId }, 'Schedule returned successfully');
        return true;
      }

      if (!subAction && req.method === HttpMethod.PUT) {
        log.info({ scheduleId }, 'Updating a schedule');
        assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
        const body = scheduleUpdateSchema.parse(await parseJsonBody<unknown>());
        const schedule = await scheduleService.updateSchedule(
          scheduleId,
          auth.organization.id,
          auth.user.id,
          body
        );
        sendJson(HttpStatus.OK, { schedule });
        log.info({ status: HttpStatus.OK, scheduleId }, 'Schedule updated successfully');
        return true;
      }

      if (!subAction && req.method === HttpMethod.DELETE) {
        log.info({ scheduleId }, 'Deleting a schedule');
        assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
        const deleted = await scheduleService.deleteSchedule(
          scheduleId,
          auth.organization.id,
          auth.user.id
        );
        sendJson(HttpStatus.OK, { success: deleted });
        log.info({ status: HttpStatus.OK, scheduleId, deleted }, 'Schedule deleted successfully');
        return true;
      }

      if (subAction === ScheduleSubAction.TRIGGER && req.method === HttpMethod.POST) {
        log.info({ scheduleId }, 'Triggering a schedule');
        assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
        const schedule = await scheduleService.getSchedule(auth, scheduleId);
        const dispatched = await schedulerDaemon.dispatchSchedule(schedule, new Date().toISOString());
        sendJson(HttpStatus.OK, {
          success: dispatched,
          message: dispatched
            ? 'Schedule triggered successfully'
            : 'Schedule reached concurrency limit or in-flight',
        });
        log.info({ status: HttpStatus.OK, scheduleId, dispatched }, 'Schedule trigger processed successfully');
        return true;
      }

      if (subAction === ScheduleSubAction.RUNS && req.method === HttpMethod.GET) {
        log.info({ scheduleId }, 'Listing schedule runs');
        assertPermission(auth.role, Permission.SCHEDULE_READ);
        const runs = await scheduleService.listScheduleRuns(scheduleId, auth.organization.id);
        sendJson(HttpStatus.OK, { runs });
        log.info({ status: HttpStatus.OK, scheduleId, count: runs.length }, 'Schedule runs listed successfully');
        return true;
      }
    }

    return false;
  } catch (error: unknown) {
    log.error({ error: serializeError(error), method: req.method, path: pathname }, 'Error while handling scheduler route');
    renderError(sendJson, error);
    return true;
  }
};
