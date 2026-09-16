import type { DocumentSnapshot, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CategoryItem } from '../../src/models/config';

export interface CategoryMutation { name?: string; description?: string; active?: boolean; sortOrder?: number; resolutionBaseBusinessHours?: number; expectedVersion: number; }
export class CategoryVersionConflictError extends Error {}

function snapshotToCategory(snapshot: DocumentSnapshot | QueryDocumentSnapshot): CategoryItem {
  const data = snapshot.data() ?? {};
  return { id: snapshot.id, name: String(data.name ?? ''), description: String(data.description ?? ''), active: data.active === true,
    sortOrder: Number(data.sortOrder ?? 0), resolutionBaseBusinessHours: Number(data.resolutionBaseBusinessHours ?? 120), version: Number(data.version ?? 1) };
}
export interface CategoryRepository {
  listActive(): Promise<CategoryItem[]>; listAll(): Promise<CategoryItem[]>; getById(id: string): Promise<CategoryItem | undefined>;
  create(item: Omit<CategoryItem,'id'|'version'> & { id: string }, updatedBy: string): Promise<CategoryItem>;
  update(id: string, input: CategoryMutation, updatedBy: string): Promise<CategoryItem>;
  seed(items: CategoryItem[], updatedBy: string): Promise<void>;
}
export class FirestoreCategoryRepository implements CategoryRepository {
  private readonly collection;
  public constructor(private readonly firestore: Firestore) { this.collection = firestore.collection('categories'); }
  public async listActive(): Promise<CategoryItem[]> { const s=await this.collection.where('active','==',true).get(); return s.docs.map(snapshotToCategory).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name,'pt-BR')); }
  public async listAll(): Promise<CategoryItem[]> { const s=await this.collection.get(); return s.docs.map(snapshotToCategory).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name,'pt-BR')); }
  public async getById(id:string):Promise<CategoryItem|undefined>{const s=await this.collection.doc(id).get();return s.exists?snapshotToCategory(s):undefined;}
  public async create(item: Omit<CategoryItem,'id'|'version'> & {id:string}, updatedBy:string):Promise<CategoryItem>{
    const ref=this.collection.doc(item.id); const now=Timestamp.now();
    await this.firestore.runTransaction(async tx=>{if((await tx.get(ref)).exists) throw new Error('CATEGORY_EXISTS'); tx.create(ref,{...item,schemaVersion:2,version:1,createdAt:now,updatedAt:now,updatedBy});});
    return {...item,version:1};
  }
  public async update(id:string,input:CategoryMutation,updatedBy:string):Promise<CategoryItem>{
    const ref=this.collection.doc(id); return this.firestore.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)throw new Error('CATEGORY_NOT_FOUND');const before=snapshotToCategory(s);if(before.version!==input.expectedVersion)throw new CategoryVersionConflictError();
      const after:CategoryItem={...before,...(input.name===undefined?{}:{name:input.name}),...(input.description===undefined?{}:{description:input.description}),...(input.active===undefined?{}:{active:input.active}),...(input.sortOrder===undefined?{}:{sortOrder:input.sortOrder}),...(input.resolutionBaseBusinessHours===undefined?{}:{resolutionBaseBusinessHours:input.resolutionBaseBusinessHours}),version:before.version+1};
      tx.update(ref,{name:after.name,description:after.description,active:after.active,sortOrder:after.sortOrder,resolutionBaseBusinessHours:after.resolutionBaseBusinessHours,version:after.version,updatedAt:FieldValue.serverTimestamp(),updatedBy});return after;});
  }
  public async seed(items:CategoryItem[],updatedBy:string):Promise<void>{for(const item of items){const ref=this.collection.doc(item.id);const existing=await ref.get();if(existing.exists)continue;await ref.create({name:item.name,description:item.description,active:item.active,sortOrder:item.sortOrder,resolutionBaseBusinessHours:item.resolutionBaseBusinessHours,schemaVersion:2,version:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),updatedBy});}}
}
