# Relatório de implementação — versão 0.7.1

Data: 2026-08-18.

## 1. Escopo, fonte de verdade e método

A versão 0.7.1 foi produzida exclusivamente a partir do ZIP `olhos-do-campus-0.7.0.zip`, confirmado internamente como versão 0.7.0 antes de qualquer alteração. A árvore foi extraída e inspecionada integralmente; os documentos 0.7.0 de implementação, testes, arquivos, homologação e inspeção do ZIP também foram lidos antes da edição.

Esta entrega é uma correção pré-implantação. Não houve troca de Firestore, Firebase Authentication, Firebase App Check, Resend, Cloudflare R2, Cloudflare Pages, Cloud Run ou Maintenance Worker; não houve redesign geral, deploy, migração de dados reais ou introdução de serviço novo.

## 2. Resultado dos achados

| Achado | Confirmado no 0.7.0? | Resultado 0.7.1 |
|---|---|---|
| Cleanup do Artifact Registry só alcançava `untagged` apesar das tags `${SHORT_SHA}` | Sim | Corrigido com Delete para versões antigas usando `tagState: any`, Keep por tags protegidas e Keep das 10 versões recentes |
| `storage:migrate:r2 --verify` podia aceitar destino ausente | Sim | Verificação integral e relatório discriminado; lacuna produz exit code não zero |
| Fallback lia Firebase legado, mas `delete()` atuava só no primário | Sim | Exclusão provider-aware em R2 e Firebase legado, com falha/cleanup por provider |
| `email.failed` era convertido genericamente em `SUPPRESSED` | Sim | Classificação explícita de quota, transiente, configuração, destinatário inválido, supressão e desconhecida |
| Webhook tardio podia rebaixar estado definitivo | Sim | Máquina de estados monotônica com timestamp do provedor e precedência explícita |
| Documentação/fluxo tratava idempotência como garantia mais forte que a possível | Sim | Semântica corrigida para intenção determinística + entrega externa at-least-once + deduplicação local + janela de idempotência do provedor; `DELIVERY_UNCERTAIN` |
| Inventário R2 parcial alimentava percentuais/projeções integrais | Sim | Inventário parcial vira limite inferior; percentual/projeção integrais indisponíveis; pode sinalizar Crítico se o mínimo observado já exceder a referência |
| `cloudbuild.yaml` usava `us-central1` apesar do histórico `us-west1` | Sim | `us-west1` restaurado e `_REGION` validada antes do build |
| Projeto declarava Node 20 embora dependências travadas exigissem Node 22 mais recente | Sim | Baseline `>=22.22.2 <23`; Docker 22.22.2; package/lockfiles/Worker coerentes |
| Worker dependia do projeto raiz via `file:../../..` | Sim; dependência não utilizada | Removida; lockfile isolado atualizado sem alterar versões de dependências |

## 3. Artifact Registry

A política 0.7.0 tinha regra de exclusão limitada a `untagged`, enquanto o Cloud Build publica imagens com a tag automática `${SHORT_SHA}`. A 0.7.1 usa três regras complementares:

- exclusão de versões com mais de 30 dias com `tagState: any`;
- preservação de tags explícitas `release-`, `keep-` e `rollback-`;
- preservação das 10 versões mais recentes.

A regra destrutiva continua fora do build/deploy. `scripts/artifactRegistryCleanup.ts` permanece dry-run por padrão e exige a confirmação literal `APPLY_REVIEWED_ARTIFACT_REGISTRY_POLICY` para apply. O runbook 0.7.1 explicita o cenário de 100 builds antigos tagueados automaticamente e a necessidade de conferir o dry-run real antes da aplicação.

## 4. Verificação Firebase Storage → R2

Foi criado `scripts/storageMigrationVerification.ts` com critérios puros de comparação e completude. O relatório separa:

- `listed`;
- `eligibleSourceObjects`;
- `ignoredJustified`;
- `verified`;
- `missingDestination`;
- `mismatches`;
- `failures`;
- `rejectedPaths`;
- cópias, já presentes e exclusões da origem.

O modo `--verify` somente é completo quando todos os objetos elegíveis foram verificados e não há ausência, divergência, falha ou path rejeitado. `--delete-source-after-verified-migration` continua separado, requer `--apply`, confirmação literal e verificação integral prévia. Antes de cada exclusão da segunda passagem, origem e destino são relidos e comparados novamente.

Na implementação atual não existe categoria deliberada de objeto ignorado no inventário `occurrences/`; portanto `ignoredJustified` permanece zero no fluxo normal. Ela está explícita no contrato do relatório para não confundir futuras exclusões justificadas com cobertura incompleta.

## 5. Exclusão provider-aware durante fallback

`PhotoRepository` agora expõe o provider de forma tipada (`r2` ou `firebase-storage`). `FallbackPhotoRepository.delete()` tenta os dois providers independentemente e reúne as falhas em `PhotoDeletionError`.

`PhotoService.compensate()` cria tarefas de cleanup somente para os providers que falharam. O processamento de cleanup já existente continua idempotente e seleciona o repositório pelo `storageProvider` persistido.

A leitura continua R2 → Firebase Storage legado e **não** apaga cópia legada por simples leitura. A exclusão dual ocorre somente em ação de domínio/compensação ou procedimento explicitamente autorizado.

## 6. Resend: falhas, ordem de eventos e entrega incerta

Foi adicionado `server/domain/notificationDeliveryState.ts`, concentrando classificação e precedência de estados.

Novos estados/categorias relevantes:

- `FAILED_CONFIGURATION`;
- `DELIVERY_UNCERTAIN`;
- categorias `TRANSIENT`, `QUOTA`, `CONFIGURATION`, `INVALID_RECIPIENT`, `SUPPRESSION`, `BOUNCE`, `COMPLAINT` e `UNKNOWN`.

`email.failed` usa `data.failed.reason` quando disponível. Quota/rate limit não vira supressão; configuração/domínio/autenticação fica terminal e visível; destinatário inválido e supressão são distinguidos; razão desconhecida fica terminal sem retry inventado.

Eventos usam o timestamp do provedor quando disponível. Eventos anteriores ao último evento aplicado são ignorados. Estados adversos têm precedência, impedindo regressões como `DELIVERED → SENT`, `COMPLAINED → DELIVERED` ou `BOUNCED → SENT`.

A transação Firestore do webhook foi revisada para executar todas as leituras transacionais antes das escritas, preservando deduplicação por event ID e atualização monotônica do item.

### Semântica distribuída

A 0.7.1 não promete exactly-once. A garantia documentada é:

```text
intenção persistida deterministicamente
+ entrega externa at-least-once
+ deduplicação local
+ idempotência adicional do provedor dentro da janela suportada
```

A janela operacional de idempotência é tratada como limitada a 24 horas. Se o provider aceitou o envio, mas `markSent()` não pôde ser persistido, o sistema tenta gravar `DELIVERY_UNCERTAIN`. Se até essa gravação falhar, a lease somente pode ser recuperada automaticamente enquanto a janela segura ainda não expirou; depois disso o item é convertido em incerteza e não é reenviado automaticamente.

`DELIVERY_UNCERTAIN` não participa do retry administrativo genérico. `FAILED_CONFIGURATION` pode voltar à fila apenas por ação administrativa explícita depois da correção externa.

## 7. Inventário R2 parcial

A coleta continua paginada e limitada a 50.000 objetos por execução para não transformar um request Cloud Run em operação de duração ilimitada. A correção muda a semântica, não o limite operacional:

- inventário completo: percentual, nível e projeção podem ser calculados;
- inventário incompleto abaixo da referência: `Inventário incompleto`, percentual integral e projeção indisponíveis;
- inventário incompleto cujo mínimo observado já alcançou a referência: `Crítico`, ainda sem percentual integral;
- gráfico e crescimento de R2 usam somente snapshots integrais.

A interface informa “Pelo menos X bytes observados” e “Inventário parcial”.

## 8. Região e Node.js

A região histórica confirmada nos arquivos ativos do projeto é `us-west1`. O `cloudbuild.yaml` 0.7.1 usa esse valor e possui etapa inicial que recusa região vazia/inválida.

O lockfile raiz contém dependências travadas que exigem Node 22.22.2 ou linha posterior explicitamente compatível. Para não declarar suporte não comprovado, a 0.7.1 padroniza:

- raiz: `>=22.22.2 <23`;
- Worker: `>=22.22.2 <23`;
- Docker: `node:22.22.2-bookworm-slim`.

O runtime disponível para esta execução é Node 22.16.0, portanto inferior ao baseline final.

## 9. Dependência do Worker

A dependência local `olhos-do-campus: file:../../..` não era importada pelo Worker. Ela foi removida de `package.json` e do lockfile do Worker. Comparação estrutural entre os lockfiles 0.7.0 e 0.7.1 confirmou **zero mudanças de versão** nas dependências reais, tanto na raiz quanto no Worker.

## 10. Testes adicionados

Foram adicionados três arquivos de regressão e quatro casos ao teste de infraestrutura existente:

- `tests/preDeployment071.test.ts` — Artifact, migração, região, Node e Worker;
- `tests/fallbackDeletion071.test.ts` — cenários A–H de exclusão provider-aware;
- `tests/notificationDelivery071.test.ts` — categorias Resend, eventos fora de ordem, leases, `DELIVERY_UNCERTAIN`, webhook e retry administrativo;
- `tests/infrastructure070.test.ts` — inventário parcial abaixo/acima da referência e limite de 50.000 objetos.

A árvore contém 46 arquivos `tests/*.test.ts`, dos quais 2 são opt-in. A suíte 0.7.0 reportava 41 arquivos aprovados, 213 testes aprovados e 2 opt-in ignorados. Nenhum teste existente foi removido.

## 11. Limitação de validação neste ambiente

A instalação limpa não pôde ser concluída. O sandbox está em Node 22.16.0 e não resolve `registry.npmjs.org`/`nodejs.org`; o log do npm registra `getaddrinfo EAI_AGAIN`. A tentativa offline também falhou com `ENOTCACHED` porque os pacotes não estavam no cache.

Sem `node_modules`, os comandos obrigatórios foram invocados, mas typecheck/lint/Vitest/build/Firebase CLI não chegaram à validação do projeto. `npm audit` e `npm audit --omit=dev` também foram bloqueados pelo endpoint de rede. Java 21.0.11 está instalado; os testes de Emulator Suite foram bloqueados pela ausência do `firebase` CLI, consequência da instalação npm não materializada, e não por falta de Java.

Como validação auxiliar, 211 arquivos TS/TSX foram transpiliados individualmente pelo TypeScript global 5.8.3 sem erro sintático, `git diff --check` passou, JSON/YAML críticos foram parseados e verificações executáveis das funções puras de migração/estado passaram. Essas verificações **não substituem** o typecheck, lint, Vitest, build ou Emulator Suite oficiais.

Consequentemente, a 0.7.1 é uma entrega integral de código corrigido, mas **não pode ser classificada como candidata à implantação até que a bateria obrigatória seja repetida em ambiente com Node compatível e acesso ao registry npm**.

## 12. Segurança e dados

- nenhuma credencial real foi adicionada;
- `.env.example` continua apenas com nomes/placeholders;
- payload bruto de webhook continua não persistido;
- nenhuma descrição de ocorrência, chave de acompanhamento, fotografia, IP ou token foi adicionada a snapshots/outbox;
- Firestore/Storage client-side deny-all foram preservados;
- não houve deploy, envio real, migração real ou exclusão real de Artifact Registry.

## 13. Pendências externas

Dependem de recursos externos e não foram executadas:

- publicação Cloudflare Pages;
- deploy Cloud Run;
- publicação/configuração do Maintenance Worker e HMAC;
- Resend real, DNS, API key, remetente e webhook;
- R2 real e migração/verify de objetos reais;
- Artifact Registry real, snapshot e dry-run/apply da policy;
- configuração final de origens/domínios para Firebase Auth/App Check/CORS.

## 14. Riscos residuais

1. bateria npm oficial ainda não validada nesta execução;
2. runtime local 22.16.0 é inferior ao baseline 22.22.2;
3. inventário R2 acima de 50.000 objetos permanece um limite inferior por snapshot, deliberadamente sinalizado como parcial;
4. incerteza distribuída de entrega externa não pode ser eliminada; `DELIVERY_UNCERTAIN` exige reconciliação/webhook/análise;
5. policy do Artifact Registry só deve ser aplicada depois de dry-run no repositório real e confirmação das tags protegidas;
6. integrações reais ainda dependem de credenciais, contas, DNS, permissões e homologação manual.
