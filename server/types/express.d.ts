import type { AuthorizedAdminProfile } from '../../src/models/admin';
import type { VerifiedFirebaseUser } from './firebase';
import type { UploadedPhotoBuffer } from '../middleware/multipartPhotos';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      firebaseUser?: VerifiedFirebaseUser;
      adminUser?: AuthorizedAdminProfile;
      photoFiles?: UploadedPhotoBuffer[];
    }
  }
}

export {};
