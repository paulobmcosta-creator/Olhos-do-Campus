import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { OperationalTeam, TeamCreateInput, TeamUpdateInput } from '../../src/models/operations';

function iso(value:unknown):string{if(value instanceof Timestamp)return value.toDate().toISOString();if(value instanceof Date)return value.toISOString();if(typeof value==='string')return value;return new Date(0).toISOString();}
function fromSnapshot(s:DocumentSnapshot):OperationalTeam{
  const d=s.data()??{};
  return{
    id:s.id,
    schemaVersion:2,
    name:String(d.name??''),
    ...(typeof d.description==='string'&&d.description!==''?{description:d.description}:{}),
    active:d.active===true,
    sortOrder:Number(d.sortOrder??0),
    ...(typeof d.notificationEmail==='string'&&d.notificationEmail.trim()!==''?{notificationEmail:d.notificationEmail.trim().toLowerCase()}:{}),
    isInitialIntakeTeam:d.isInitialIntakeTeam===true,
    memberAdminUserIds:Array.isArray(d.memberAdminUserIds)?d.memberAdminUserIds.filter((x):x is string=>typeof x==='string'):[],
    createdAt:iso(d.createdAt),
    createdBy:String(d.createdBy??''),
    updatedAt:iso(d.updatedAt),
    updatedBy:String(d.updatedBy??'')
  };
}
export interface OperationalTeamRepository{
  list(includeInactive?:boolean):Promise<OperationalTeam[]>;
  getById(id:string):Promise<OperationalTeam|undefined>;
  getInitialIntakeTeam():Promise<OperationalTeam|undefined>;
  create(id:string,input:TeamCreateInput,actorId:string):Promise<OperationalTeam>;
  update(id:string,input:TeamUpdateInput,actorId:string):Promise<OperationalTeam>;
  seed(items:OperationalTeam[],actorId:string):Promise<void>;
}
export class FirestoreOperationalTeamRepository implements OperationalTeamRepository{
  private readonly collection;public constructor(private readonly firestore:Firestore){this.collection=firestore.collection('operationalTeams');}
  public async list(includeInactive=true):Promise<OperationalTeam[]>{const s=await this.collection.get();return s.docs.map(fromSnapshot).filter(x=>includeInactive||x.active).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name,'pt-BR'));}
  public async getById(id:string):Promise<OperationalTeam|undefined>{const s=await this.collection.doc(id).get();return s.exists?fromSnapshot(s):undefined;}
  public async getInitialIntakeTeam():Promise<OperationalTeam|undefined>{const s=await this.collection.where('isInitialIntakeTeam','==',true).where('active','==',true).limit(1).get();return s.docs[0]?fromSnapshot(s.docs[0]):undefined;}
  public async create(id:string,input:TeamCreateInput,actorId:string):Promise<OperationalTeam>{
    const ref=this.collection.doc(id);const now=new Date().toISOString();
    const notificationEmail=input.notificationEmail?input.notificationEmail.trim().toLowerCase():undefined;
    const isInitialIntakeTeam=input.isInitialIntakeTeam===true;
    const team:OperationalTeam={id,schemaVersion:2,name:input.name,...(input.description?{description:input.description}:{}),active:input.active??true,sortOrder:input.sortOrder,...(notificationEmail?{notificationEmail}:{}),isInitialIntakeTeam,memberAdminUserIds:input.memberAdminUserIds??[],createdAt:now,createdBy:actorId,updatedAt:now,updatedBy:actorId};
    await this.firestore.runTransaction(async tx=>{
      if((await tx.get(ref)).exists)throw new Error('TEAM_EXISTS');
      if(isInitialIntakeTeam){
        const existingInitials=await tx.get(this.collection.where('isInitialIntakeTeam','==',true));
        for(const doc of existingInitials.docs){
          if(doc.id!==id)tx.update(doc.ref,{isInitialIntakeTeam:false,updatedAt:FieldValue.serverTimestamp(),updatedBy:actorId});
        }
      }
      tx.create(ref,{schemaVersion:2,name:team.name,...(team.description?{description:team.description}:{}),active:team.active,sortOrder:team.sortOrder,...(team.notificationEmail?{notificationEmail:team.notificationEmail}:{}),isInitialIntakeTeam:team.isInitialIntakeTeam,memberAdminUserIds:team.memberAdminUserIds,createdAt:FieldValue.serverTimestamp(),createdBy:actorId,updatedAt:FieldValue.serverTimestamp(),updatedBy:actorId});
    });
    return team;
  }
  public async update(id:string,input:TeamUpdateInput,actorId:string):Promise<OperationalTeam>{
    const ref=this.collection.doc(id);
    return this.firestore.runTransaction(async tx=>{
      const s=await tx.get(ref);
      if(!s.exists)throw new Error('TEAM_NOT_FOUND');
      const before=fromSnapshot(s);
      const notificationEmail=input.notificationEmail!==undefined?(input.notificationEmail?input.notificationEmail.trim().toLowerCase():undefined):before.notificationEmail;
      const isInitialIntakeTeam=input.isInitialIntakeTeam!==undefined?input.isInitialIntakeTeam:before.isInitialIntakeTeam;
      const active=input.active!==undefined?input.active:before.active;
      if(before.isInitialIntakeTeam&&isInitialIntakeTeam&&!active){
        throw new Error('INITIAL_TEAM_CANNOT_BE_DEACTIVATED');
      }
      if(before.isInitialIntakeTeam&&isInitialIntakeTeam&&!notificationEmail){
        throw new Error('INITIAL_TEAM_REQUIRES_EMAIL');
      }
      if(isInitialIntakeTeam&&!before.isInitialIntakeTeam){
        const existingInitials=await tx.get(this.collection.where('isInitialIntakeTeam','==',true));
        for(const doc of existingInitials.docs){
          if(doc.id!==id)tx.update(doc.ref,{isInitialIntakeTeam:false,updatedAt:FieldValue.serverTimestamp(),updatedBy:actorId});
        }
      }
      const after:OperationalTeam={...before,schemaVersion:2,...(input.name===undefined?{}:{name:input.name}),...(input.description===undefined?{}:{description:input.description}),active,...(input.sortOrder===undefined?{}:{sortOrder:input.sortOrder}),...(notificationEmail?{notificationEmail}:{}),isInitialIntakeTeam,...(input.memberAdminUserIds===undefined?{}:{memberAdminUserIds:input.memberAdminUserIds}),updatedAt:new Date().toISOString(),updatedBy:actorId};
      if(!notificationEmail)delete after.notificationEmail;
      tx.update(ref,{name:after.name,description:after.description??FieldValue.delete(),active:after.active,sortOrder:after.sortOrder,notificationEmail:after.notificationEmail??FieldValue.delete(),isInitialIntakeTeam:after.isInitialIntakeTeam,memberAdminUserIds:after.memberAdminUserIds,updatedAt:FieldValue.serverTimestamp(),updatedBy:actorId});
      return after;
    });
  }
  public async seed(items:OperationalTeam[],actorId:string):Promise<void>{
    for(const item of items){
      const ref=this.collection.doc(item.id);
      const s=await ref.get();
      if(!s.exists){
        await ref.create({schemaVersion:2,name:item.name,...(item.description?{description:item.description}:{}),active:item.active,sortOrder:item.sortOrder,...(item.notificationEmail?{notificationEmail:item.notificationEmail}:{}),isInitialIntakeTeam:item.isInitialIntakeTeam,memberAdminUserIds:item.memberAdminUserIds,createdAt:FieldValue.serverTimestamp(),createdBy:actorId,updatedAt:FieldValue.serverTimestamp(),updatedBy:actorId});
      }
    }
  }
}
