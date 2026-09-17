# Relatório de implementação — versão 0.7.3

## 1. Base e escopo

Fonte exclusiva: ZIP `olhos-do-campus-0.7.2.zip`. A árvore foi extraída integralmente e inspecionada antes das alterações. O `package.json` de origem confirmou a versão 0.7.2 e a baseline Node `>=22.22.2 <23`.

A alteração foi restrita ao subsistema de notificações, seus modelos, métricas, índices, testes, versão e documentação. R2, migração/verify, fallback Storage, cleanup do Artifact Registry, Cloudflare Pages, Cloud Run, região `us-west1`, Docker e baseline Node não foram reabertos.

## 2. Achado confirmado

Na 0.7.2, a correlação por `notification_id` identificava corretamente a outbox lógica, mas retries diferentes compartilhavam o mesmo identificador lógico e a outbox mantinha apenas um `providerMessageId` como histórico corrente. Assim, durante A2, um webhook P2 podia chegar antes de `markSent(P2)` enquanto a outbox ainda continha P1 da A1. A comparação no nível da outbox podia interpretar P1 × P2 como conflito apesar de ambos pertencerem a tentativas distintas.

A métrica de aceite também possuía cardinalidade máxima de uma unidade por documento de outbox, incapaz de representar A1 e A2 ambas aceitas pelo provider.

## 3. Modelo attempt-aware

A 0.7.3 mantém `notificationOutbox/{notificationId}` como intenção lógica e introduz:

```text
notificationOutbox/{notificationId}/attempts/{attemptId}
```

Cada DeliveryAttempt contém apenas metadados operacionais mínimos: `attemptNumber`, status, idempotency key, timestamps, `providerAcceptedAt`, `providerMessageId`, categoria/código/resumo sanitizados e último evento do provider. Não replica corpo de e-mail, descrição de ocorrência, tracking key, IP, token ou secret.

A outbox passa a schemaVersion 2 para novos documentos e mantém `attemptCount` como cache agregado/controle de limite, `currentAttemptId` como ponte para a tentativa corrente e `providerMessageId`/`idempotencyKey` como cache/compatibilidade. Documentos schemaVersion 1 permanecem legíveis.

## 4. Criação pré-send, concorrência e idempotência

O claim Firestore cria a tentativa dentro da mesma transação que adquire a lease, antes de qualquer chamada externa. O número deriva de `attemptCount + 1` dentro da transação, e o ID é determinístico por notificação+número. Claims concorrentes não podem materializar duas A2 válidas.

Recuperação de lease expirada ainda dentro da janela segura reutiliza a mesma `currentAttemptId` e idempotency key. Um retry externo genuíno após estado retryable cria nova tentativa e nova chave. O limite de oito tentativas existente continua vigente.

Se uma exceção de transporte/SDK ocorrer sem resposta conclusiva do provider, a tentativa corrente fica `UNCERTAIN`, sem `providerAcceptedAt`; a outbox fica `DELIVERY_UNCERTAIN` e não é reenviada automaticamente. Isso diferencia resultado externo indeterminado de rejeição conhecida do provider.

## 5. Tags e correlação

`EmailProvider.send` recebe `notificationId` e `attemptId`. Somente `ResendEmailProvider` converte esses valores em `notification_id` e `attempt_id`.

A correlação segue:

1. `notification_id + attempt_id`;
2. `providerMessageId` em collection group `attempts`;
3. tentativa corrente para webhook 0.7.2 sem `attempt_id`, quando compatível;
4. fallback legado pelo `providerMessageId` diretamente na outbox.

Se A2 ainda não possuir P2, um webhook consistente pode estabelecer P2. P1 da A1 não é usado para invalidar A2. Divergência dentro da mesma tentativa ou evidência cruzada entre notificações distintas continua resultando em `INCONSISTENT` sem atualização silenciosa.

## 6. Máquina de estados e tentativas antigas

Cada tentativa possui estado próprio. Somente a tentativa corrente alimenta o estado agregado da outbox. Webhook tardio de tentativa anterior atualiza o histórico daquela tentativa, mas não rebaixa uma entrega posterior já confirmada.

A máquina global preexistente continua monotônica para a tentativa corrente. `markSent` e `markDeliveryUncertain` continuam condicionados a `PROCESSING`, lease owner correto e `currentAttemptId` correspondente; um webhook rápido que conclua A2 antes dessas escritas impede rebaixamento tardio.

## 7. Métricas e consumo

A referência de Resend passa a usar DeliveryAttempts com `providerAcceptedAt`. Uma tentativa conta no máximo uma unidade. Duas tentativas aceitas da mesma Notification contam duas unidades. Webhook `delivered` ou replay não acrescenta unidade nova.

`email.failed` não estabelece aceite por si só. Resultado de transporte indeterminado também não é contado até confirmação externa.

Para compatibilidade, documentos 0.7.2 schemaVersion 1 com `providerAcceptedAt` conhecido continuam contribuindo uma unidade mínima histórica. Se um desses documentos entrar em retry 0.7.3, a última tentativa aceita conhecida é materializada lazy antes da nova tentativa, evitando queda artificial da contagem. Não se reconstrói histórico múltiplo que a 0.7.2 não registrou individualmente.

## 8. Índices e regras

Foram adicionados apenas índices necessários às consultas executadas:

- collection group `attempts`: `providerMessageId`, `providerAcceptedAt`, `createdAt`, `status` e `attemptNumber`;
- `notificationOutbox`: `schemaVersion + providerAcceptedAt` ASC/DESC para compatibilidade das métricas legadas.

As regras Firestore continuam deny-all para o browser através do wildcard recursivo já existente. A alteração textual apenas explicita que `attempts` faz parte das coleções internas server-only.

## 9. Interface administrativa

Não houve redesign. O painel mantém os agregados e passa a distinguir tentativas iniciadas, aceitas, entregues, falhas, bounces, complaints, incertas e retries. O numerador diário/mensal de referência usa aceites por tentativa. A terminologia de Artifact Registry corrigida na 0.7.2 foi preservada.

## 10. Segurança e privacidade

Os IDs de notification/attempt são hashes técnicos de 64 caracteres e não carregam PII. O webhook continua assinado e validado; não há persistência de payload bruto. Logs não foram ampliados para registrar tags completas. Nenhuma credencial foi adicionada ao código.

## 11. Testes

A suíte nova encontra-se em `tests/notificationAttempts073.test.ts`; testes anteriores foram preservados. Os resultados reais desta execução, inclusive bloqueios ambientais, constam em `docs/TESTES_0.7.3.md`.

O runtime do sandbox é Node 22.16.0, inferior à baseline. `npm ci` não concluiu e o registry npm apresentou `EAI_AGAIN`; por isso typecheck, lint, Vitest, Worker, build e Emulator Suite oficiais não puderam ser validados integralmente. Foram executadas validações auxiliares de transpile, JSON, provider tags e repositório in-memory.

## 12. Riscos residuais e pendências externas

- executar instalação limpa e suíte completa em Node 22.22.2+ <23;
- implantar os novos índices Firestore antes da homologação real;
- confirmar em ambiente Resend de homologação que webhooks reais preservam `notification_id` e `attempt_id` conforme esperado;
- observar ao menos um fluxo de retry real/controle com A1/P1 e A2/P2;
- nenhuma migração de dados 0.7.2 é obrigatória; compatibilidade é lazy e não destrutiva.

## 13. Classificação

Nenhum bloqueador conhecido permanece na lógica attempt-aware identificada pela auditoria, mas a suíte oficial está bloqueada pelo ambiente desta execução.

**Código candidato à homologação; validação completa pendente em ambiente compatível.**
