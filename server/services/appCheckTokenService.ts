import type { FirebaseAdminServices } from '../config/firebaseAdmin';
import type { AppCheckVerifier } from '../types/firebase';

export class AppCheckTokenService implements AppCheckVerifier {
  public constructor(private readonly firebase: FirebaseAdminServices) {}

  public async verifyToken(token: string): Promise<void> {
    await this.firebase.appCheck.verifyToken(token);
  }
}
