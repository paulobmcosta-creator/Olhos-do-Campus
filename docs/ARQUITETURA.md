# Arquitetura — versão 0.6.0

## 1. Visão geral

A versão 0.6.0 preserva a arquitetura server-only consolidada na série 0.5.x e amplia o domínio administrativo sem liberar acesso direto do navegador aos dados institucionais.

```text
React + TypeScript + Vite
        ↓ HTTPS
Express API
        ↓
Firebase App Check
        ↓
Firebase Authentication
        ↓
Autorização server-side
        ↓
Controllers / Services / Domain
        ↓
Repositories
        ↓
Firebase Admin SDK
        ↓
Cloud Firestore + Cloud Storage
```

O frontend usa Firebase Authentication para identidade e App Check para atestar o cliente. Firestore e Storage permanecem `deny-all` para o SDK Web; leitura e escrita institucionais são feitas pelo backend com Firebase Admin.

## 2. Frontend

Principais áreas:

- registro público de ocorrência;
- consulta pública por protocolo + chave de acompanhamento;
- autenticação administrativa Google;
- dashboard operacional;
- listagem administrativa com filtros, paginação por cursor, ordenação e exportações;
- detalhe operacional da ocorrência;
- painel analítico `/administracao/indicadores`;
- usuários, equipes/setores, configurações institucionais e auditoria global, exclusivos do Administrador.

O polling administrativo é de 60 segundos e não substitui silenciosamente o estado exibido. Ele apenas sinaliza que há informações novas e permite atualização explícita.

## 3. Backend

A API segue a sequência:

```text
route
→ App Check
→ Firebase Auth
→ autorização
→ validação Zod
→ controller
→ service/domínio
→ repository
→ Firebase
```

Operações críticas não aceitam patch livre do documento. O DTO administrativo admite somente ações explicitamente validadas pelo domínio, com `expectedVersion` para optimistic locking.

## 4. Domínio de ocorrências

O documento materializado preserva:

- categoria reportada imutável + categoria atual;
- local reportado imutável + local atual;
- prioridade e `priorityRank`;
- equipe e responsável individual opcional com snapshots textuais;
- `REAL | TEST`;
- `closedAt`, `resolvedAt`, reaberturas e `lastReopenedAt`;
- snapshot de SLA e de calendário;
- campos materializados estritamente necessários a filtros (`hasTeam`, `hasResponsible`, `hasPhoto`, `isClosed`, `reopened`, `searchTokens`).

Histórico funcional permanece em `occurrences/{id}/events` e é append-only pela aplicação.

## 5. SLA e calendário

O cálculo de horas úteis está centralizado em `server/domain/businessTime.ts` e `server/domain/sla.ts`. O timezone institucional é `America/Sao_Paulo`. Cada ocorrência recebe snapshot da política aplicável para impedir reescrita retroativa por mudanças futuras de calendário/matriz.

O SLA efetivo pausa em:

- `Aguardando material`;
- `Aguardando contratação ou serviço externo`.

Ao atingir estado terminal o relógio de SLA para. Se a ocorrência for reaberta, o intervalo em que permaneceu encerrada é tratado como suspensão do SLA efetivo; o tempo total cronológico continua ininterrupto.

## 6. Firestore

Coleções centrais:

- `occurrences` + subcoleções `events` e `photos`;
- `adminUsers`;
- `categories`;
- `locations`;
- `operationalTeams`;
- `systemSettings`;
- `serviceCalendars`;
- `serviceCalendarExceptions`;
- `auditLogs`;
- `protocolCounters`;
- `storageCleanupTasks`.

A listagem administrativa usa cursor (`startAfter`) e limite, nunca offset como mecanismo principal. Consultas com intervalo colocam o(s) campo(s) de desigualdade antes dos critérios operacionais de desempate, respeitando as restrições de ordenação do Firestore. `firestore.indexes.json` contém apenas índices compostos para ordenações/filas efetivamente implementadas; combinações não cobertas devem ser tratadas por índice adicional deliberado, nunca por scan ilimitado em memória.

## 7. Fotografias

O navegador envia multipart ao servidor. `sharp` valida e reencoda JPEG/PNG/WebP para WebP, remove metadados embutidos e produz miniaturas. Os bytes ficam no Cloud Storage; Firestore guarda metadados. Leitura pública/administrativa ocorre por endpoints autenticados/autorizados, sem signed URL permanente.

## 8. Segurança

Preservado:

- Firebase Anonymous Auth no registro/acompanhamento público;
- Google Sign-In administrativo;
- allowlist `adminUsers`;
- App Check;
- Firestore/Storage server-only;
- chave de acompanhamento fora da URL;
- hash + salt da chave, nunca exportados;
- optimistic locking;
- minimização de auditoria;
- exclusão física somente de ocorrência `TEST` por Administrador.

`Atendente` não é papel ativo. O valor existe somente como marcador legado bloqueado até resolução administrativa explícita.

## 9. Limites deliberados da 0.6.0

Não pertencem a esta versão: e-mail real, Trigger Email, SMTP, WebSocket/SSE, ações em lote, múltiplos campi, BI externo e exclusão física de ocorrências `REAL`.
