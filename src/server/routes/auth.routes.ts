import { z } from 'zod';
import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { checkLoginRateLimit, formatSessionCookie } from '../helpers.js';
import { UserRole } from '../../types/user.types.js';

const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(250, 'Email must not exceed 250 characters')
  .refine(value => !/\s/.test(value), {
    message: 'Spaces before, after, or inside the email are not allowed',
  })
  .refine(value => (value.match(/@/g) || []).length === 1, {
    message: 'Email must contain exactly one @ symbol',
  })
  .refine(value => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value), {
    message: 'Invalid email address format (e.g., user@example.com)',
  });

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1, 'Name is required'),
  organizationName: z.string().trim().min(1).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  organizationId: z.string().min(1).optional(),
});

const addMemberSchema = z.object({
  email: emailSchema,
  role: z.nativeEnum(UserRole),
});

export const handleAuthRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('Auth');
  const { req, res, pathname, clientIp, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { auth: authService } = services;

  try {
    if (pathname === ApiRoute.AUTH_REGISTER && req.method === HttpMethod.POST) {
      log.info('Registering a user');
      const body = registerSchema.parse(await parseJsonBody<unknown>());
      const result = await authService.register(body);
      res.setHeader('Set-Cookie', formatSessionCookie(result.token));
      sendJson(HttpStatus.CREATED, {
        user: { id: result.user.id, email: result.user.email, name: result.user.name },
        organization: result.organization,
        role: UserRole.ADMIN,
        token: result.token,
        csrfToken: result.csrfToken,
      });
      log.info({ status: HttpStatus.CREATED, organizationId: result.organization.id }, 'User registered successfully');
      return true;
    }

    if (pathname === ApiRoute.AUTH_LOGIN && req.method === HttpMethod.POST) {
      log.info('Authenticating a user');
      const body = loginSchema.parse(await parseJsonBody<unknown>());

      if (!checkLoginRateLimit(clientIp)) {
        sendJson(HttpStatus.TOO_MANY_REQUESTS, { error: 'Too many login attempts. Please wait 1 minute.' });
        return true;
      }

      const result = await authService.login(body);
      res.setHeader('Set-Cookie', formatSessionCookie(result.token));
      sendJson(HttpStatus.OK, {
        user: { id: result.user.id, email: result.user.email, name: result.user.name },
        organization: result.organization,
        role: result.role,
        token: result.token,
        csrfToken: result.csrfToken,
      });
      log.info({ status: HttpStatus.OK, organizationId: result.organization.id }, 'User authenticated successfully');
      return true;
    }

    if (pathname === ApiRoute.AUTH_LOGOUT && req.method === HttpMethod.POST) {
      log.info('Logging out a user');
      let token = '';
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.headers.cookie) {
        const match = req.headers.cookie.match(/session_token=([^;]+)/);
        if (match && match[1]) token = match[1];
      }
      if (token) {
        await authService.logout(token);
      }
      res.setHeader('Set-Cookie', formatSessionCookie('', 0));
      sendJson(HttpStatus.OK, { message: 'Logged out successfully' });
      log.info({ status: HttpStatus.OK }, 'User logged out successfully');
      return true;
    }

    if (pathname === ApiRoute.AUTH_ME && req.method === HttpMethod.GET) {
      log.info('Getting authenticated user context');
      const auth = await getAuthContext();
      sendJson(HttpStatus.OK, {
        user: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
        organization: auth.organization,
        role: auth.role,
        csrfToken: auth.csrfToken,
      });
      log.info({ status: HttpStatus.OK, organizationId: auth.organization.id }, 'Authenticated user context returned successfully');
      return true;
    }

    if (pathname === ApiRoute.AUTH_MEMBERS && req.method === HttpMethod.POST) {
      log.info('Updating an organization member');
      const auth = await getAuthContext();
      const body = addMemberSchema.parse(await parseJsonBody<unknown>());
      await authService.addMember(auth, body.email, body.role);
      sendJson(HttpStatus.OK, { message: `Member ${body.email} updated to role ${body.role}` });
      log.info({ status: HttpStatus.OK, organizationId: auth.organization.id }, 'Organization member updated successfully');
      return true;
    }

    return false;
  } catch (error: unknown) {
    log.error({ error: serializeError(error), method: req.method, path: pathname }, 'Error while handling authentication route');
    renderError(sendJson, error);
    return true;
  }
};
