# Testes — versão 0.7.5

Data: 2026-08-19.

Fonte de verdade recebida para consolidação: `olhos-do-campus-0.7.4-pos-homologacao.zip`, SHA-256 `c0c43f7a53f075a126fffc974639b1f5c7b8a893774c892cba1340ef6374d77c`.

## 1. Homologação executada no Google Cloud Shell

Ambiente registrado:

| Item | Resultado |
|---|---|
| Node | `v22.22.2` |
| npm | `10.9.7` |
| Java | OpenJDK `21.0.11` |
| Baseline do projeto | `>=22.22.2 <23` |

### Gates principais

| Comando | Resultado observado |
|---|---|
| `npm run typecheck` | PASSOU — 0 erros |
| `npm run lint` | PASSOU — 0 warnings/erros |
| `npm run test` | PASSOU — 47 arquivos, 298 testes; 2 testes opt-in ignorados |
| `npm run worker:typecheck` | PASSOU |
| `npm run worker:test` | PASSOU — 4/4 |
| `npm run build` | PASSOU — cliente e servidor |
| `npm audit` | PASSOU — 0 vulnerabilidades |
| `npm audit --omit=dev` | PASSOU — 0 vulnerabilidades |

O build do cliente transformou 1.768 módulos e produziu bundle principal de aproximadamente 687,89 kB, com warning não bloqueante do Vite para chunk acima de 500 kB. O servidor foi empacotado com esbuild.

### Emulator Suite

| Comando | Resultado observado |
|---|---|
| `npm run test:rules` | PASSOU — 2/2 |
| `npm run test:firebase` | PASSOU — 19/19 |
| `npm run test:storage` | PASSOU — 6/6 |

As mensagens `PERMISSION_DENIED` emitidas durante `test:rules` são esperadas: o teste valida justamente a negação de acesso Web às coleções server-only e ao Storage.

Os avisos de bind IPv6 `::1` no Cloud Shell não bloquearam os emuladores, que iniciaram em IPv4. O aviso de depreciação de `punycode` pertence ao tooling/dependências e não impediu a conclusão dos testes.

## 2. Correções descobertas durante a homologação da 0.7.4

Antes da suíte ficar verde foram corrigidos:

1. inclusão dos códigos `WEBHOOK_ATTEMPT_ID_INVALID` e `WEBHOOK_ATTEMPT_WITHOUT_NOTIFICATION` no contrato compartilhado de erros;
2. variável `pending` no teste de retry técnico, preservando-a somente no cenário que usa `nextAttemptAt`;
3. conflito legado `notification_id × providerMessageId`, que deve retornar `inconsistent` e não atualizar a outbox errada;
4. asserção cross-realm de Blob no Vitest/jsdom, substituindo `instanceof` por propriedades contratuais `type` e `size`.

A árvore recebida para a 0.7.5 já contém essas quatro correções.

## 3. Firestore/Storage real

- `firestore.rules`: compiladas e publicadas com sucesso;
- `storage.rules`: compiladas e publicadas com sucesso;
- banco real: Firestore Enterprise, `us-west1`;
- primeiro deploy de índices: falhou por `fieldOverrides` incompatíveis com Enterprise;
- manifesto corrigido: sem `fieldOverrides`, com seis índices explícitos `attempts`;
- seis índices `attempts`: aceitos e observados em `CREATING`.

A evidência fornecida não comprova ainda `READY` para todos os seis. Esse é o único gate externo pendente relacionado ao Firestore antes de tráfego produtivo que dependa das consultas.

## 4. Teste de regressão 0.7.5

Foi adicionado `tests/firestoreEnterprise075.test.ts` com 2 testes:

- ausência de `fieldOverrides` no manifesto;
- presença exata dos seis índices DENSE de `attempts`, com escopo `COLLECTION_GROUP` e ordens esperadas.

Esse teste foi incluído depois da bateria Cloud Shell da 0.7.4 pós-homologação; portanto, sua execução Vitest específica deve ser repetida na próxima validação com dependências instaladas.

## 5. Validação auxiliar no ambiente de empacotamento 0.7.5

O ambiente de empacotamento possui Node `22.16.0`, abaixo da baseline do projeto, e o ZIP de origem deliberadamente não contém `node_modules`. Por isso não foi usada essa máquina para substituir a homologação oficial do Cloud Shell.

Foram executadas apenas verificações auxiliares não substitutivas: parse de JSON, transpilação sintática TS/TSX, consistência de versões, inspeção de manifesto Enterprise, scan de artefatos indevidos e validação estrutural do ZIP final. Os resultados são registrados em `INSPECAO_ZIP_FINAL_0.7.5.md`.

## 6. Integrações opt-in

Os testes `test:r2` e `test:resend` são opt-in e não aparecem como executados na evidência fornecida. Não declarar envio Resend real nem operação R2 real como homologados nesta etapa.
