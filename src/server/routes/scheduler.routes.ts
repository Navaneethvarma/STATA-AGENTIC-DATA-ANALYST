import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { assertPermission, Permission } from '../../lib/auth/rbac.js';
import {
  ScheduleSubAction,
  type ExportReportFormatValue,
  type ScheduleTypeValue,
} from '../../types/scheduler.types.js';

const SCHEDULE_DETAIL_PATTERN = new RegExp(`^${ApiRoute.SCHEDULES}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);

export const handleSchedulerRoutes: RouteHandler = async (ctx) => {
  const { req, pathname, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { schedule: scheduleService, schedulerDaemon } = services;

  if (pathname === ApiRoute.SCHEDULES) {
    const auth = await getAuthContext();

    if (req.method === HttpMethod.GET) {
      assertPermission(auth.role, Permission.SCHEDULE_READ);
      const schedules = await scheduleService.listSchedules(auth);
      sendJson(HttpStatus.OK, { schedules });
      return true;
    }

    if (req.method === HttpMethod.POST) {
      assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
      const body = await parseJsonBody<{
        datasetId: string;
        name: string;
        userQuery: string;
        scheduleType: ScheduleTypeValue;
        cronExpression?: string;
        timezone?: string;
        oneTimeRunAt?: string;
        concurrencyLimit?: number;
        deliveryDestinationId?: string;
        biConnectionId?: string;
        exportFormat?: ExportReportFormatValue;
      }>();

      const schedule = await scheduleService.createSchedule({
        ...body,
        organizationId: auth.organization.id,
        userId: auth.user.id,
      });
      sendJson(HttpStatus.CREATED, { schedule });
      return true;
    }
  }

  const scheduleDetailMatch = pathname.match(SCHEDULE_DETAIL_PATTERN);
  if (scheduleDetailMatch && scheduleDetailMatch[1]) {
    const scheduleId = scheduleDetailMatch[1];
    const subAction = scheduleDetailMatch[2];
    const auth = await getAuthContext();

    if (!subAction && req.method === HttpMethod.GET) {
      try {
        const schedule = await scheduleService.getSchedule(auth, scheduleId);
        sendJson(HttpStatus.OK, { schedule });
        return true;
      } catch (err: any) {
        if (err.statusCode === 404) {
          sendJson(HttpStatus.NOT_FOUND, { error: err.message });
          return true;
        }
        throw err;
      }
    }

    if (!subAction && req.method === HttpMethod.PUT) {
      assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
      const body = await parseJsonBody<any>();
      const schedule = await scheduleService.updateSchedule(
        scheduleId,
        auth.organization.id,
        auth.user.id,
        body
      );
      sendJson(HttpStatus.OK, { schedule });
      return true;
    }

    if (!subAction && req.method === HttpMethod.DELETE) {
      assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
      const deleted = await scheduleService.deleteSchedule(
        scheduleId,
        auth.organization.id,
        auth.user.id
      );
      sendJson(HttpStatus.OK, { success: deleted });
      return true;
    }

    if (subAction === ScheduleSubAction.TRIGGER && req.method === HttpMethod.POST) {
      assertPermission(auth.role, Permission.SCHEDULE_MANAGE);
      try {
        const schedule = await scheduleService.getSchedule(auth, scheduleId);
        const dispatched = await schedulerDaemon.dispatchSchedule(schedule, new Date().toISOString());
        sendJson(HttpStatus.OK, {
          success: dispatched,
          message: dispatched
            ? 'Schedule triggered successfully'
            : 'Schedule reached concurrency limit or in-flight',
        });
        return true;
      } catch (err: any) {
        if (err.statusCode === 404) {
          sendJson(HttpStatus.NOT_FOUND, { error: err.message });
          return true;
        }
        throw err;
      }
    }

    if (subAction === ScheduleSubAction.RUNS && req.method === HttpMethod.GET) {
      assertPermission(auth.role, Permission.SCHEDULE_READ);
      const runs = await scheduleService.listScheduleRuns(scheduleId, auth.organization.id);
      sendJson(HttpStatus.OK, { runs });
      return true;
    }
  }

  return false;
};
