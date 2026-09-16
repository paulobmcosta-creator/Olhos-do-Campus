import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('separação lógica das autenticações Firebase', () => {
  const source = readFileSync('src/config/firebase.ts', 'utf8');

  it('utiliza aplicativos nomeados independentes para as áreas pública e administrativa', () => {
    expect(source).toContain("'olhos-do-campus-public'");
    expect(source).toContain("'olhos-do-campus-admin'");
    expect(source).toContain('publicFirebaseAuth');
    expect(source).toContain('adminFirebaseAuth');
  });

  it('usa persistências independentes e não vincula automaticamente as contas', () => {
    expect(source).toContain('browserSessionPersistence');
    expect(source).toContain('browserLocalPersistence');
    expect(source).not.toContain('linkWithCredential');
  });
});
