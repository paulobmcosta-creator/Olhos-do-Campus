import type { AuthorizedAdminProfile } from '../../src/models/admin';
import type { VerifiedFirebaseUser } from './firebase';
import type { UploadedPhotoBuffer } from '../middleware/multipartPhotos';

declare module 'http' {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare module 'node:http' {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      firebaseUser?: VerifiedFirebaseUser;
      adminUser?: AuthorizedAdminProfile;
      photoFiles?: UploadedPhotoBuffer[];
      rawBody?: Buffer;
    }
  }
}

export {};
