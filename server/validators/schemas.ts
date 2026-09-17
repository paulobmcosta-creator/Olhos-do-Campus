import { z } from 'zod';
import { ADMIN_ROLES, AUDIT_EVENT_TYPES } from '../../src/models/admin';
import { CALENDAR_EXCEPTION_TYPES, WEEKDAY_KEYS } from '../../src/models/operations';
import { INTERNAL_NOTE_AUDIENCES, OCCURRENCE_PRIORITIES, OCCURRENCE_STATUSES } from '../../src/models/occurrence';

const booleanQuery=z.enum(['true','false']).transform(v=>v==='true');
const id=z.string().trim().min(1).max(160);
const hhmm=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u,'Use horário HH:MM.');
const pageSize=z.coerce.number().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]));

export const locationSelectionSchema=z.object({campusId:id,buildingId:id,floorId:id,roomId:id,complement:z.string().trim().max(300).optional(),isOther:z.boolean().optional(),otherDescription:z.string().trim().max(300).optional()}).strict();
export const createOccurrenceSchema=z.object({location:locationSelectionSchema,categoryId:id,description:z.string().trim().min(20).max(2000),immediateRisk:z.boolean()}).strict();
export const trackingBodySchema=z.object({protocol:z.string().trim().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{4}-\d{6}$/iu),trackingKey:z.string().trim().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/iu)}).strict();
export const publicPhotoBodySchema=trackingBodySchema.extend({photoId:z.string().uuid(),variant:z.enum(['thumbnail','full']).default('thumbnail')}).strict();
export const addResolutionPhotosSchema=z.object({expectedVersion:z.number().int().min(1)}).strict();
export const updatePhotoVisibilitySchema=z.object({expectedVersion:z.number().int().min(1),visibility:z.enum(['INTERNAL','PUBLIC'])}).strict();
export const deletePhotoSchema=z.object({expectedVersion:z.number().int().min(1)}).strict();
export const photoVariantQuerySchema=z.object({variant:z.enum(['thumbnail','full']).default('thumbnail')});
export const occurrenceIdParamsSchema=z.object({id});
export const occurrencePhotoParamsSchema=z.object({id,photoId:z.string().uuid()});
export const adminUserIdParamsSchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/u)});
export const entityIdParamsSchema=z.object({id});
export const areaParamsSchema=z.object({campusId:id,areaId:id});
export const environmentParamsSchema=z.object({campusId:id,areaId:id,roomId:id});

export const updateOccurrenceSchema=z.object({
 expectedVersion:z.number().int().min(1),status:z.enum(OCCURRENCE_STATUSES).optional(),priority:z.enum(OCCURRENCE_PRIORITIES).optional(),
 categoryId:id.optional(),categoryChangeReason:z.string().trim().min(10).max(500).optional(),location:locationSelectionSchema.optional(),locationChangeReason:z.string().trim().min(10).max(500).optional(),
 assignedTeamId:id.nullable().optional(),assignedToAdminUserId:id.nullable().optional(),newPublicMessage:z.string().trim().min(1).max(1000).optional(),newInternalNote:z.string().trim().min(1).max(1000).optional(),internalNoteAudience:z.enum(INTERNAL_NOTE_AUDIENCES).optional(),duplicateOfProtocol:z.string().trim().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{4}-\d{6}$/iu).nullable().optional(),
}).strict().superRefine((v,ctx)=>{if(!Object.entries(v).some(([k,x])=>k!=='expectedVersion'&&x!==undefined))ctx.addIssue({code:'custom',message:'Informe ao menos uma alteração.'});if(v.categoryId&& !v.categoryChangeReason)ctx.addIssue({code:'custom',path:['categoryChangeReason'],message:'A justificativa da recategorização é obrigatória.'});if(v.location&&!v.locationChangeReason)ctx.addIssue({code:'custom',path:['locationChangeReason'],message:'A justificativa da correção de local é obrigatória.'});if(v.newInternalNote===undefined&&v.internalNoteAudience!==undefined)ctx.addIssue({code:'custom',path:['internalNoteAudience'],message:'A audiência somente pode ser informada com uma observação interna.'});});

export const configUpdateSchema=z.object({institutionDisplayName:z.string().trim().min(3).max(160).optional(),protocolPrefix:z.string().trim().min(1).max(20).optional(),notificationEmails:z.array(z.string().trim().email().max(254)).max(20).optional(),emailNotificationsEnabled:z.boolean().optional(),autoAssignRisk:z.boolean().optional(),serviceNotice:z.string().trim().max(500).optional()}).strict().refine(v=>Object.values(v).some(x=>x!==undefined),{message:'Informe ao menos uma configuração para atualização.'});

export const occurrenceFilterSchema=z.object({
 protocol:z.string().trim().max(60).optional(),keyword:z.string().trim().max(200).optional(),startDate:z.string().date().optional(),endDate:z.string().date().optional(),closedStartDate:z.string().date().optional(),closedEndDate:z.string().date().optional(),category:id.optional(),areaId:id.optional(),environmentId:id.optional(),
 status:z.union([z.enum(OCCURRENCE_STATUSES),z.literal('TODAS')]).optional(),priority:z.union([z.enum(OCCURRENCE_PRIORITIES),z.literal('TODAS')]).optional(),assignedTeamId:id.optional(),assignedToAdminUserId:id.optional(),immediateRisk:z.enum(['true','false']).optional(),slaStatus:z.enum(['ON_TIME','NEAR_DUE','BREACHED','PAUSED','COMPLETED']).optional(),withoutTeam:booleanQuery.optional(),withoutRouting:booleanQuery.optional(),criticalPriority:booleanQuery.optional(),awaitingAction:booleanQuery.optional(),withoutResponsible:booleanQuery.optional(),withPhoto:booleanQuery.optional(),withoutPhoto:booleanQuery.optional(),reopened:booleanQuery.optional(),dataClassification:z.enum(['REAL','TEST']).optional(),sort:z.enum(['operational','newest','oldest','priority','sla','protocol']).default('operational'),pageSize:pageSize.default(25),cursor:z.string().max(2000).optional(),
});

export const adminUserCreateSchema=z.object({email:z.string().trim().email().max(254),displayName:z.string().trim().min(2).max(160),role:z.enum(ADMIN_ROLES),teamIds:z.array(id).max(50).optional(),active:z.boolean().optional()}).strict();
export const adminUserUpdateSchema=z.object({displayName:z.string().trim().min(2).max(160).optional(),role:z.enum(ADMIN_ROLES).optional(),teamIds:z.array(id).max(50).optional(),active:z.boolean().optional()}).strict().refine(v=>Object.values(v).some(x=>x!==undefined),{message:'Informe ao menos uma alteração.'});
export const legacyAdminResolutionSchema=z.object({action:z.enum(['CONVERT_TO_MANAGER','DEACTIVATE','ACTIVATE_AS_ATTENDANT'])}).strict();
export const deleteLocationQuerySchema=z.object({expectedVersion:z.coerce.number().int().min(1).default(1)});
export const boundedLimitQuerySchema=z.object({limit:z.coerce.number().int().min(1).max(500).default(100)});
export const notificationTestSchema=z.object({recipient:z.string().trim().email().max(254)}).strict();
export const notificationRetrySchema=z.object({limit:z.number().int().min(1).max(100).default(20)}).strict();
export const maintenanceProcessSchema=z.object({limit:z.number().int().min(1).max(50).default(20)}).strict();
export const firestoreEstimateSchema=z.object({limit:z.number().int().min(100).max(10_000).default(5_000)}).strict();
export const infrastructureSettingsSchema=z.object({
 expectedVersion:z.number().int().min(1),r2StorageReferenceBytes:z.number().int().positive(),firestoreStorageReferenceBytes:z.number().int().positive(),artifactRegistryStorageReferenceBytes:z.number().int().positive(),resendDailyReference:z.number().int().positive(),resendMonthlyReference:z.number().int().positive(),warningPercent:z.number().min(1).max(99),alertPercent:z.number().min(1).max(99),criticalPercent:z.number().min(1).max(100),referenceVerifiedAt:z.string().date(),
}).strict().superRefine((value,context)=>{if(!(value.warningPercent<value.alertPercent&&value.alertPercent<value.criticalPercent))context.addIssue({code:'custom',message:'Os limiares devem obedecer Atenção < Alerta < Crítico.'});});

export const categoryCreateSchema=z.object({id:id.optional(),name:z.string().trim().min(2).max(160),description:z.string().trim().min(2).max(500),active:z.boolean().default(true),sortOrder:z.number().int().min(0).max(10000),resolutionBaseBusinessHours:z.number().positive().max(2000)}).strict();
export const categoryUpdateSchema=z.object({expectedVersion:z.number().int().min(1),name:z.string().trim().min(2).max(160).optional(),description:z.string().trim().min(2).max(500).optional(),active:z.boolean().optional(),sortOrder:z.number().int().min(0).max(10000).optional(),resolutionBaseBusinessHours:z.number().positive().max(2000).optional()}).strict().refine(v=>Object.entries(v).some(([k,x])=>k!=='expectedVersion'&&x!==undefined),{message:'Informe ao menos uma alteração.'});
export const areaCreateSchema=z.object({name:z.string().trim().min(2).max(160),sortOrder:z.number().int().min(0).max(10000),expectedVersion:z.number().int().min(1)}).strict();
export const areaUpdateSchema=z.object({name:z.string().trim().min(2).max(160).optional(),active:z.boolean().optional(),sortOrder:z.number().int().min(0).max(10000).optional(),expectedVersion:z.number().int().min(1)}).strict().refine(v=>Object.entries(v).some(([k,x])=>k!=='expectedVersion'&&x!==undefined),{message:'Informe ao menos uma alteração.'});
export const environmentCreateSchema=areaCreateSchema;
export const environmentUpdateSchema=areaUpdateSchema;

export const teamCreateSchema=z.object({name:z.string().trim().min(2).max(160),description:z.string().trim().max(500).optional(),active:z.boolean().optional(),sortOrder:z.number().int().min(0).max(10000),notificationEmail:z.string().trim().email().max(254).optional().nullable(),isInitialIntakeTeam:z.boolean().optional(),memberAdminUserIds:z.array(id).max(100).optional()}).strict();
export const teamUpdateSchema=z.object({name:z.string().trim().min(2).max(160).optional(),description:z.string().trim().max(500).optional(),active:z.boolean().optional(),sortOrder:z.number().int().min(0).max(10000).optional(),notificationEmail:z.string().trim().email().max(254).optional().nullable(),isInitialIntakeTeam:z.boolean().optional(),memberAdminUserIds:z.array(id).max(100).optional()}).strict().refine(v=>Object.values(v).some(x=>x!==undefined),{message:'Informe ao menos uma alteração.'});

const priorityNumberRecord=z.object({Baixa:z.number().positive().max(5000),Normal:z.number().positive().max(5000),Alta:z.number().positive().max(5000),Urgente:z.number().positive().max(5000),Emergencial:z.number().positive().max(5000)}).strict();
export const slaConfigUpdateSchema=z.object({expectedVersion:z.number().int().min(1),policyVersion:z.string().trim().min(1).max(100),firstResponseBusinessHours:priorityNumberRecord,priorityMultipliers:priorityNumberRecord,nearDueThresholdPercent:z.number().min(1).max(100)}).strict();
const daySchedule=z.object({open:z.boolean(),start:hhmm,end:hhmm}).strict().refine(v=>!v.open||v.start<v.end,{message:'O horário inicial deve anteceder o final.'});
const weeklyShape=Object.fromEntries(WEEKDAY_KEYS.map(k=>[k,daySchedule])) as Record<(typeof WEEKDAY_KEYS)[number],typeof daySchedule>;
export const calendarUpdateSchema=z.object({expectedVersion:z.number().int().min(1),timezone:z.literal('America/Sao_Paulo'),weekly:z.object(weeklyShape).strict()}).strict();
export const calendarExceptionSchema=z.object({id:id.optional(),date:z.string().date(),type:z.enum(CALENDAR_EXCEPTION_TYPES),label:z.string().trim().min(2).max(160),closed:z.boolean(),start:hhmm.optional(),end:hhmm.optional()}).strict().superRefine((v,ctx)=>{if(!v.closed&&(!v.start||!v.end))ctx.addIssue({code:'custom',message:'Informe início e fim para exceção aberta.'});if(v.start&&v.end&&v.start>=v.end)ctx.addIssue({code:'custom',message:'O horário inicial deve anteceder o final.'});});

export const analyticsFilterSchema=z.object({startDate:z.string().date().optional(),endDate:z.string().date().optional(),categoryId:id.optional(),areaId:id.optional(),environmentId:id.optional(),priority:z.enum(OCCURRENCE_PRIORITIES).optional(),status:z.enum(OCCURRENCE_STATUSES).optional(),teamId:id.optional(),responsibleId:id.optional()});
export const exportSchema=occurrenceFilterSchema.extend({format:z.enum(['csv','xlsx','pdf'])}).omit({cursor:true,pageSize:true});
export const auditFilterSchema=z.object({actor:z.string().trim().email().optional(),eventType:z.enum(AUDIT_EVENT_TYPES).optional(),occurrenceId:id.optional(),targetType:z.enum(['adminUser','adminSession','security','systemConfig','occurrence','category','location','team','sla','calendar','report','notification','infrastructure','storage']).optional(),targetId:id.optional(),startDate:z.string().date().optional(),endDate:z.string().date().optional(),limit:pageSize.default(25),cursor:z.string().max(2000).optional()});

export type CreateOccurrenceBody=z.infer<typeof createOccurrenceSchema>;export type TrackingBody=z.infer<typeof trackingBodySchema>;export type PublicPhotoBody=z.infer<typeof publicPhotoBodySchema>;export type AddResolutionPhotosBody=z.infer<typeof addResolutionPhotosSchema>;export type UpdatePhotoVisibilityBody=z.infer<typeof updatePhotoVisibilitySchema>;export type DeletePhotoBody=z.infer<typeof deletePhotoSchema>;export type PhotoVariantQuery=z.infer<typeof photoVariantQuerySchema>;export type OccurrenceIdParams=z.infer<typeof occurrenceIdParamsSchema>;export type OccurrencePhotoParams=z.infer<typeof occurrencePhotoParamsSchema>;export type AdminUserIdParams=z.infer<typeof adminUserIdParamsSchema>;export type UpdateOccurrenceBody=z.infer<typeof updateOccurrenceSchema>;export type ConfigUpdateBody=z.infer<typeof configUpdateSchema>;export type OccurrenceFilterQuery=z.infer<typeof occurrenceFilterSchema>;export type AdminUserCreateBody=z.infer<typeof adminUserCreateSchema>;export type AdminUserUpdateBody=z.infer<typeof adminUserUpdateSchema>;export type LegacyAdminResolutionBody=z.infer<typeof legacyAdminResolutionSchema>;export type BoundedLimitQuery=z.infer<typeof boundedLimitQuerySchema>;
