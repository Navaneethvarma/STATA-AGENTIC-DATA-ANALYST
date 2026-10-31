import { BaseRepository } from './base.repository.js';

export interface IHealthRepository {
  checkDatabase(): Promise<{ ok: boolean; message?: string }>;
}

export class HealthRepository extends BaseRepository implements IHealthRepository {
  async checkDatabase(): Promise<{ ok: boolean; message?: string }> {
    return this.checkHealth();
  }
}

