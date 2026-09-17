/**
 * G09B-F014 — Manifesto de Estado Pré-Migração
 *
 * Exporta o estado atual das coleções `operationalTeams` e `adminUsers`
 * para um arquivo JSON local, servindo como "preimage" para auditoria
 * e recuperação em caso de falha de migração.
 *
 * ─── SEGURANÇA ──────────────────────────────────────────────────────────────
 * - Dry-run por padrão: não escreve arquivo sem --apply
 * - Nunca conecta a produção sem variáveis de emulador OU confirmação explícita
 * - Arquivo de saída é local, nunca enviado a nenhum serviço externo
 *
 * Uso:
 *   tsx scripts/migrationManifest.ts               # dry-run (imprime, não grava)
 *   tsx scripts/migrationManifest.ts --apply        # grava arquivo manifesto
 *
 * O --apply em produção (fora de emulator) requer:
 *   ALLOW_MANIFEST_EXPORT=CONFIRM_MANIFEST_EXPORT_PRE_MIGRATION
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, '..', '..');

export interface MigrationManifest {
  exportedAt: string;
  projectId: string;
  emulatorMode: boolean;
  collections: {
    operationalTeams: Record<string, unknown>[];
    adminUsers: Record<string, unknown>[];
  };
  counts: {
    operationalTeams: number;
    adminUsers: number;
  };
  /** Assinatura do manifesto — hash simples para detecção de adulteração. */
  checksum: string;
}

function simpleChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // converte para int32
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

async function runCli(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');

  // ─── Guard de confirmação em produção ─────────────────────────────────────
  if (!SERVER_ENV.emulatorMode && apply) {
    if (process.env.ALLOW_MANIFEST_EXPORT !== 'CONFIRM_MANIFEST_EXPORT_PRE_MIGRATION') {
      throw new Error(
        'Exportação de manifesto fora do Emulator Suite bloqueada.\n' +
        'Defina ALLOW_MANIFEST_EXPORT=CONFIRM_MANIFEST_EXPORT_PRE_MIGRATION ' +
        'somente após confirmar o projeto de destino e revisar o contexto de migração.'
      );
    }
  }

  const { firestore } = getFirebaseAdminServices(SERVER_ENV);

  console.log('[manifesto] Lendo coleção operationalTeams...');
  const teamsSnapshot = await firestore.collection('operationalTeams').get();
  const teams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  console.log('[manifesto] Lendo coleção adminUsers...');
  const adminUsersSnapshot = await firestore.collection('adminUsers').get();
  const adminUsers = adminUsersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const collections = { operationalTeams: teams, adminUsers };
  const checksum = simpleChecksum(collections);

  const manifest: MigrationManifest = {
    exportedAt: new Date().toISOString(),
    projectId: SERVER_ENV.emulatorMode ? 'emulator-local' : '(produção)',
    emulatorMode: SERVER_ENV.emulatorMode,
    collections,
    counts: {
      operationalTeams: teams.length,
      adminUsers: adminUsers.length,
    },
    checksum,
  };

  console.log('\n=== MANIFESTO DE ESTADO PRÉ-MIGRAÇÃO ===');
  console.log(`  exportedAt           : ${manifest.exportedAt}`);
  console.log(`  emulatorMode         : ${manifest.emulatorMode}`);
  console.log(`  operationalTeams     : ${manifest.counts.operationalTeams} documentos`);
  console.log(`  adminUsers           : ${manifest.counts.adminUsers} documentos`);
  console.log(`  checksum             : ${manifest.checksum}`);

  if (!apply) {
    console.log('\n[DRY-RUN] Manifesto calculado mas não gravado em disco.');
    console.log('  Execute com --apply para gravar o arquivo de pré-imagem.');
    return;
  }

  // ─── Grava arquivo ────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `migration-manifest-${timestamp}.json`;
  const outputPath = join(ROOT, filename);

  writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n[APPLY] Manifesto gravado em: ${outputPath}`);
  console.log('  Guarde este arquivo antes de executar qualquer migração.');
  console.log('  Em caso de falha, este manifesto permite restaurar o estado anterior.');
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectExecution) {
  void runCli();
}
