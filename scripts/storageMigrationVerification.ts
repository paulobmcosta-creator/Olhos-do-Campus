import { createHash } from 'node:crypto';

export interface StorageMigrationVerificationReport {
  listed: number;
  eligibleSourceObjects: number;
  ignoredJustified: number;
  copied: number;
  alreadyPresent: number;
  verified: number;
  missingDestination: number;
  mismatches: number;
  deletedSource: number;
  rejectedPaths: number;
  failures: number;
}

export type StorageObjectVerification = 'VERIFIED' | 'MISSING_SOURCE' | 'MISSING_DESTINATION' | 'SIZE_MISMATCH' | 'HASH_MISMATCH';

function digest(value: Buffer): string { return createHash('sha256').update(value).digest('hex'); }

export function compareStorageObjects(source: Buffer | undefined, destination: Buffer | undefined): StorageObjectVerification {
  if (source === undefined) return 'MISSING_SOURCE';
  if (destination === undefined) return 'MISSING_DESTINATION';
  if (source.length !== destination.length) return 'SIZE_MISMATCH';
  return digest(source) === digest(destination) ? 'VERIFIED' : 'HASH_MISMATCH';
}

export function createStorageMigrationVerificationReport(): StorageMigrationVerificationReport {
  return {
    listed: 0,
    eligibleSourceObjects: 0,
    ignoredJustified: 0,
    copied: 0,
    alreadyPresent: 0,
    verified: 0,
    missingDestination: 0,
    mismatches: 0,
    deletedSource: 0,
    rejectedPaths: 0,
    failures: 0,
  };
}

export function verificationIsComplete(report: StorageMigrationVerificationReport): boolean {
  return report.verified === report.eligibleSourceObjects
    && report.missingDestination === 0
    && report.mismatches === 0
    && report.failures === 0
    && report.rejectedPaths === 0;
}

export function migrationHasErrors(report: StorageMigrationVerificationReport, verify: boolean): boolean {
  if (report.failures > 0 || report.mismatches > 0 || report.rejectedPaths > 0) return true;
  return verify && !verificationIsComplete(report);
}
