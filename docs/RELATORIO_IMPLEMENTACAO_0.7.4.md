# Relatório de implementação — versão 0.7.4

## 1. Escopo e fonte

A implementação foi realizada exclusivamente sobre `olhos-do-campus-0.7.3.zip`. A árvore de origem foi extraída e inspecionada integralmente antes das alterações: 364 arquivos, versão 0.7.3 e baseline Node `>=22.22.2 <23`.

A versão é cirúrgica: corrige somente a semântica de retry técnico do subsistema Resend. R2, Storage legado, Artifact Registry, Pages, Cloud Run, HMAC/cron do Worker, autenticação, autorização e regras client-side permaneceram fora do escopo funcional.

## 2. Achado confirmado

Na 0.7.3, erros classificados genericamente como transitórios/quota levavam a outbox para `RETRY_PENDING`/`DEFERRED`. O claim posterior tratava qualquer retomada pendente como nova tentativa externa, incrementando `attemptCount` e criando novo `attemptId`/idempotency key.

Isso era incorreto para `concurrent_idempotent_requests` e para resultados tecnicamente ambíguos nos quais a mesma chamada deve ser repetida sob a mesma identidade idempotente.

## 3. Semântica implementada

Foram introduzidos dois modos operacionais:

- `SAME_ATTEMPT`: retoma a mesma DeliveryAttempt, sem incrementar `attemptNumber`/`attemptCount` e reutilizando a mesma idempotency key;
- `NEW_ATTEMPT`: encerra a tentativa anterior e autoriza o claim posterior a criar uma nova DeliveryAttempt com novo ID/chave.

Também foi adicionada a noção de segurança do retry:

- `IDEMPOTENCY_WINDOW`: a repetição só ocorre dentro da janela segura da chave do provider;
- `PROVIDER_REJECTED`: o provider rejeitou explicitamente a chamada; o mesmo attempt pode ser diferido sem contabilizar nova tentativa externa.

## 4. Taxonomia Resend

A classificação server-only passa a tratar:

- `concurrent_idempotent_requests` → `TRANSIENT`, `SAME_ATTEMPT`, `IDEMPOTENCY_WINDOW`;
- 5xx/408/status 0 estruturados pelo SDK/provider → `TRANSIENT`, `SAME_ATTEMPT`, `IDEMPOTENCY_WINDOW`;
- rate limit/quota → `QUOTA`, `SAME_ATTEMPT`, `PROVIDER_REJECTED`;
- configuração, destinatário inválido, suppression e falhas permanentes → políticas terminais preexistentes.

Exceção de transporte/SDK sem resposta conclusiva e sem `EmailProviderError` continua conservadora: a tentativa passa a `UNCERTAIN` e a outbox a `DELIVERY_UNCERTAIN`, sem A2 automática.

## 5. Persistência e claim

`DeliveryAttempt` ganhou campos backward-compatible:

- `technicalRetryCount`;
- `retryMode`;
- `retrySafety`;
- `nextAttemptAt`.

A outbox ganhou os caches opcionais `retryMode` e `retrySafety` para orientar o claim seguinte.

No `claimEligible()`:

- se `retryMode=SAME_ATTEMPT`, o repository lê a tentativa corrente, valida estado/janela/limite, adquire nova lease e a coloca novamente em `PROCESSING` usando o mesmo ID/chave;
- se `retryMode=NEW_ATTEMPT`, permanece o comportamento attempt-aware 0.7.3: cria A2/K2 dentro da transação e incrementa `attemptCount`;
- dois workers concorrentes continuam protegidos pela transação e lease.

Nenhum índice Firestore novo foi necessário.

## 6. Backoff e limite

Retries técnicos possuem backoff exponencial persistido, começando em 30 segundos e limitado a 15 minutos. `technicalRetryCount` não altera o número da DeliveryAttempt.

São permitidos até quatro retries técnicos automáticos. Se o próximo exceder o limite, ou se um retry dependente de idempotência cair fora da janela segura, A1 torna-se `UNCERTAIN` e a outbox `DELIVERY_UNCERTAIN`. Não há criação automática de A2 nesse cenário.

## 7. Webhooks e provider message ID

A correlação attempt-aware por `notification_id + attempt_id` da 0.7.3 foi preservada. Um webhook terminal durante o backoff limpa os campos de retry da tentativa/outbox e impede retomada posterior.

`providerMessageId` continua pertencendo primariamente à tentativa. Um ID incompatível para a mesma tentativa não é sobrescrito silenciosamente.

## 8. Consumo

A métrica attempt-aware não foi redesenhada. Como retry técnico reutiliza o mesmo documento de DeliveryAttempt, chamadas A1/K1 repetidas não criam novas unidades lógicas. A1 aceita + A2 aceita continua resultando em duas unidades.

## 9. Compatibilidade

- documentos 0.7.2 continuam legíveis;
- attempts 0.7.3 sem os campos novos recebem `technicalRetryCount=0` em leitura e ausência dos demais campos opcionais;
- webhooks sem `attempt_id` e `providerMessageId` legado continuam usando os fallbacks já existentes;
- não há migração destrutiva.

## 10. Preservação de escopo

Foram comparados por SHA-256 e permaneceram byte a byte idênticos à 0.7.3: repositories/scripts R2, fallback Storage, migração/reconciliação, cleanup Storage, policy/scripts Artifact Registry, `cloudbuild.yaml`, `Dockerfile`, `_headers`, `_redirects`, `firestore.indexes.json`, `firestore.rules` e lógica `maintenance.ts`/`signature.ts` do Worker.

Nenhuma dependência, devDependency, override ou engine mudou. O Worker teve apenas atualização de versionamento/health para 0.7.4.

## 11. Testes e ambiente

A suíte oficial ficou bloqueada porque o host possui Node 22.16.0 e não foi possível instalar dependências. Os erros completos e as validações auxiliares executadas estão em `docs/TESTES_0.7.4.md`.

## 12. Situação

Nenhum bloqueador conhecido permaneceu no código dentro do escopo da correção após as validações possíveis. Entretanto, typecheck, lint, Vitest, build, audits e Emulator Suite precisam ser repetidos em ambiente compatível antes da homologação externa.

**Código candidato à homologação; validação completa pendente em ambiente compatível.**
