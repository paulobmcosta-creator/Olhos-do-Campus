# Cloudflare R2 e transição do Firebase Storage — 0.7.1

## Verificação integral da migração

A 0.7.1 corrige o falso positivo possível no antigo `--verify`. O relatório agora separa:

- `listed`;
- `eligibleSourceObjects`;
- `ignoredJustified`;
- `verified`;
- `missingDestination`;
- `mismatches`;
- `failures`;
- `rejectedPaths`;
- `copied` / `alreadyPresent`;
- `deletedSource`.

O modo `--verify` só termina com sucesso quando:

```text
verified === eligibleSourceObjects
missingDestination === 0
mismatches === 0
failures === 0
rejectedPaths === 0
```

Objetos deliberadamente ignorados, caso venham a existir em uma evolução compatível do script, devem ser registrados em `ignoredJustified` e ficar fora do denominador elegível. Na árvore 0.7.1 não existe categoria funcional deliberadamente ignorada; portanto esse contador permanece zero em operação normal.

### Sequência segura

```bash
npm run storage:migrate:r2 -- --dry-run
npm run storage:migrate:r2 -- --apply
npm run storage:migrate:r2 -- --verify
```

Se 99 de 100 objetos elegíveis existirem no destino, `--verify` deve retornar exit code diferente de zero. Divergência de tamanho, divergência SHA-256, falha transitória ou path rejeitado também impedem sucesso.

## Exclusão da origem

A origem não é excluída por leitura, reconciliação ou migração comum. A remoção exige operação separada:

```bash
CONFIRM_DELETE_VERIFIED_FIREBASE_SOURCE=DELETE_VERIFIED_FIREBASE_SOURCE_OBJECTS \
npm run storage:migrate:r2 -- --apply --delete-source-after-verified-migration
```

A exclusão é recusada se a verificação integral não estiver aprovada. A segunda passagem revalida bytes imediatamente antes de cada exclusão; mudança no objeto interrompe a operação.

## Fallback provider-aware

Enquanto `LEGACY_PHOTO_FALLBACK_ENABLED=true`:

- gravações novas: somente R2;
- leitura: R2 → Firebase Storage legado;
- leitura de fallback não apaga a cópia legada;
- exclusão decorrente de ação de domínio: tentativa idempotente em R2 **e** Firebase Storage;
- falha em um provider não impede tentativa no outro;
- falha parcial gera `storageCleanupTasks` específica para o provider pendente;
- retry posterior é idempotente.

Cenários A–H (somente R2, somente legado, ambos, nenhum, falhas individuais, parcial e retry) são cobertos em `tests/fallbackDeletion071.test.ts`.
