import { z } from 'zod';
import type { NotificationStatus } from '../models/infrastructure';
import { notificationStatusResponseSchema } from '../validators/responses';
import { requestJson } from './apiClient';

const queuedSchema=z.object({id:z.string(),status:z.string(),recipient:z.string()}).passthrough();
export const notificationService={
 status:():Promise<NotificationStatus>=>requestJson('/api/admin/notifications/status',notificationStatusResponseSchema,{authentication:'admin'}),
 test:(recipient:string):Promise<unknown>=>requestJson('/api/admin/notifications/test',queuedSchema,{method:'POST',authentication:'admin',body:JSON.stringify({recipient})}),
 retry:(limit=20):Promise<{requeued:number}>=>requestJson('/api/admin/notifications/retry',z.object({requeued:z.number()}),{method:'POST',authentication:'admin',body:JSON.stringify({limit})}),
};
