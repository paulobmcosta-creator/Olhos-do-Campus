import { z } from 'zod';
import type { AuditLogFilters, AuditLogPage } from '../models/admin';
import type { CategoryItem, CampusLocation } from '../models/config';
import type { AnalyticsFilters, AnalyticsStats, ExportFormat, OperationalTeam, ServiceCalendar, ServiceCalendarException, SlaConfiguration, TeamCreateInput, TeamUpdateInput } from '../models/operations';
import type { OccurrenceFilterOptions } from '../models/occurrence';
import { analyticsResponseSchema, auditLogPageResponseSchema, calendarResponseSchema, categoriesResponseSchema, exceptionResponseSchema, locationsResponseSchema, slaConfigurationSchema, slaSettingsResponseSchema, teamsResponseSchema } from '../validators/responses';
import { requestFile, requestJson } from './apiClient';

function query(input:object):string{const q=new URLSearchParams();for(const [k,v] of Object.entries(input)){if(v!==undefined&&v!==''&&v!==false)q.set(k,String(v));}return q.toString();}
const zVoid=z.undefined();
export const operationsService={
 listCategories:():Promise<CategoryItem[]>=>requestJson('/api/admin/categories',categoriesResponseSchema,{authentication:'admin'}),
 createCategory:(input:Omit<CategoryItem,'id'|'version'>&{id?:string}):Promise<CategoryItem>=>requestJson('/api/admin/categories',categoriesResponseSchema.element,{method:'POST',authentication:'admin',body:JSON.stringify(input)}),
 updateCategory:(id:string,input:Partial<Omit<CategoryItem,'id'|'version'>> & {expectedVersion:number}):Promise<CategoryItem>=>requestJson(`/api/admin/categories/${encodeURIComponent(id)}`,categoriesResponseSchema.element,{method:'PATCH',authentication:'admin',body:JSON.stringify(input)}),
 listLocations:():Promise<CampusLocation[]>=>requestJson('/api/admin/locations',locationsResponseSchema,{authentication:'admin'}),

 addArea:(campusId:string,input:{name:string;sortOrder:number;expectedVersion:number}):Promise<CampusLocation>=>requestJson(`/api/admin/locations/${encodeURIComponent(campusId)}/areas`,locationsResponseSchema.element,{method:'POST',authentication:'admin',body:JSON.stringify(input)}),
 updateArea:(campusId:string,areaId:string,input:{name?:string;active?:boolean;sortOrder?:number;expectedVersion:number}):Promise<CampusLocation>=>requestJson(`/api/admin/locations/${encodeURIComponent(campusId)}/areas/${encodeURIComponent(areaId)}`,locationsResponseSchema.element,{method:'PATCH',authentication:'admin',body:JSON.stringify(input)}),
 deleteArea:(campusId:string,areaId:string,expectedVersion:number):Promise<CampusLocation>=>requestJson(`/api/admin/locations/${encodeURIComponent(campusId)}/areas/${encodeURIComponent(areaId)}?expectedVersion=${expectedVersion}`,locationsResponseSchema.element,{method:'DELETE',authentication:'admin'}),
 addEnvironment:(campusId:string,areaId:string,input:{name:string;sortOrder:number;expectedVersion:number}):Promise<CampusLocation>=>requestJson(`/api/admin/locations/${encodeURIComponent(campusId)}/areas/${encodeURIComponent(areaId)}/environments`,locationsResponseSchema.element,{method:'POST',authentication:'admin',body:JSON.stringify(input)}),
 updateEnvironment:(campusId:string,areaId:string,roomId:string,input:{name?:string;active?:boolean;sortOrder?:number;expectedVersion:number}):Promise<CampusLocation>=>requestJson(`/api/admin/locations/${encodeURIComponent(campusId)}/areas/${encodeURIComponent(areaId)}/environments/${encodeURIComponent(roomId)}`,locationsResponseSchema.element,{method:'PATCH',authentication:'admin',body:JSON.stringify(input)}),
 deleteEnvironment:(campusId:string,areaId:string,roomId:string,expectedVersion:number):Promise<CampusLocation>=>requestJson(`/api/admin/locations/${encodeURIComponent(campusId)}/areas/${encodeURIComponent(areaId)}/environments/${encodeURIComponent(roomId)}?expectedVersion=${expectedVersion}`,locationsResponseSchema.element,{method:'DELETE',authentication:'admin'}),
 listTeams:():Promise<OperationalTeam[]>=>requestJson('/api/admin/teams',teamsResponseSchema,{authentication:'admin'}),
 createTeam:(input:TeamCreateInput):Promise<OperationalTeam>=>requestJson('/api/admin/teams',teamsResponseSchema.element,{method:'POST',authentication:'admin',body:JSON.stringify(input)}),
 updateTeam:(id:string,input:TeamUpdateInput):Promise<OperationalTeam>=>requestJson(`/api/admin/teams/${encodeURIComponent(id)}`,teamsResponseSchema.element,{method:'PATCH',authentication:'admin',body:JSON.stringify(input)}),
 getSlaSettings:()=>requestJson('/api/admin/sla-config',slaSettingsResponseSchema,{authentication:'admin'}),
 updateSla:(input:SlaConfiguration):Promise<SlaConfiguration>=>requestJson('/api/admin/sla-config',slaConfigurationSchema,{method:'PUT',authentication:'admin',body:JSON.stringify({expectedVersion:input.version,policyVersion:input.policyVersion,firstResponseBusinessHours:input.firstResponseBusinessHours,priorityMultipliers:input.priorityMultipliers,nearDueThresholdPercent:input.nearDueThresholdPercent})}),
 updateCalendar:(input:ServiceCalendar):Promise<ServiceCalendar>=>requestJson('/api/admin/service-calendar',calendarResponseSchema,{method:'PUT',authentication:'admin',body:JSON.stringify({expectedVersion:input.version,timezone:input.timezone,weekly:input.weekly})}),
 deleteException:(id:string):Promise<void>=>requestJson(`/api/admin/calendar-exceptions/${encodeURIComponent(id)}`,zVoid,{method:'DELETE',authentication:'admin'}),
 upsertException:(input:Omit<ServiceCalendarException,'createdAt'|'createdBy'|'updatedAt'|'updatedBy'|'schemaVersion'>):Promise<ServiceCalendarException>=>requestJson('/api/admin/calendar-exceptions',exceptionResponseSchema,{method:'POST',authentication:'admin',body:JSON.stringify(input)}),
 analytics:(filters:AnalyticsFilters):Promise<AnalyticsStats>=>requestJson(`/api/admin/analytics?${query(filters)}`,analyticsResponseSchema,{authentication:'admin'}),
 audit:(filters:AuditLogFilters):Promise<AuditLogPage>=>requestJson(`/api/admin/audit-logs?${query(filters)}`,auditLogPageResponseSchema,{authentication:'admin'}),
 exportOccurrences:(format:ExportFormat,filters:OccurrenceFilterOptions)=>requestFile(`/api/admin/exports/occurrences?${query({...filters,format})}`,{authentication:'admin'}),
 purgeTest:(id:string):Promise<void>=>requestJson(`/api/admin/occurrences/${encodeURIComponent(id)}/test-data`,zVoid,{method:'DELETE',authentication:'admin'}),
};
