import { Router } from 'express';
import type { RequestHandler } from 'express';
import { APP_VERSION } from '../../src/config/version';
import { createAdminUserController } from '../controllers/adminUserController';
import { adminSessionController } from '../controllers/authController';
import { createConfigController } from '../controllers/configController';
import { createOccurrenceController } from '../controllers/occurrenceController';
import { createOperationalAdminController } from '../controllers/operationalAdminController';
import { apiNotFound } from '../middleware/errorHandler';
import { parsePhotoMultipart } from '../middleware/multipartPhotos';
import { requireAnonymousUser } from '../middleware/requireAnonymousUser';
import { requireAppCheck } from '../middleware/requireAppCheck';
import { requireAuthorizedAdmin } from '../middleware/requireAuthorizedAdmin';
import { requireFirebaseUser } from '../middleware/requireFirebaseUser';
import { requireRole } from '../middleware/requireRole';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import type { AdminAuthorizationService } from '../services/adminAuthorizationService';
import type { AdminUserService } from '../services/adminUserService';
import type { ConfigService } from '../services/configService';
import type { OccurrenceService } from '../services/occurrenceService';
import type { OperationalAdminService } from '../services/operationalAdminService';
import type { AppCheckVerifier, FirebaseTokenVerifier } from '../types/firebase';
import {
  addResolutionPhotosSchema, adminUserCreateSchema, adminUserIdParamsSchema, adminUserUpdateSchema, analyticsFilterSchema,
  areaCreateSchema, areaParamsSchema, areaUpdateSchema, auditFilterSchema, boundedLimitQuerySchema, calendarExceptionSchema,
  calendarUpdateSchema, categoryCreateSchema, categoryUpdateSchema, configUpdateSchema, createOccurrenceSchema, deletePhotoSchema,
  entityIdParamsSchema, environmentCreateSchema, environmentParamsSchema, environmentUpdateSchema, exportSchema, legacyAdminResolutionSchema,
  occurrenceFilterSchema, occurrenceIdParamsSchema, occurrencePhotoParamsSchema, photoVariantQuerySchema, publicPhotoBodySchema,
  slaConfigUpdateSchema, teamCreateSchema, teamUpdateSchema, trackingBodySchema, updateOccurrenceSchema, updatePhotoVisibilitySchema,
} from '../validators/schemas';

export interface ApiRouteServices {tokenVerifier:FirebaseTokenVerifier;appCheckVerifier:AppCheckVerifier;appCheckEnforced:boolean;authorization:AdminAuthorizationService;adminUsers:AdminUserService;config:ConfigService;occurrence:OccurrenceService;operations:OperationalAdminService;}

export function createApiRouter(services:ApiRouteServices):Router{
 const router=Router();const config=createConfigController(services.config);const occurrences=createOccurrenceController(services.occurrence);const adminUsers=createAdminUserController(services.adminUsers);const operations=createOperationalAdminController(services.operations);
 const appCheck=requireAppCheck(services.appCheckVerifier,services.appCheckEnforced);const firebaseUser=requireFirebaseUser(services.tokenVerifier);const authorizedAdmin=requireAuthorizedAdmin(services.authorization);const authorizedSession=requireAuthorizedAdmin(services.authorization,true);const adminStack=[appCheck,firebaseUser,authorizedAdmin] as const;const systemAdmin=requireRole('Administrador');
 router.get('/health',(_r,res)=>res.json({status:'ok',version:APP_VERSION,timestamp:new Date().toISOString()}));
 router.get('/config',appCheck,config.getBootstrap);router.get('/admin/config',...adminStack,systemAdmin,config.getOperational);router.put('/config',...adminStack,systemAdmin,validateBody(configUpdateSchema),config.update);
 router.get('/auth/admin-session',appCheck,firebaseUser,authorizedSession,adminSessionController);
 router.post('/occurrences',appCheck,firebaseUser,requireAnonymousUser,parsePhotoMultipart(3),validateBody(createOccurrenceSchema),occurrences.create);router.post('/occurrences/track',appCheck,firebaseUser,requireAnonymousUser,validateBody(trackingBodySchema),occurrences.track);router.post('/occurrences/track/photo',appCheck,firebaseUser,requireAnonymousUser,validateBody(publicPhotoBodySchema),occurrences.publicPhoto);
 router.get('/admin/occurrences',...adminStack,validateQuery(occurrenceFilterSchema),occurrences.list as unknown as RequestHandler);router.get('/admin/occurrences/:id',...adminStack,validateParams(occurrenceIdParamsSchema),occurrences.getById);router.patch('/admin/occurrences/:id',...adminStack,validateParams(occurrenceIdParamsSchema),validateBody(updateOccurrenceSchema),occurrences.update);
 router.get('/admin/occurrences/:id/photos/:photoId',...adminStack,validateParams(occurrencePhotoParamsSchema),validateQuery(photoVariantQuerySchema),occurrences.getAdminPhoto);router.post('/admin/occurrences/:id/photos',...adminStack,validateParams(occurrenceIdParamsSchema),parsePhotoMultipart(3),validateBody(addResolutionPhotosSchema),occurrences.addResolutionPhotos);router.patch('/admin/occurrences/:id/photos/:photoId/visibility',...adminStack,validateParams(occurrencePhotoParamsSchema),validateBody(updatePhotoVisibilitySchema),occurrences.updatePhotoVisibility);router.delete('/admin/occurrences/:id/photos/:photoId',...adminStack,validateParams(occurrencePhotoParamsSchema),validateBody(deletePhotoSchema),occurrences.deletePhoto);
 router.get('/admin/stats',...adminStack,occurrences.stats);router.get('/admin/dashboard',...adminStack,occurrences.stats);router.get('/admin/analytics',...adminStack,validateQuery(analyticsFilterSchema),operations.analytics);router.get('/admin/exports/occurrences',...adminStack,validateQuery(exportSchema),operations.export);
 router.get('/admin/assignees',...adminStack,adminUsers.assignees);router.get('/admin/users',...adminStack,systemAdmin,validateQuery(boundedLimitQuerySchema),adminUsers.list as unknown as RequestHandler);router.post('/admin/users',...adminStack,systemAdmin,validateBody(adminUserCreateSchema),adminUsers.create as unknown as RequestHandler);router.patch('/admin/users/:id',...adminStack,systemAdmin,validateParams(adminUserIdParamsSchema),validateBody(adminUserUpdateSchema),adminUsers.update as unknown as RequestHandler);router.post('/admin/users/:id/resolve-legacy-role',...adminStack,systemAdmin,validateParams(adminUserIdParamsSchema),validateBody(legacyAdminResolutionSchema),adminUsers.resolveLegacy as unknown as RequestHandler);
 router.get('/admin/categories',...adminStack,operations.categories);router.post('/admin/categories',...adminStack,systemAdmin,validateBody(categoryCreateSchema),operations.createCategory);router.patch('/admin/categories/:id',...adminStack,systemAdmin,validateParams(entityIdParamsSchema),validateBody(categoryUpdateSchema),operations.updateCategory);
 router.get('/admin/locations',...adminStack,operations.locations);router.post('/admin/locations/:campusId/areas',...adminStack,systemAdmin,validateBody(areaCreateSchema),operations.addArea);router.patch('/admin/locations/:campusId/areas/:areaId',...adminStack,systemAdmin,validateParams(areaParamsSchema),validateBody(areaUpdateSchema),operations.updateArea);router.post('/admin/locations/:campusId/areas/:areaId/environments',...adminStack,systemAdmin,validateParams(areaParamsSchema),validateBody(environmentCreateSchema),operations.addEnvironment);router.patch('/admin/locations/:campusId/areas/:areaId/environments/:roomId',...adminStack,systemAdmin,validateParams(environmentParamsSchema),validateBody(environmentUpdateSchema),operations.updateEnvironment);
 router.get('/admin/teams',...adminStack,operations.teams);router.post('/admin/teams',...adminStack,systemAdmin,validateBody(teamCreateSchema),operations.createTeam);router.patch('/admin/teams/:id',...adminStack,systemAdmin,validateParams(entityIdParamsSchema),validateBody(teamUpdateSchema),operations.updateTeam);
 router.get('/admin/sla-config',...adminStack,systemAdmin,operations.slaSettings);router.put('/admin/sla-config',...adminStack,systemAdmin,validateBody(slaConfigUpdateSchema),operations.updateSla);router.put('/admin/service-calendar',...adminStack,systemAdmin,validateBody(calendarUpdateSchema),operations.updateCalendar);router.post('/admin/calendar-exceptions',...adminStack,systemAdmin,validateBody(calendarExceptionSchema),operations.upsertException);router.patch('/admin/calendar-exceptions/:id',...adminStack,systemAdmin,validateParams(entityIdParamsSchema),validateBody(calendarExceptionSchema),operations.upsertException);router.delete('/admin/calendar-exceptions/:id',...adminStack,systemAdmin,validateParams(entityIdParamsSchema),operations.deleteException);
 router.get('/admin/audit-logs',...adminStack,systemAdmin,validateQuery(auditFilterSchema),operations.auditLogs);router.delete('/admin/occurrences/:id/test-data',...adminStack,systemAdmin,validateParams(occurrenceIdParamsSchema),operations.purgeTest);
 router.use(apiNotFound);return router;
}
