import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

export class FirestoreProtocolCounterRepository {
  public constructor(private readonly firestore: Firestore) {}

  private document(year: number): DocumentReference {
    return this.firestore.collection('protocolCounters').doc(String(year));
  }

  public async getNextSequence(transaction: Transaction, year: number): Promise<number> {
    const snapshot = await transaction.get(this.document(year));
    const lastSequence = snapshot.exists ? Number(snapshot.data()?.lastSequence ?? 0) : 0;
    if (!Number.isSafeInteger(lastSequence) || lastSequence < 0) {
      throw new Error(`Contador de protocolo inválido para o ano ${year}.`);
    }
    return lastSequence + 1;
  }

  public setSequence(transaction: Transaction, year: number, sequence: number, now: Date): void {
    transaction.set(this.document(year), {
      year,
      lastSequence: sequence,
      updatedAt: Timestamp.fromDate(now),
    });
  }
}
