import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('[production-package] Removendo dependências de desenvolvimento do node_modules...');

const pruneResult = spawnSync(
  npmCommand,
  ['prune', '--omit=dev', '--no-audit', '--no-fund'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  },
);

if (pruneResult.error) {
  console.error('[production-package] Não foi possível executar npm prune:', pruneResult.error.message);
  process.exit(1);
}

if (pruneResult.status !== 0) {
  console.error(`[production-package] npm prune encerrou com código ${String(pruneResult.status)}.`);
  process.exit(pruneResult.status ?? 1);
}

for (const lockFile of ['bun.lock', 'bun.lockb']) {
  const lockPath = resolve(projectRoot, lockFile);
  if (existsSync(lockPath)) {
    rmSync(lockPath, { force: true });
    console.log(`[production-package] Removido lockfile não oficial gerado pelo ambiente: ${lockFile}`);
  }
}

console.log('[production-package] Pacote de produção preparado com dependências de runtime apenas.');
