import type { IAuditRepository } from '../db/repositories/audit.repository.js';
import type { AuditLogRecord } from '../../types/audit.types.js';
import type { AuthenticatedContext } from '../../types/auth.types.js';
import { assertPermission, Permission } from '../auth/rbac.js';

export class AuditService {
  constructor(private readonly auditRepo: IAuditRepository) {}

  /**
   * Retrieves paginated tenant audit logs for authorized organization members.
   */
  async listLogs(auth: AuthenticatedContext, limit = 50): Promise<AuditLogRecord[]> {
    assertPermission(auth.role, Permission.ORG_MANAGE_MEMBERS);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.auditRepo.listForOrganization(auth.organization.id, safeLimit);
  }
}

