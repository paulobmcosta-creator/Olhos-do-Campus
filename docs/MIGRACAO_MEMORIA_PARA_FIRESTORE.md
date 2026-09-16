# Migração do domínio em memória para Firestore — versão 0.4.0

## 1. Situação encontrada na base

A base 0.3.0 utilizava `InMemoryDatabase` e dados iniciais para ocorrências, protocolo, categorias, localizações e configuração operacional. O protocolo dependia de estado do processo e o acompanhamento público utilizava chave em query string.

## 2. Componentes removidos do runtime

- `server/repositories/inMemoryDatabase.ts`;
- `server/repositories/initialData.ts`.

Não existe banco concorrente de ocorrências em memória na 0.4.0.

## 3. Substituições

| Domínio anterior | Fonte de verdade 0.4.0 |
|---|---|
| ocorrência | `FirestoreOccurrenceRepository` |
| protocolo/contador | `FirestoreProtocolCounterRepository` |
| histórico/mensagens/notas | subcoleção `events` |
| categorias | `FirestoreCategoryRepository` |
| localizações | `FirestoreLocationRepository` |
| configuração | `FirestoreSystemConfigRepository` |
| usuário administrativo | `FirestoreAdminUserRepository` preservado |
| auditoria | `FirestoreAuditLogRepository` preservado |
| fotografias | abstração temporária independente; nunca Firestore |

## 4. Dados demonstrativos

As quatro ocorrências demonstrativas foram transferidas para script explícito de seed. Não há carga automática em produção.

Os locais demonstrativos/provisórios permanecem somente como seed de referência explicitamente acionado e são marcados como provisórios.

## 5. Mudança do acompanhamento

Antes: consulta com segredo na URL.

Agora: `POST /api/occurrences/track` com protocolo/chave no corpo, Auth anônima, App Check e Zod.

## 6. Mudança do DTO público

A estratégia por exclusão foi substituída por lista positiva. A visão pública não recebe:

- derivação da chave;
- atribuição;
- IDs administrativos;
- IDs internos da localização;
- prioridade administrativa;
- notas/eventos internos;
- autores reais;
- `version`;
- campos técnicos do Firestore.

## 7. Mudança do histórico

Arrays crescentes no documento principal deixaram de ser fonte persistente. A API ainda organiza eventos em arrays de DTO para conveniência do cliente, mas esses arrays são produzidos na leitura e não ficam armazenados no documento da ocorrência.

## 8. Concorrência

O processo deixou de depender de contador local. `version` + transações Firestore protegem atualizações concorrentes e a sequência anual.

## 9. Fotografias

Data URLs não foram migradas. A funcionalidade temporária usa `PhotoRepository` separada e pode ser desabilitada. A persistência definitiva pertence à 0.5.0.
