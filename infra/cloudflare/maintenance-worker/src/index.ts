import { endpointsForCron, runMaintenance } from './maintenance';
import type { MaintenanceEnvironment } from './maintenance';

export default {
  scheduled(controller:ScheduledController,environment:MaintenanceEnvironment,context:ExecutionContext):void{context.waitUntil(runMaintenance(environment,endpointsForCron(controller.cron)));},
  fetch():Response{return Response.json({status:'ok',component:'maintenance-worker',version:'1.0.1'});},
} satisfies ExportedHandler<MaintenanceEnvironment>;
