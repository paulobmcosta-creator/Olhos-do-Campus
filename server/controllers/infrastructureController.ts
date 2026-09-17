import type { RequestHandler } from 'express';
import type { InfrastructureCapacitySettings } from '../../src/models/infrastructure';
import { asyncHandler } from '../middleware/asyncHandler';
import type { InfrastructureService } from '../services/infrastructureService';
import { HttpError } from '../types/errors';

function actor(request:Parameters<RequestHandler>[0]){if(request.adminUser===undefined)throw new HttpError(401,'UNAUTHENTICATED','Sessão administrativa ausente.');return request.adminUser;}
function bodyField(request: Parameters<RequestHandler>[0], key: string): unknown {
  const body: unknown = request.body;
  return typeof body === 'object' && body !== null && key in body
    ? (body as Record<string, unknown>)[key]
    : undefined;
}
export function createInfrastructureController(service:InfrastructureService):{overview:RequestHandler;history:RequestHandler;settings:RequestHandler;snapshot:RequestHandler;estimateFirestore:RequestHandler;reconcile:RequestHandler;cleanup:RequestHandler;maintenanceSnapshot:RequestHandler;maintenanceCleanup:RequestHandler}{return{
  overview:asyncHandler(async(_request,response)=>response.json(await service.overview())),
  history:asyncHandler(async(_request,response)=>response.json((await service.overview()).history)),
  settings:asyncHandler(async(request,response)=>{const body=request.body as Omit<InfrastructureCapacitySettings,'schemaVersion'|'version'|'updatedAt'|'updatedBy'>&{expectedVersion:number};const{expectedVersion,...input}=body;response.json(await service.updateSettings(input,expectedVersion,actor(request),request.correlationId));}),
  snapshot:asyncHandler(async(request,response)=>response.status(201).json(await service.requestSnapshot(actor(request),request.correlationId))),
  estimateFirestore:asyncHandler(async(request,response)=>response.status(201).json(await service.requestFirestoreEstimate(Number(bodyField(request,'limit')),actor(request),request.correlationId))),
  reconcile:asyncHandler(async(request,response)=>response.json(await service.requestReconciliation(actor(request),request.correlationId))),
  cleanup:asyncHandler(async(request,response)=>response.json(await service.processCleanup(Number(bodyField(request,'limit')),actor(request),request.correlationId))),
  maintenanceSnapshot:asyncHandler(async(_request,response)=>{const cleanup=await service.processCleanup(20);const snapshot=await service.captureSnapshot('MAINTENANCE_WORKER');response.status(201).json({snapshot,cleanup});}),
  maintenanceCleanup:asyncHandler(async(request,response)=>response.json(await service.processCleanup(Number(bodyField(request,'limit')??20)))),
};}
