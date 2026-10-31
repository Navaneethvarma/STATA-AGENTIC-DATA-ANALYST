import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { checkLoginRateLimit, formatSessionCookie } from '../helpers.js';
import { UserRole } from '../../types/user.types.js';

export const handleAuthRoutes: RouteHandler = async (ctx) => {
  const { req, res, pathname, clientIp, services, parseJsonBody, getAuthContext, sendJson } = ctx;
  const { auth: authService } = services;

  if (pathname === ApiRoute.AUTH_REGISTER && req.method === HttpMethod.POST) {
    const body = await parseJsonBody();
    if (!body.email || !body.password || !body.name) {
      sendJson(HttpStatus.BAD_REQUEST, { error: 'email, password, and name are required' });
      return true;
    }
    const result = await authService.register(body);
    res.setHeader('Set-Cookie', formatSessionCookie(result.token));
    sendJson(HttpStatus.CREATED, {
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      organization: result.organization,
      role: UserRole.ADMIN,
      token: result.token,
      csrfToken: result.csrfToken,
    });
    return true;
  }

  if (pathname === ApiRoute.AUTH_LOGIN && req.method === HttpMethod.POST) {
    const body = await parseJsonBody();

    if (!checkLoginRateLimit(clientIp)) {
      sendJson(HttpStatus.TOO_MANY_REQUESTS, { error: 'Too many login attempts. Please wait 1 minute.' });
      return true;
    }

    if (!body.email || !body.password) {
      sendJson(HttpStatus.BAD_REQUEST, { error: 'email and password are required' });
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
    return true;
  }

  if (pathname === ApiRoute.AUTH_LOGOUT && req.method === HttpMethod.POST) {
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
    return true;
  }

  if (pathname === ApiRoute.AUTH_ME && req.method === HttpMethod.GET) {
    const auth = await getAuthContext();
    sendJson(HttpStatus.OK, {
      user: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
      organization: auth.organization,
      role: auth.role,
      csrfToken: auth.csrfToken,
    });
    return true;
  }

  if (pathname === ApiRoute.AUTH_MEMBERS && req.method === HttpMethod.POST) {
    const auth = await getAuthContext();
    const body = await parseJsonBody();
    if (!body.email || !body.role) {
      sendJson(HttpStatus.BAD_REQUEST, { error: 'email and role are required' });
      return true;
    }
    await authService.addMember(auth, body.email, body.role);
    sendJson(HttpStatus.OK, { message: `Member ${body.email} updated to role ${body.role}` });
    return true;
  }

  return false;
};
