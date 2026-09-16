import type { BootstrapData, SystemConfig } from '../models/config';
import { bootstrapResponseSchema, configUpdateResponseSchema } from '../validators/responses';
import { requestJson } from './apiClient';

export const configService = {
  getBootstrap(): Promise<BootstrapData> {
    return requestJson<BootstrapData>('/api/config', bootstrapResponseSchema, { appCheck: true });
  },

  async getOperationalConfig(): Promise<SystemConfig> {
    const response = await requestJson<{ config: SystemConfig }>('/api/admin/config', configUpdateResponseSchema, { authentication: 'admin' });
    return response.config;
  },

  async updateConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
    const response = await requestJson<{ config: SystemConfig }>('/api/config', configUpdateResponseSchema, {
      method: 'PUT',
      authentication: 'admin',
      body: JSON.stringify(config),
    });
    return response.config;
  },
};
