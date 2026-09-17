// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import type { InfrastructureCapacitySettings, InfrastructureSnapshot } from '../src/models/infrastructure';
import type { PhotoObjectInfo, PhotoObjectMetadata, PhotoObjectPage, PhotoRepository } from '../server/repositories/photoRepository';
import { FallbackPhotoRepository } from '../server/repositories/fallbackPhotoRepository';
import { DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS, type ArtifactRegistryObservation, type InfrastructureRepository, type ReconciliationObservation } from '../server/repositories/infrastructureRepository';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { InMemoryNotificationOutboxRepository } from '../server/repositories/notificationOutboxRepository';
import { R2PhotoRepository } from '../server/repositories/r2PhotoRepository';
import { ImageProcessingService } from '../server/services/imageProcessingService';
import { InfrastructureService } from '../server/services/infrastructureService';
import { PhotoService } from '../server/services/photoService';
import type { NotificationService } from '../server/services/notificationService';
import { InMemoryPhotoMetadataRepository, InMemoryStorageCleanupTaskRepository } from './helpers/fakePhotoInfrastructure';
import sharp from 'sharp';

interface StoredObject { bytes:Buffer;contentType:string;metadata:Record<string,string>;updated:Date; }
function inputString(value: unknown): string { return typeof value === 'string' ? value : ''; }
class FakeS3 {
  public readonly objects=new Map<string,StoredObject>();public failCommand:string|undefined;
  public async send(command:unknown):Promise<Record<string,unknown>>{await Promise.resolve();const name=command?.constructor.name??'';if(this.failCommand===name)throw new Error('provider-failure');const input=(command as {input?:Record<string,unknown>}).input??{};const key=inputString(input.Key);
    if(name==='PutObjectCommand'){this.objects.set(key,{bytes:Buffer.from(input.Body as Uint8Array),contentType:String(input.ContentType),metadata:input.Metadata as Record<string,string>,updated:new Date()});return{};}
    if(name==='GetObjectCommand'){const value=this.objects.get(key);if(value===undefined)throw Object.assign(new Error('missing'),{name:'NoSuchKey',$metadata:{httpStatusCode:404}});return{Body:{transformToByteArray:()=>Promise.resolve(Uint8Array.from(value.bytes))}};}
    if(name==='HeadObjectCommand'){const value=this.objects.get(key);if(value===undefined)throw Object.assign(new Error('missing'),{name:'NotFound',$metadata:{httpStatusCode:404}});return{ContentType:value.contentType,ContentLength:value.bytes.length,ETag:'"etag"',LastModified:value.updated,Metadata:value.metadata};}
    if(name==='DeleteObjectCommand'){this.objects.delete(key);return{};}
    if(name==='ListObjectsV2Command'){const prefix=inputString(input.Prefix);return{Contents:[...this.objects.entries()].filter(([path])=>path.startsWith(prefix)).map(([path,value])=>({Key:path,Size:value.bytes.length,ETag:'"etag"',LastModified:value.updated})),IsTruncated:false};}
    throw new Error(`unexpected-${name}`);
  }
  public put(path:string,bytes:Buffer,updated:Date):void{this.objects.set(path,{bytes,contentType:'image/webp',metadata:{},updated});}
}
function r2(fake:FakeS3):R2PhotoRepository{return new R2PhotoRepository({accountId:'account',accessKeyId:'access',secretAccessKey:'secret',bucketName:'bucket',client:fake as unknown as S3Client});}
const path='occurrences/occ-1/initial/photo-1.webp';
const metadata:PhotoObjectMetadata={occurrenceId:'occ-1',photoId:'photo-1',kind:'INITIAL'};

class MemoryPhotoRepository implements PhotoRepository {
  private readonly values=new Map<string,Buffer>();public readonly deleted:string[]=[];
  public constructor(public readonly provider:'r2'|'firebase-storage'){}
  public save(path:string,buffer:Buffer,_metadata:PhotoObjectMetadata):Promise<void>{void _metadata;this.values.set(path,Buffer.from(buffer));return Promise.resolve();}
  public read(path:string):Promise<Buffer|undefined>{const value=this.values.get(path);return Promise.resolve(value===undefined?undefined:Buffer.from(value));}
  public delete(path:string):Promise<void>{this.values.delete(path);this.deleted.push(path);return Promise.resolve();}
  public getMetadata(path:string):Promise<PhotoObjectInfo|undefined>{const value=this.values.get(path);return Promise.resolve(value===undefined?undefined:{path,size:value.length});}
  public listPage(prefix:string,_cursor?:string,_limit?:number):Promise<PhotoObjectPage>{void _cursor;void _limit;return Promise.resolve({items:[...this.values.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({path:key,size:value.length}))});}
}

class MemoryInfrastructureRepository implements InfrastructureRepository {
  public snapshots:InfrastructureSnapshot[]=[];public reconciliation:ReconciliationObservation|undefined;
  public getSettings():Promise<InfrastructureCapacitySettings>{return Promise.resolve(structuredClone(DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS));}
  public updateSettings():Promise<InfrastructureCapacitySettings>{return this.getSettings();}
  public saveSnapshot(snapshot:InfrastructureSnapshot):Promise<void>{this.snapshots.unshift(structuredClone(snapshot));return Promise.resolve();}
  public history(limit=365):Promise<InfrastructureSnapshot[]>{return Promise.resolve(this.snapshots.slice(0,limit));}
  public latest():Promise<InfrastructureSnapshot|null>{return Promise.resolve(this.snapshots[0]??null);}
  public latestArtifactObservation():Promise<ArtifactRegistryObservation|undefined>{return Promise.resolve(undefined);}
  public saveReconciliationObservation(value:ReconciliationObservation):Promise<void>{this.reconciliation=structuredClone(value);return Promise.resolve();}
  public latestReconciliationObservation():Promise<ReconciliationObservation|undefined>{return Promise.resolve(this.reconciliation);}
  public collectionCounts():Promise<Record<string,number>>{return Promise.resolve({occurrences:1});}
  public estimateFirestoreLogicalBytes():Promise<{estimatedLogicalBytes:number|null;estimationMethod:string;documentsSampled:number;coveragePercent:number|null}>{return Promise.resolve({estimatedLogicalBytes:null,estimationMethod:'Não medido',documentsSampled:0,coveragePercent:null});}
  public cleanupTechnicalSnapshots():Promise<number>{return Promise.resolve(0);}
}

describe('Cloudflare R2 e reconciliação 0.7.0',()=>{
  it('valida path, faz upload/read/metadata e delete idempotente',async()=>{const fake=new FakeS3(),repository=r2(fake),bytes=Buffer.from('webp');await repository.save(path,bytes,metadata);expect(await repository.read(path)).toEqual(bytes);expect(await repository.getMetadata(path)).toMatchObject({path,size:4,contentType:'image/webp',etag:'etag'});await repository.delete(path);await repository.delete(path);expect(await repository.read(path)).toBeUndefined();for(const invalid of ['../x.webp','/occurrences/a/initial/x.webp','occurrences/a/../../x.webp'])await expect(repository.save(invalid,bytes,metadata)).rejects.toThrow('PHOTO_STORAGE_PATH_INVALID');});

  it('propaga erro seguro do provider e trata objeto inexistente',async()=>{const fake=new FakeS3(),repository=r2(fake);expect(await repository.getMetadata(path)).toBeUndefined();fake.failCommand='PutObjectCommand';await expect(repository.save(path,Buffer.from('x'),metadata)).rejects.toThrow('provider-failure');});

  it('faz fallback legado somente na leitura e mantém gravação no R2',async()=>{const primary=new MemoryPhotoRepository('r2'),legacy=new MemoryPhotoRepository('firebase-storage');let fallbacks=0;await legacy.save(path,Buffer.from('legacy'),metadata);const repository=new FallbackPhotoRepository(primary,legacy,()=>{fallbacks+=1;});expect(await repository.read(path)).toEqual(Buffer.from('legacy'));expect(fallbacks).toBe(1);await repository.save(path,Buffer.from('new'),metadata);expect(await primary.read(path)).toEqual(Buffer.from('new'));});

  it('compensa upload parcial sem criar cleanup task quando a exclusão funciona',async()=>{const fake=new FakeS3(),base=r2(fake);let saves=0;const failing:PhotoRepository={provider:'r2',save:async(p,b,m)=>{saves+=1;if(saves===2)throw new Error('provider-failure');await base.save(p,b,m);},read:p=>base.read(p),delete:p=>base.delete(p),getMetadata:p=>base.getMetadata(p),listPage:(p,c,l)=>base.listPage(p,c,l)};const cleanup=new InMemoryStorageCleanupTaskRepository();const photos=new PhotoService(failing,new InMemoryPhotoMetadataRepository(),cleanup,new ImageProcessingService());const source=await sharp({create:{width:80,height:60,channels:3,background:'#fff'}}).jpeg().toBuffer();await expect(photos.prepareAndUpload('occ-partial','INITIAL',[{buffer:source,declaredMimeType:'image/jpeg'}],{type:'PUBLIC'},'corr')).rejects.toMatchObject({code:'PHOTO_STORAGE_FAILED'});expect(fake.objects.size).toBe(0);expect(await cleanup.listPending()).toHaveLength(0);});

  it('reconcilia metadados, detecta órfão/missing/size e protege exclusão recente',async()=>{const fake=new FakeS3(),objects=r2(fake),photoMetadata=new InMemoryPhotoMetadataRepository(),cleanup=new InMemoryStorageCleanupTaskRepository(),infra=new MemoryInfrastructureRepository();const old=new Date(Date.now()-10*86_400_000),recent=new Date();fake.put(path,Buffer.from('12345'),old);fake.put('occurrences/occ-2/resolution/orphan.webp',Buffer.from('orphan'),old);fake.put('occurrences/occ-3/resolution/recent.webp',Buffer.from('recent'),recent);photoMetadata.create('occ-1',[{id:'photo-1',schemaVersion:1,kind:'INITIAL',visibility:'INTERNAL',status:'READY',storagePath:path,thumbnailStoragePath:'occurrences/occ-1/initial-thumbnails/photo-1.webp',contentType:'image/webp',width:1,height:1,byteSize:4,thumbnailByteSize:2,sha256:'hash',createdAt:old,createdByType:'PUBLIC'}]);const service=new InfrastructureService(infra,objects,photoMetadata,cleanup,new InMemoryNotificationOutboxRepository(),{} as NotificationService,new InMemoryAuditLogRepository());const dry=await service.reconcile(false);expect(dry).toMatchObject({dryRun:true,inventoryComplete:true,deletedOrphans:0});expect(dry.missingObjects).toContain('occurrences/occ-1/initial-thumbnails/photo-1.webp');expect(dry.orphanObjects).toContain('occurrences/occ-2/resolution/orphan.webp');expect(dry.sizeMismatches).toContain(path);const applied=await service.reconcile(true,7);expect(applied.deletedOrphans).toBe(1);expect(fake.objects.has('occurrences/occ-2/resolution/orphan.webp')).toBe(false);expect(fake.objects.has('occurrences/occ-3/resolution/recent.webp')).toBe(true);});
});
