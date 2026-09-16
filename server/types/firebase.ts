export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  provider: string;
}

export interface FirebaseTokenVerifier {
  verifyIdToken(token: string): Promise<VerifiedFirebaseUser>;
}

export interface AppCheckVerifier {
  verifyToken(token: string): Promise<void>;
}
