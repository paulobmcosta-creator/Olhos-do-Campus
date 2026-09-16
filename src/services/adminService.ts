import type {
  AdminAssignee,
  AdminSession,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  AuditLog,
  LegacyAdminResolutionInput,
} from '../models/admin';
import {
  adminAssigneesResponseSchema,
  adminSessionResponseSchema,
  adminUserResponseSchema,
  adminUsersResponseSchema,
  auditLogPageResponseSchema,
} from '../validators/responses';
import { requestJson } from './apiClient';

export const adminService = {
  getSession(): Promise<AdminSession> {
    return requestJson<AdminSession>('/api/auth/admin-session', adminSessionResponseSchema, {
      authentication: 'admin',
    });
  },

  listAssignees(): Promise<AdminAssignee[]> {
    return requestJson<AdminAssignee[]>('/api/admin/assignees', adminAssigneesResponseSchema, {
      authentication: 'admin',
    });
  },

  listUsers(): Promise<AdminUser[]> {
    return requestJson<AdminUser[]>('/api/admin/users', adminUsersResponseSchema, {
      authentication: 'admin',
    });
  },

  createUser(input: AdminUserCreateInput): Promise<AdminUser> {
    return requestJson<AdminUser>('/api/admin/users', adminUserResponseSchema, {
      method: 'POST',
      authentication: 'admin',
      body: JSON.stringify(input),
    });
  },

  updateUser(id: string, input: AdminUserUpdateInput): Promise<AdminUser> {
    return requestJson<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, adminUserResponseSchema, {
      method: 'PATCH',
      authentication: 'admin',
      body: JSON.stringify(input),
    });
  },

  resolveLegacy(id: string, input: LegacyAdminResolutionInput): Promise<AdminUser> {
    return requestJson<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/resolve-legacy-role`, adminUserResponseSchema, { method: 'POST', authentication: 'admin', body: JSON.stringify(input) });
  },

  async listAuditLogs(limit = 50): Promise<AuditLog[]> {
    const bounded = limit <= 25 ? 25 : limit <= 50 ? 50 : 100;
    const query = new URLSearchParams({ limit: String(bounded) });
    const page = await requestJson(`/api/admin/audit-logs?${query.toString()}`, auditLogPageResponseSchema, { authentication: 'admin' });
    return page.items.slice(0, limit);
  },
};
