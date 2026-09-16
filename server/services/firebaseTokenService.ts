import type { FirebaseTokenVerifier, VerifiedFirebaseUser } from '../types/firebase';
import type { FirebaseAdminServices } from '../config/firebaseAdmin';

export class FirebaseTokenService implements FirebaseTokenVerifier {
  public constructor(private readonly firebase: FirebaseAdminServices) {}

  public async verifyIdToken(token: string): Promise<VerifiedFirebaseUser> {
    const decoded = await this.firebase.auth.verifyIdToken(token, true);
    const provider = typeof decoded.firebase?.sign_in_provider === 'string'
      ? decoded.firebase.sign_in_provider
      : '';
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      displayName: typeof decoded.name === 'string' ? decoded.name : undefined,
      provider,
    };
  }
}
