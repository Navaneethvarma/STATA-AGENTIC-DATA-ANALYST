import type { DatabaseAdapter } from '../types.js';

export interface IBaseRepository {
  checkHealth(): Promise<{ ok: boolean; message?: string }>;
  getAdapter(): DatabaseAdapter;
}

/**
 * Base repository encapsulating access to the underlying DatabaseAdapter contract
 * with reusable operations, health inspection, and tenant verification utilities.
 */
export abstract class BaseRepository implements IBaseRepository {
  constructor(protected readonly db: DatabaseAdapter) {}

  /**
   * Direct access to underlying DatabaseAdapter instance.
   */
  public getAdapter(): DatabaseAdapter {
    return this.db;
  }

  /**
   * Universal health check utility across database repositories.
   */
  public async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    return this.db.checkHealth();
  }

  /**
   * Reusable tenant ownership check.
   */
  protected belongsToTenant(recordOrgId: string, authorizedOrgId?: string): boolean {
    if (!authorizedOrgId) return true;
    return recordOrgId === authorizedOrgId;
  }
}
