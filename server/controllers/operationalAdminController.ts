import type { RequestHandler } from 'express';
import type { AnalyticsFilters, ExportFormat, ServiceCalendar, ServiceCalendarException, SlaConfiguration, TeamCreateInput, TeamUpdateInput } from '../../src/models/operations';
import type { OccurrenceFilterOptions } from '../../src/models/occurrence';
import type { AuditLogFilters } from '../../src/models/admin';
import { asyncHandler } from '../middleware/asyncHandler';
import type { OperationalAdminService } from '../services/operationalAdminService';
import { HttpError } from '../types/errors';

function actor(request:Parameters<RequestHandler>[0]){if(!request.adminUser)throw new HttpError(401,'UNAUTHENTICATED','Sessão administrativa ausente.');return request.adminUser;}
export interface OperationalAdminController {
  categories: RequestHandler;
  createCategory: RequestHandler;
  updateCategory: RequestHandler;
  locations: RequestHandler;
  addArea: RequestHandler;
  updateArea: RequestHandler;
  deleteArea: RequestHandler;
  addEnvironment: RequestHandler;
  updateEnvironment: RequestHandler;
  deleteEnvironment: RequestHandler;
  teams: RequestHandler;
  createTeam: RequestHandler;
  updateTeam: RequestHandler;
  slaSettings: RequestHandler;
  updateSla: RequestHandler;
  updateCalendar: RequestHandler;
  upsertException: RequestHandler;
  deleteException: RequestHandler;
  analytics: RequestHandler;
  auditLogs: RequestHandler;
  export: RequestHandler;
  purgeTest: RequestHandler;
}

export function createOperationalAdminController(service:OperationalAdminService):OperationalAdminController{return{
 categories:asyncHandler(async(_r,res)=>res.json(await service.listCategories())),
 createCategory:asyncHandler(async(r,res)=>res.status(201).json(await service.createCategory(r.body as Parameters<typeof service.createCategory>[0],actor(r),r.correlationId))),
 updateCategory:asyncHandler(async(r,res)=>res.json(await service.updateCategory(r.params.id!,r.body as Parameters<typeof service.updateCategory>[1],actor(r),r.correlationId))),
 locations:asyncHandler(async(_r,res)=>res.json(await service.listLocations())),
 addArea:asyncHandler(async(r,res)=>res.status(201).json(await service.addArea(r.params.campusId!,r.body as Parameters<typeof service.addArea>[1],actor(r),r.correlationId))),
 updateArea:asyncHandler(async(r,res)=>res.json(await service.updateArea(r.params.campusId!,r.params.areaId!,r.body as Parameters<typeof service.updateArea>[2],actor(r),r.correlationId))),
 deleteArea:asyncHandler(async(r,res)=>{const expectedVersion=Number(r.query.expectedVersion??1);res.json(await service.deleteArea(r.params.campusId!,r.params.areaId!,expectedVersion,actor(r),r.correlationId));}),
 addEnvironment:asyncHandler(async(r,res)=>res.status(201).json(await service.addEnvironment(r.params.campusId!,r.params.areaId!,r.body as Parameters<typeof service.addEnvironment>[2],actor(r),r.correlationId))),
 updateEnvironment:asyncHandler(async(r,res)=>res.json(await service.updateEnvironment(r.params.campusId!,r.params.areaId!,r.params.roomId!,r.body as Parameters<typeof service.updateEnvironment>[3],actor(r),r.correlationId))),
 deleteEnvironment:asyncHandler(async(r,res)=>{const expectedVersion=Number(r.query.expectedVersion??1);res.json(await service.deleteEnvironment(r.params.campusId!,r.params.areaId!,r.params.roomId!,expectedVersion,actor(r),r.correlationId));}),
 teams:asyncHandler(async(_r,res)=>res.json(await service.listTeams(true))),
 createTeam:asyncHandler(async(r,res)=>res.status(201).json(await service.createTeam(r.body as TeamCreateInput,actor(r),r.correlationId))),
 updateTeam:asyncHandler(async(r,res)=>res.json(await service.updateTeam(r.params.id!,r.body as TeamUpdateInput,actor(r),r.correlationId))),
 slaSettings:asyncHandler(async(_r,res)=>res.json(await service.getSlaSettings())),
 updateSla:asyncHandler(async(r,res)=>{const body=r.body as SlaConfiguration&{expectedVersion:number};const input={...body};delete (input as Partial<typeof body>).expectedVersion;res.json(await service.updateSlaConfig(input as SlaConfiguration,body.expectedVersion,actor(r),r.correlationId));}),
 updateCalendar:asyncHandler(async(r,res)=>{const body=r.body as {expectedVersion:number;timezone:'America/Sao_Paulo';weekly:ServiceCalendar['weekly']};const current=(await service.getSlaSettings()).calendar;res.json(await service.updateCalendar({...current,timezone:body.timezone,weekly:body.weekly},body.expectedVersion,actor(r),r.correlationId));}),
 upsertException:asyncHandler(async(r,res)=>{const body=r.body as Omit<ServiceCalendarException,'schemaVersion'|'createdAt'|'createdBy'|'updatedAt'|'updatedBy'> & {id?:string};const exception={schemaVersion:1 as const,id:r.params.id??body.id??`exc-${body.date}-${body.type.toLowerCase()}`,date:body.date,type:body.type,label:body.label,closed:body.closed,...(body.start?{start:body.start}:{}),...(body.end?{end:body.end}:{})};res.status(201).json(await service.upsertCalendarException(exception,actor(r),r.correlationId));}),
 deleteException:asyncHandler(async(r,res)=>{await service.deleteCalendarException(r.params.id!,actor(r),r.correlationId);res.status(204).send();}),
 analytics:asyncHandler(async(r,res)=>res.json(await service.analytics(r.query as AnalyticsFilters,actor(r)))),
 auditLogs:asyncHandler(async(r,res)=>res.json(await service.auditLogs(r.query as AuditLogFilters,actor(r)))),
 export:asyncHandler(async(r,res)=>{const q=r.query as unknown as OccurrenceFilterOptions&{format:ExportFormat};const {format,...filters}=q;const out=await service.exportOccurrences(format,filters,actor(r),r.correlationId);res.setHeader('Content-Type',out.contentType);res.setHeader('Content-Disposition',`attachment; filename="${out.fileName}"`);res.setHeader('X-Exported-Count',String(out.count));res.setHeader('Cache-Control','private, no-store');res.status(200).send(out.buffer);}),
 purgeTest:asyncHandler(async(r,res)=>{await service.purgeTestOccurrence(r.params.id!,actor(r),r.correlationId);res.status(204).send();}),
};}
