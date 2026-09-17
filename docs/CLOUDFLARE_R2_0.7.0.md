# Cloudflare R2 — operação da versão 0.7.0

## Estado entregue

O código usa bucket R2 privado como armazenamento produtivo das fotografias. Firestore continua sendo a fonte de metadados, visibilidade e vínculos. Firebase Storage fica disponível somente para o Emulator Suite e para fallback legado temporário de leitura. Nenhuma migração externa foi executada nesta entrega.

## Preparação

1. No Cloudflare, crie um bucket R2 da classe Standard e não habilite domínio público, `r2.dev` ou listagem pública.
2. Crie um API token restrito ao bucket, com leitura e escrita de objetos. Não conceda administração de conta ou de outros buckets.
3. Registre o Account ID e o nome exato do bucket.
4. No Cloud Run, configure por secret/variável de backend:

```text
PHOTO_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<access-key-id>
R2_SECRET_ACCESS_KEY=<secret-access-key>
R2_BUCKET_NAME=<bucket>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

As credenciais nunca usam prefixo `VITE_` e nunca devem ir para Pages. O bucket deve permanecer privado: toda leitura passa pela API autenticada/autorizada.

## Migração Storage → R2

1. Confirme projeto Firebase, bucket de origem e bucket R2 de destino.
2. Garanta backup e janela de acompanhamento.
3. Execute o relatório sem escrita:

```bash
npm run storage:migrate:r2 -- --dry-run
```

4. Revise contagens, paths, conflitos e falhas.
5. Execute a cópia sem apagar a origem:

```bash
npm run storage:migrate:r2 -- --apply
```

6. Execute novo dry-run e confira tamanho e presença dos objetos.
7. Configure `PHOTO_STORAGE_PROVIDER=r2` no Cloud Run.
8. Durante a transição, se necessário, configure `LEGACY_PHOTO_FALLBACK_ENABLED=true` e `FIREBASE_STORAGE_BUCKET=<origem>`. A aplicação grava somente no R2 e consulta a origem apenas quando o objeto não existir no R2.
9. Homologue leitura administrativa, consulta pública autorizada e negação das fotos internas.
10. Após período de observação sem fallback, configure `LEGACY_PHOTO_FALLBACK_ENABLED=false` e remova a permissão do runtime ao bucket antigo.

O script processa por páginas e não mantém todo o acervo em memória. Objetos já equivalentes são ignorados. Divergência de tamanho/integridade é relatada, não sobrescrita silenciosamente.

## Remoção opcional da origem

Remover a origem é uma operação separada e irreversível. Faça isso somente após validação independente e retenção institucional aprovada:

```bash
CONFIRM_DELETE_VERIFIED_FIREBASE_SOURCE=DELETE_VERIFIED_FIREBASE_SOURCE_OBJECTS \
npm run storage:migrate:r2 -- --apply --delete-source-after-verified-migration
```

Sem os três elementos — apply, flag e confirmação exata — o script recusa a exclusão. Não há política automática de retenção para fotografias reais válidas.

## Reconciliação e cleanup

```bash
npm run storage:reconcile -- --dry-run
```

O relatório compara objetos R2 e metadados Firestore, indicando objetos ausentes, órfãos e divergências de tamanho. Use `RECONCILIATION_MAX_OBJECTS` para o limite de inventário e `RECONCILIATION_ORPHAN_SAFETY_HOURS` para a janela mínima (default 72h).

```bash
npm run storage:reconcile -- --apply
```

O apply só pode remover órfãos se o inventário estiver completo e se forem mais antigos que a janela de segurança. Ele não remove metadados válidos, ocorrências ou fotografias reais referenciadas. Tarefas de compensação pendentes podem ser processadas no painel administrativo ou pelo endpoint interno de manutenção.

## Rollback

Se a leitura R2 apresentar problema durante a transição, mantenha `PHOTO_STORAGE_PROVIDER=r2`, reative temporariamente `LEGACY_PHOTO_FALLBACK_ENABLED=true` e preserve os objetos de origem. Corrija o destino e repita a migração idempotente. Não reverta novas gravações para Firebase Storage em produção.

## Verificações

- upload produz objeto principal e thumbnail no R2;
- objetos não possuem URL pública;
- leitura pública exige ocorrência, protocolo e chave válidos e respeita visibilidade;
- leitura administrativa exige sessão e papel autorizado;
- bytes reencodados não preservam EXIF;
- falha parcial compensa uploads; falha da compensação cria cleanup persistente;
- credenciais R2 não aparecem no bundle do Pages nem nos logs.
