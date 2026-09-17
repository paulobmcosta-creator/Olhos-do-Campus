# Changelog


## [1.0.0] - 2026-09-15

### Promoção Formal e Alinhamento de Release
- **Promoção da Árvore Estável:** Elevação formal da árvore homologada do Ciclo 0.9.0 para a versão candidata canônica 1.0.0.
- **Sincronização de Identidade de Release:** Unificação estrita da versão `1.0.0` nos manifestos de pacote raiz (`package.json`, `package-lock.json`), configuração de runtime (`src/config/version.ts`), metadados institucionais (`metadata.json`, `firebase-blueprint.json`), tags de container de build (`cloudbuild.yaml`) e scripts de implantação canônica (`scripts/deployCloudRun.sh` com `CONFIRM_DEPLOY_1_0`).
- **Configuração e Alinhamento do Maintenance Worker:** Correção da versão de runtime do Cloudflare Maintenance Worker em `infra/cloudflare/maintenance-worker/src/index.ts` de `0.7.7` para `1.0.0`, sincronização do manifesto de dependências e configuração do `BACKEND_URL` canônico em `wrangler.jsonc` (`https://olhos-do-campus-hnwfymhsqq-uw.a.run.app`). Reconhecimento formal do estado pré-1.0 como `WORKER_ABSENT`, caracterizando o deploy futuro como `WORKER_DEPLOYMENT_TYPE=FIRST_TIME_PROVISIONING`.
- **Endurecimento do Verificador de Conformidade (`verifyRelease.mjs`):** Expansão do verificador de release para 13 truth points automatizados, incorporando a verificação estrita da versão emitida pelo endpoint de health do Maintenance Worker, do projeto de deploy do Cloud Run e do `vars.BACKEND_URL` do Worker contra placeholders ou URLs inválidas.
- **Suíte de Teste de Runtime e Configuração do Worker:** Ampliação dos testes automatizados com `WORKER_RUNTIME_VERSION_TEST` (health reporta status `ok`, componente `maintenance-worker` e versão `1.0.0`), `WORKER_CONFIG_CRONS_TEST` (validação estrita dos agendamentos `*/10 * * * *` e `15 3 * * *`) e `WORKER_CONFIG_NAME_TEST` (validação do nome `olhos-do-campus-maintenance`).
- **Revisão Documental Substantiva:** Reescrita completa do `README.md` refletindo a arquitetura em 3 componentes implantáveis, topologia com Firestore nomeado em `us-west1`, R2 privado, autenticação administrativa via Google Sign-In, rate limiting local associado à invariante de instância única e declaração formal de acessibilidade no escopo homologado.
- **Invariantes de Escopo Preservadas:** Nenhuma alteração funcional de negócio, nenhuma mudança de esquema ou modelo de dados, nenhuma migração adicional de banco de dados (`MIGRATION_080_ALREADY_APPLIED=YES`, `MIGRATION_080_REEXECUTION_FOR_1_0=NO`) e nenhuma alteração no grafo de dependências externas (`DEPENDENCY_GRAPH_CHANGED_BY_VERSION_SYNC=NO`).

## [0.9.0] - 2026-09-15

### Ciclo de Homologação, Observabilidade, Operações e Prontidão de Produção
- **Hardening de Segurança e Governança (Gate G.1):** Centralização de logs estruturados com redação de dados sensíveis e propagação de `X-Request-Id`; padronização do vocabulário institucional de privacidade ("registro sem identificação pessoal obrigatória").
- **Controle de Acesso RBAC e Menor Privilégio (Gate G.2):** Consolidação do papel `Atendente` e matriz de transições autorizadas com restrição de escopo a ocorrências atribuídas individualmente.
- **Fluxos Funcionais e Roteamento (Gate G.3):** Estabilização da triagem pela CGAO e fluxo completo de acolhimento, resposta e encerramento de ocorrências.
- **Acessibilidade e Usabilidade (Gate G.4):** Homologação pós-fix de acessibilidade nos formulários públicos e administrativos, navegação por teclado e semântica de modais.
- **Responsividade e Reflow UX (Gate G.5):** Otimização para múltiplos viewports (mobile, tablet, desktop) e validação responsiva dos painéis operacionais.
- **Operações, Observabilidade e Backup/Restore (Gate G.6 / G.6C / G.6C3):** Implementação de scripts seguros de backup e restore para Firestore e Cloudflare R2 com suporte a dry-run e rehearsals automatizados; implementação do *Scale Guard* (`checkScaleConfig.mjs`) para proteção da invariante `max-instances=1` atrelada a `RATE_LIMIT_SCOPE=INSTANCE_LOCAL`; ADR documentando a imutabilidade in-place do Firestore.
- **Regressão Integral e Homologação Técnica (Gate 0.9-H):** Execução integral das suítes de testes automatizados (unitários, integração, regras Firebase e emuladores), validação de tipos e lint com 100% de aprovação técnica.
- **Homologação Visual e Smoke de Interface (Gate 0.9-I):** Verificação de renderização, contraste e fluxos de tela em ambiente controlado.
- **Production Readiness e Implantação Controlada (Gate 0.9-J / J.1):** Implantação e corte de tráfego em produção no Cloud Run e Cloudflare Pages; execução de testes de fumaça (smoke) em produção; saneamento de credenciais e estabilização operacional com remediação imediata de permissões temporárias de IAM.

## [0.8.0] - 2026-08-28

### Adicionado
- **Papel Institucional de Atendente (Menor Privilégio):** Implementação formal do papel `Atendente` com 29 operações autorizadas restritas estritamente às ocorrências atribuídas individualmente (`assignedToAdminUserId === user.id`).
- **Visão "Minhas Ocorrências":** Listagem e contagem de ocorrências filtradas por atribuição individual para o Atendente; páginas globais e dados transversais permanecem inacessíveis.
- **Sete Transições de Status Autorizadas para Atendente:** Suporte operacional para transições `Em análise` $\rightarrow$ `Em atendimento`, `Encaminhada ao setor responsável` $\rightarrow$ `Em atendimento`, `Em atendimento` $\leftrightarrow$ `Aguardando material`, `Em atendimento` $\leftrightarrow$ `Aguardando contratação ou serviço externo`, e `Em atendimento` $\rightarrow$ `Resolvida`.
- **Audiência Restrita de Notas Internas (`RESPONSIBLE_TEAM`):** Atendentes visualizam exclusivamente notas com audiência de equipe responsável em ocorrências atribuídas a si próprios.
- **Equipe Inicial de Triagem e Acolhimento CGAO:** Criação da equipe institucional `team-cgao` (Coordenação Geral de Administração, Orçamento e Finanças), com notificação inicial automática para `cgao.bsf@ifes.edu.br`.
- **Notificações Institucionais de Roteamento:** Eventos `OCCURRENCE_TEAM_ROUTED` (encaminhamento para setor) e `OCCURRENCE_RESPONSIBLE_ASSIGNED` (atribuição para responsável individual) integrados ao outbox transacional.
- **Exclusão Segura e Reativação de Locais:** Verificação de histórico de ocorrências (`location` e `reportedLocation`) antes da exclusão física, retornando HTTP 409 com mensagem institucional quando o local já foi utilizado, e suporte a reativação de ambientes/blocos inativos.
- **60 Ambientes Institucionais Canônicos:** Reorganização e saneamento dos ambientes do Campus Barra de São Francisco (Bloco 01: 28, Bloco 02: 26, Bloco 03: 2, Externo: 4), sem pavimentos artificiais.
- **Scripts Operacionais e de Migração:** Scripts `scripts/migrate080.ts` (reconciliação de equipes e ativação da CGAO com suporte a `--dry-run` e `--apply`) e `scripts/cleanupArtificialLocations.ts` (conciliação de ambientes por allowlist com `--dry-run` e `--apply`).
- **Suítes de Testes 0.8.0:** Inclusão de `tests/attendantRole080.test.ts`, `tests/locationManagement080.test.ts`, `tests/teamRoutingNotifications080.test.ts`, `tests/migrate080.test.ts` e `tests/cleanupArtificialLocations.test.ts`.

### Corrigido
- **Filtragem de Locais Inativos no Portal Público:** O catálogo público de ambientes e blocos (`listActiveForPublic()`) omite estritamente locais inativos e blocos sem ambientes ativos, tanto no carregamento inicial quanto em novas sessões.
- **GD-F001 (Serialização de `templateData.teamName` no Outbox):** Correção da construção de `templateData` em `createResponsibleAssignedNotificationItem` para omitir chaves opcionais `undefined`, sanando erro fatal de serialização no Firestore Admin SDK sem habilitar `ignoreUndefinedProperties` globalmente.
- **Idempotência de Notificações em Mutações Recorrentes:** Chaves de idempotência incorporam versão do evento e identificadores de destino, diferenciando reatribuições sucessivas legítimas de retries acidentais.

## [0.7.7] - 2026-08-25

### Corrigido
- **Framing HTTP do NTLM Type 3 no EWS:** a requisição autenticada agora envia `Content-Length` calculado em bytes para corpos `string` ou `Buffer`, evitando que o Node utilize `Transfer-Encoding: chunked` no POST SOAP.
- **Sanitização de headers de transporte:** `Content-Length` fornecido externamente é substituído pelo comprimento real e `Transfer-Encoding` é removido na etapa autenticada para impedir framing ambíguo.
- **Regressão coberta por teste:** nova suíte `tests/ntlmHttpFraming077.test.ts` cobre UTF-8, `Buffer`, sobrescrita de comprimento incorreto, remoção case-insensitive de `Transfer-Encoding` e requisições sem corpo.

### Evidência operacional que motivou a correção
- A candidata 0.7.6 foi bloqueada no gate EWS real com `EWS_EMPTY_RESPONSE`.
- O diagnóstico read-only `GetFolder` retornou `400 Bad Request` sem corpo com a implementação original e `200 OK`, `ResponseClass=Success`, `ResponseCode=NoError` quando o mesmo Type 3 foi enviado com `Content-Length` explícito.
- Nenhum build/deploy da 0.7.6 bloqueada foi promovido para tráfego produtivo.

### Validação operacional da 0.7.7
- Node `v22.22.2` / npm `10.9.7`; `npm ci` concluído com 0 vulnerabilidades.
- TypeScript, lint, suíte principal (390 testes), Maintenance Worker e build local de produção aprovados.
- `GetFolder` read-only pela implementação corrigida retornou HTTP 200, `ResponseClass=Success` e `ResponseCode=NoError` sem workaround externo.
- Teste EWS real opt-in aprovado com 2/2 testes, incluindo `CreateItem` com `SendAndSaveCopy`.
- Recebimento humano confirmado para a mensagem de integração 0.7.7 enviada por `cgao.bsf@ifes.edu.br`.

## [0.7.6] - 2026-08-20

### EWS produtivo, preservação da semântica de notificações e correções operacionais

- **Provedor EWS institucional:** implementado `EwsEmailProvider` nativo para Exchange Web Services do IFES (`https://webmail.ifes.edu.br/EWS/Exchange.asmx`, domínio `UPD1`), utilizando autenticação NTLM/NTLMv2 pura sem dependências externas obsoletas ou vulneráveis.
- **Envelope SOAP CreateItem:** suporte a `SendAndSaveCopy`, `DistinguishedFolderId Id="sentitems"`, sanitização estrita de XML (`escapeXml`) e proteção contra XXE.
- **Generalização de EmailProvider:** suporte arquitetural aos provedores `ews` e `resend` com vinculação determinística por notificação (`item.provider`) e ausência de fallback automático silencioso (falhas de configuração são explícitas).
- **Semântica e Invariantes de Notificação:** preservação de `SAME_ATTEMPT`, `NEW_ATTEMPT`, `UNCERTAIN` e `DELIVERY_UNCERTAIN`. O sistema não fabrica `providerMessageId` fictício quando o EWS opera em `SendAndSaveCopy`.
- **Desacoplamento do Artifact Registry:** o script `scripts/artifactRegistrySnapshot.ts` foi desacoplado de `SERVER_ENV`, eliminando a dependência indevida de variáveis do Cloudflare R2 para execução de rotinas de snapshot.
- **Parser defensivo de bytes:** implementado `server/utils/artifactRegistryParser.ts`, garantindo validação de tamanho de imagens e fail-fast preventivo (rejeitando `bytes: 0` espúrio quando imagens estiverem presentes sem campo de tamanho).
- **Interface e Painel Administrativo:** atualização dos modelos, schemas Zod e painéis frontend (`NotificationSettingsPanel` e `AdminInfrastructurePage`) para refletir dinamicamente o provedor de e-mail ativo.
- **Suíte de Testes 0.7.6:** inclusão de testes unitários para parsing SOAP (`tests/ewsSoap.test.ts`), matriz completa de erros EWS (`tests/ewsEmailProvider.test.ts`), vinculação determinística de provedores (`tests/notificationProviderBinding076.test.ts`), parser do Artifact Registry (`tests/artifactRegistrySnapshot076.test.ts`) e teste opt-in com Exchange real (`tests/ewsIntegration.optIn.test.ts`).
- **Procedimento de Homologação e Promoção de Tráfego:** documentada a estratégia de implantação com `--no-traffic` e traffic tag determinística `--tag=ews076` para validação isolada do gate operacional EWS na URL da tag, substituição de `--to-latest` por promoção explícita `--to-tags=ews076=100` e roteiro de rollback imediato via `--to-revisions`. Nenhuma alteração de código funcional foi realizada nesta etapa.

## [0.7.5] - 2026-08-19

### Fechamento pós-homologação e Firestore Enterprise

- **Fonte de verdade:** consolidada a árvore `0.7.4-pos-homologacao`, já contendo as correções descobertas durante typecheck e Vitest no Cloud Shell.
- **Contrato HTTP:** formalizados os códigos `WEBHOOK_ATTEMPT_ID_INVALID` e `WEBHOOK_ATTEMPT_WITHOUT_NOTIFICATION` no modelo compartilhado e no parser do cliente.
- **Correlação Resend:** preservada a correção que impede `notification_id` e `providerMessageId` conflitantes de atualizarem silenciosamente a entrega errada, tanto no repositório Firestore quanto no in-memory.
- **Teste de Blob:** a validação de resposta protegida WebP verifica o contrato observável (`type` e `size`) sem depender de `instanceof Blob` entre realms Node/jsdom.
- **Firestore Enterprise:** removidos `fieldOverrides` incompatíveis e materializados seis índices DENSE de collection group `attempts` para `providerMessageId`, `providerAcceptedAt` asc/desc, `createdAt`, `status` e `attemptNumber`.
- **Regressão de infraestrutura:** adicionados testes específicos que impedem a reintrodução de `fieldOverrides` e validam a presença dos seis índices Enterprise.
- **Validação real:** Node 22.22.2, typecheck, lint, suíte principal, Worker, build, audits e Emulator Suite passaram no Cloud Shell; regras Firestore/Storage foram publicadas no projeto real.
- **Índices reais:** os seis índices `attempts` foram aceitos pelo Firestore Enterprise e observados em estado `CREATING`; a evidência fornecida não registrou ainda a transição dos seis para `READY`.

## [0.7.4] - 2026-08-19

### Correção cirúrgica pré-homologação — retry técnico Resend

- **Retry técnico vs. nova tentativa:** introduzida distinção explícita entre `SAME_ATTEMPT` e `NEW_ATTEMPT`; a repetição técnica preserva `attemptId`, `attemptNumber`, `attemptCount` e idempotency key.
- **`concurrent_idempotent_requests`:** o erro do Resend passa a agendar backoff da mesma DeliveryAttempt, sem criar A2/K2 prematuramente.
- **Erros ambíguos:** 5xx/408/status 0 estruturados pelo provider usam retry técnico dentro da janela segura de idempotência; exceções de transporte sem resposta conclusiva continuam em `UNCERTAIN`/`DELIVERY_UNCERTAIN`.
- **Quota/rate limit:** chamadas explicitamente rejeitadas pelo provider ficam diferidas na mesma tentativa, evitando inflação de `attemptCount`; retries técnicos têm limite próprio e backoff persistido.
- **Limite seguro:** `technicalRetryCount` é independente de `attemptCount`; exceder quatro retries técnicos ou a janela segura leva a tentativa a `UNCERTAIN`, sem criar nova tentativa automaticamente.
- **Webhooks:** confirmação externa durante o backoff cancela o retry técnico e mantém a máquina de estados monotônica.
- **Consumo:** chamadas HTTP técnicas da mesma DeliveryAttempt não criam novas unidades; somente tentativas distintas efetivamente aceitas pelo provider são contabilizadas separadamente.
- **Preservação:** sem dependências novas, serviços novos ou alterações em R2, Artifact Registry cleanup, Pages/Cloud Run, regras de acesso ou baseline Node.
- **Testes:** adicionada cobertura específica para same-attempt retry, 5xx, timeout, quota, nova tentativa confirmada, contadores, concorrência, webhook durante backoff, idempotency key e consumo.

## [0.7.3] - 2026-08-18

### Correção final pré-homologação — delivery attempts

- **Delivery attempts:** `notificationOutbox/{notificationId}` permanece como intenção lógica e cada chamada externa passa a ser materializada antes do envio em `attempts/{attemptId}`, com identidade, número, status, idempotency key e histórico próprios.
- **Tags Resend:** cada envio inclui `notification_id` e `attempt_id`; a sintaxe do Resend continua encapsulada no provider e nenhum identificador técnico contém PII, protocolo, tracking key ou conteúdo da ocorrência.
- **Correlação attempt-aware:** webhooks priorizam `notification_id + attempt_id`, depois `providerMessageId → attempt`, preservando fallback para mensagens 0.7.2 sem `attempt_id` e `providerMessageId` legado na outbox.
- **Retry sem falso conflito:** P1 da tentativa A1 não é comparado contra P2 da A2. Um webhook rápido de A2 pode estabelecer P2 diretamente na tentativa ainda `PROCESSING`; divergência dentro da mesma tentativa continua sendo conflito real.
- **Concorrência:** criação/numeração da nova tentativa ocorre dentro do claim transacional; recuperação técnica da mesma lease reutiliza a mesma tentativa/idempotency key, e writes tardios não rebaixam estados confirmados por webhook.
- **Entrega incerta:** exceção de transporte sem resposta conclusiva mantém a tentativa corrente `UNCERTAIN`, sem presumir aceite nem criar retry automático; confirmação posterior por webhook resolve a tentativa e a outbox.
- **Estado agregado:** somente a tentativa corrente altera o estado agregado da outbox; webhooks tardios de tentativas anteriores atualizam o histórico da própria tentativa sem rebaixar uma entrega posterior já confirmada.
- **Consumo Resend:** a referência diária/mensal passa a contar tentativas individualmente aceitas pelo provedor. A1 aceita + A2 aceita = duas unidades; delivery/replay não incrementam novamente. Aceites legados 0.7.2 continuam contabilizados durante a compatibilidade lazy.
- **Compatibilidade 0.7.2:** documentos sem subcoleção de attempts continuam legíveis; ao ocorrer retry em documento legado com aceite conhecido, a última tentativa histórica conhecida é materializada de forma lazy, sem migração destrutiva.
- **Índices:** adicionados somente os índices de collection group `attempts` e de compatibilidade `schemaVersion + providerAcceptedAt` realmente usados por correlação e métricas.
- **Testes:** adicionada suíte 0.7.3 para primeira/segunda tentativa, webhook rápido A2, webhook tardio A1, conflitos reais, fallback legado, idempotência por tentativa, concorrência, consumo por tentativa, resultado externo incerto e materialização lazy 0.7.2.

## [0.7.2] - 2026-08-18

### Correção residual pré-implantação

- **Correlação Resend:** cada envio passa o ID lógico determinístico da outbox ao provider; o Resend o materializa somente como tag técnica `notification_id`, sem e-mail, protocolo, chave, descrição ou outro dado pessoal.
- **Webhooks:** correlação passa a priorizar `notification_id` e mantém fallback por `providerMessageId` para mensagens anteriores/transicionais. Evidências conflitantes geram `INCONSISTENT` e não atualizam silenciosamente outra entrega.
- **Unmatched:** webhook válido sem correlação não é mais descartado; o mesmo documento do evento permanece `UNMATCHED_PENDING`, com `attemptCount`, `nextAttemptAt`, backoff limitado, expiração controlada e retenção técnica.
- **Manutenção:** o endpoint já usado pelo Maintenance Worker processa a outbox e reconcilia webhooks pendentes em lotes, sem conceder ao Worker acesso direto ao Firestore e sem introduzir novo serviço.
- **Concorrência:** webhook correlacionado pode resolver `DELIVERY_UNCERTAIN`; `markSent` e `markDeliveryUncertain` tardios continuam condicionados à lease `PROCESSING` e não rebaixam estados confirmados.
- **Consumo Resend:** referências e indicadores passam a contar uma unidade lógica por outbox com `providerAcceptedAt`, sem dupla contagem quando também existe `sentAt`; aceites e entregas são exibidos separadamente.
- **Observabilidade:** painel administrativo mostra webhooks não correlacionados pendentes e alerta quando o mais antigo ultrapassa o limiar operacional.
- **Artifact Registry:** o painel passa a descrever o valor observado como estimativa/soma lógica aproximada das imagens, explicitando que camadas compartilhadas podem fazer o valor divergir do armazenamento faturado.
- **Índices:** adicionados somente os índices de `notificationWebhookEvents` necessários para reconciliação, observação do evento pendente mais antigo e retenção terminal.
- **Testes:** adicionada cobertura específica para tag, correlação direta/fallback/conflito, corridas webhook × persistência, unmatched/reconciliação/expiração, resolução de `DELIVERY_UNCERTAIN`, consumo lógico e terminologia do Artifact Registry.

## [0.7.1] - 2026-08-18

### Correções pré-implantação

- **Artifact Registry:** cleanup passou a alcançar versões antigas mesmo quando tagueadas automaticamente, preservando tags explícitas `release-`, `keep-` e `rollback-` e as 10 versões mais recentes; dry-run e confirmação destrutiva continuam obrigatórios.
- **Storage → R2:** `--verify` agora exige cobertura integral dos objetos elegíveis e separa listados, elegíveis, ignorados justificadamente, verificados, ausentes, divergentes, falhas e paths rejeitados; qualquer lacuna produz exit code não zero e impede exclusão da origem.
- **Fallback de fotografias:** exclusões de domínio durante a transição são provider-aware e alcançam R2 e Firebase Storage legado; falhas parciais produzem cleanup idempotente por provider.
- **Resend:** `email.failed` deixou de virar supressão genericamente; quota, transiente, configuração, destinatário inválido, supressão e falha desconhecida recebem estados/categorias explícitos e seguros.
- **Webhooks Resend:** máquina de estados monotônica usa timestamp do provedor e precedência explícita; estados terminais não regridem por eventos tardios.
- **Semântica de entrega:** documentação e código deixam de pressupor exactly-once; a outbox mantém intenção determinística, entrega externa at-least-once, deduplicação local e idempotência adicional do provedor dentro de sua janela. `DELIVERY_UNCERTAIN` bloqueia retry automático quando a confirmação local não é segura.
- **Inventário R2:** snapshots parciais não produzem percentual ou projeção integrais; abaixo da referência ficam `Inventário incompleto`, e um limite inferior já acima da referência pode sinalizar `Crítico`. Crescimentos e gráficos usam somente inventários completos.
- **Região:** `cloudbuild.yaml` voltou a `us-west1`, coerente com o ambiente histórico, e valida `_REGION` antes do build.
- **Node.js:** baseline harmonizada em Node `>=22.22.2 <23`, com Docker `22.22.2`, package/lockfiles e Worker coerentes.
- **Worker:** removida a dependência local não utilizada do projeto raiz; lockfile atualizado.
- **Testes:** adicionados testes específicos para cleanup tagueado, verificação 100/100 e 99/100, hash/tamanho, fallback A–H, falhas/webhooks Resend, entrega incerta e inventário R2 acima/abaixo do limite.

## [0.7.0] - 2026-08-18

### E-mail transacional

- Integração real com Resend pelo backend, remetente validado, webhook assinado e painel administrativo de status, teste e reprocessamento.
- Outbox Firestore criada na mesma transação da ocorrência `REAL`, com uma entrega por destinatário, identidade determinística baseada em hash e idempotency key do provedor.
- Claims transacionais com lease para concorrência no Cloud Run, backoff limitado, classificação de erros permanentes/transitórios/quota/supressão e estados de delivered, bounced e complained.
- Payload e logs minimizados, sem chave de acompanhamento, descrição, fotografia, IP ou lista de destinatários.

### Fotografias e Cloudflare R2

- Cloudflare R2 privado passa a ser o armazenamento produtivo obrigatório; Firebase Storage fica restrito a emulador e fallback legado temporário de leitura.
- Repositório R2 com AWS SDK v3, headers privados, paginação, metadata e exclusão idempotente.
- Migração Storage → R2 em dry-run/apply, verificação de integridade e exclusão da origem em procedimento separado com confirmação forte.
- Reconciliação R2 × Firestore paginada, proteção de inventário incompleto/janela de segurança e cleanup persistente para compensações.

### Hospedagem e manutenção

- Build separado para Cloudflare Pages e Cloud Run; Cloud Run torna-se API only e deixa de servir o frontend em produção.
- Fallback SPA e headers de segurança compatíveis com Pages; CORS de produção passa a exigir origens HTTPS exatas e sem wildcard.
- Maintenance Worker com cron em UTC e assinatura HMAC para processar notificações e snapshots, preservando comandos manuais do Administrador.

### Infraestrutura e capacidade

- Nova página exclusiva do Administrador com indicadores agregados de R2, Firestore, Resend, cleanup, reconciliação e Artifact Registry.
- Snapshots diários idempotentes, histórico 30/90/365 dias, crescimento e projeções sinalizadas como estimativas.
- Referências operacionais configuráveis, verificadas inicialmente em 2026-08-18, e níveis Normal/Atenção/Alerta/Crítico sem bloqueio automático.
- Política revisável do Artifact Registry, dry-run obrigatório antes de apply e snapshot por script externo sem ampliar permissões do Cloud Run.

### Segurança, documentação e testes

- Firestore/Storage client-side continuam deny-all; novas coleções administrativas permanecem server-only.
- Endpoints internos usam HMAC com janela antirreplay; Resend e R2 permanecem exclusivamente no backend.
- Metadados, blueprint, exemplos de ambiente, documentação operacional, migração, implantação e homologação atualizados para 0.7.0.
- Cobertura adicionada para outbox, Resend, R2, reconciliação, Pages/CORS, capacidade, Worker, assinatura de manutenção e transação Firebase.

## [0.6.2] - 2026-08-17

### Corrigido

- Corrigida incompatibilidade entre o runtime do backend e o schema de bootstrap do frontend após o hotfix 0.6.1.
- `RuntimeInfo.version` e `bootstrapResponseSchema` agora derivam diretamente de `APP_VERSION`, eliminando o literal residual `0.6.0` que fazia `/api/config` ser rejeitado no Preview.
- A página inicial e a geração de `policyVersion` do SLA deixaram de hardcodar a versão ativa.
- Testes de coerência de versão foram refatorados para usar `APP_VERSION`.
- Adicionado teste de regressão `bootstrapContractVersion062.test.ts`.

### Preservado

- Mantida integralmente a correção de empacotamento da 0.6.1 (`npm prune --omit=dev` após o build).
- Nenhuma alteração em modelos persistidos, permissões, Firestore, Storage, App Check, SLA histórico, categorias, locais, equipes ou fluxos de ocorrência.

## [0.6.1] - 2026-08-17

### Publicação e empacotamento
- Corrige o empacotamento de produção do AI Studio/Cloud Run sem alterar funcionalidades da aplicação.
- Adiciona `scripts/prepareProductionPackage.mjs` como etapa final do `npm run build`.
- Executa `npm prune --omit=dev --no-audit --no-fund` somente depois de Vite e esbuild concluírem a compilação, removendo ferramentas de desenvolvimento do `node_modules` que será empacotado.
- Remove defensivamente `bun.lock` e `bun.lockb` caso sejam gerados pelo ambiente, preservando npm + `package-lock.json` como mecanismo oficial do projeto.
- A preparação falha explicitamente se o prune não concluir, impedindo a geração silenciosa de pacote inconsistente.
- Adiciona teste de regressão específico para preservação de dependências de produção, remoção de dependências de desenvolvimento e remoção dos lockfiles Bun.

### Diagnóstico que motivou o hotfix
- A tentativa de Publish gerou `build_artifacts.tar.gz` com 249.560.700 bytes e 39.388 entradas em `node_modules`.
- O arquivo gerado pelo AI Studio foi comprovadamente truncado (`gzip: unexpected end of file`; `tar: Unexpected EOF in archive`) e o Cloud Run retornou `The provided source archive is corrupted.`
- A correção não modifica controllers, services, repositories, models, páginas, Firebase, SLA, permissões ou regras de negócio da 0.6.0.

## [0.6.0] - 2026-08-16

### Base e governança
- Implementação realizada sobre o ZIP 0.5.1 por autorização expressa do usuário, substituindo a trava originalmente escrita para 0.5.2; nenhuma reconstrução intermediária da 0.5.2 foi presumida.
- Versão ativa atualizada em package, lockfile, metadata, RuntimeInfo, health endpoint, README, Blueprint e documentação.

### Administração e autorização
- Papéis ativos reduzidos a Administrador e Gestor.
- `Atendente` mantido somente como valor legado detectável e bloqueado; resolução explícita por Administrador para conversão em Gestor ou inativação.
- Equipes/setores responsáveis, associação de membros e responsável individual opcional.
- Separação de funções estruturais exclusivas do Administrador e funções operacionais disponíveis ao Gestor.

### Ocorrências
- Preservação imutável de `reportedCategory*` e `reportedLocation`, com categoria/local atuais corrigíveis mediante justificativa.
- Risco imediato inicia prioridade Urgente; prioridade padrão sem risco permanece Normal; Emergencial é classificação administrativa.
- `closedAt` para todo encerramento terminal e `resolvedAt` exclusivo de Resolvida.
- Novos eventos de categoria, local, prioridade, equipe, responsável, pausa/retomada de SLA e reabertura.
- Observações internas com audiências `ADMIN_ONLY`, `ADMINS_AND_MANAGERS` e `RESPONSIBLE_TEAM`.
- Classificação explícita `REAL | TEST`; expurgo físico somente de TEST por Administrador, com auditoria preservada.

### SLA e calendário
- Calendário de horas úteis em `America/Sao_Paulo`, padrão segunda–sexta 09:00–19:00, com exceções de feriado, recesso, suspensão e horário especial.
- SLA de primeira resposta por prioridade; primeira resposta passa a ser a primeira mudança de situação visível publicamente.
- SLA-base de conclusão por categoria, multiplicadores por prioridade, snapshot histórico da política/calendário e estado de proximidade de 20%.
- Pausa de SLA efetivo em Aguardando material e Aguardando contratação ou serviço externo, sem interromper o tempo total.
- Recalibração de categoria/prioridade sem reinício do relógio e preservação do resultado histórico da primeira resposta.

### Dados de referência
- Carga institucional de 60 ambientes: Bloco 01 (28), Bloco 02 (26), Bloco 03 (2) e Externo (4), sem pavimentos inventados.
- Seed aditivo/idempotente dos ambientes e defaults de SLA/calendário.
- Migração 0.6 explícita, dry-run por padrão e sem promoção automática de papéis legados.

### Painel, consultas e relatórios
- Paginação por cursor com 25/50/100 registros, filtros administrativos e ordenações operacional, recente, antiga, prioridade, SLA e protocolo.
- Dashboard operacional enxuto com polling de 60 segundos e atualização manual não destrutiva.
- Painel analítico em `/administracao/indicadores` com período padrão de 30 dias, médias, medianas, cumprimento de SLA e distribuições.
- Auditoria global paginada e exclusiva do Administrador.
- Exportações CSV, XLSX e PDF com limite de 2.000 registros e evento `REPORT_EXPORTED`.

### Segurança e qualidade
- Firestore e Storage continuam deny-all para clientes Web; Firebase Admin permanece server-only.
- Auth, App Check, protocolo + chave fora da URL, EXIF removal e optimistic locking preservados.
- Testes de regressão ampliados para SLA, calendário, espaços institucionais, paginação, exportação, audiência e permissões.
- Corrigida a documentação ativa que ainda descrevia a matriz de papéis e locais demonstrativos da série 0.5.x.

## [0.5.1] - 2026-08-16

### Segurança e dependências
- Atualiza `sharp` de 0.34.1 para 0.35.3, incluindo libvips corrigido para os advisories reportados na cadeia de processamento de imagens.
- Adiciona defesa em profundidade: bloqueio de loaders GIF/TIFF/VIPS no libvips e validação prévia de assinatura binária para aceitar somente JPEG, PNG e WebP antes da decodificação.
- Fixa `uuid` 11.1.1 especificamente sob `gaxios` e `teeny-request`, sem downgrade do Firebase Admin SDK.
- Fixa `@opentelemetry/core` 2.8.0 na árvore de desenvolvimento do Firebase CLI.
- Atualiza `nanoid` transitivo para 3.3.18 no lockfile.

### Correções
- Corrige a tipagem estrita do `Content-Type` entregue ao Busboy.
- Remove propriedade privada não utilizada no repositório de tarefas de limpeza.
- Separa `storageIntegration.test.ts` da suíte unitária ordinária; a integração continua coberta por `npm run test:storage`.
- Executa as suítes HTTP multipart e Firebase/Storage em ambiente Vitest `node`, evitando incompatibilidades do `FormData`/`import.meta.url` sob `jsdom`, e torna o setup global seguro nos dois ambientes.
- Atualiza o teste de regras do Storage para a API atual, sem atribuir propriedades getter-only do SDK compat.

### Compatibilidade
- Mantém a arquitetura, modelo de dados, regras server-only, protocolo/chave, papéis administrativos e ciclo de fotografias homologados na 0.5.0.

## [0.5.0] - 2026-08-13

### Fotografias e Cloud Storage
- Substituído o armazenamento temporário em memória por Cloud Storage for Firebase acessado exclusivamente pelo Firebase Admin SDK.
- Criada resolução segura do bucket por variável de ambiente, configuração do AI Studio compatível com o projeto ativo ou bucket local do Emulator Suite.
- Auth, Firestore e Storage Emulator passam a ser exigidos conjuntamente em modo local.
- Upload público e administrativo migrado de Data URL/JSON para `multipart/form-data`, com até três fotografias por conjunto e 8 MB por arquivo recebido.
- Adicionado processamento autoritativo com `sharp`: detecção/decodificação, limite de pixels, auto-orientação, redimensionamento, reencodificação WebP, miniatura e SHA-256.
- A nova codificação não preserva EXIF, GPS, XMP, IPTC, comentários nem nome original.
- Criada subcoleção `occurrences/{id}/photos/{photoId}` e tarefas persistentes `storageCleanupTasks`.
- Criados eventos `PHOTO_ADDED`, `PHOTO_DELETED` e `PHOTO_VISIBILITY_CHANGED`.
- Fotografias iniciais são internas; fotografias de solução também nascem internas e só Administrador/Gestor podem torná-las públicas.
- Criados endpoints protegidos para streaming público e administrativo sem signed URL permanente e sem chave de acompanhamento em URL.
- Exclusão passou a ser lógica no Firestore e física compensada no Storage; falhas físicas geram cleanup idempotente.
- Operações administrativas de fotografia participam do optimistic locking da ocorrência.

### Frontend
- Formulário público suporta câmera/galeria, até três imagens, pré-visualização, remoção, revisão de quantidade e upload multipart.
- Processamento preliminar no navegador produz WebP/Blob e Object URLs temporárias, revogadas quando não são mais necessárias.
- Detalhe administrativo recebeu galeria separada entre fotografias do registro e da solução, com miniaturas protegidas e ações por papel.
- Consulta pública exibe somente fotografias de solução explicitamente públicas.

### Segurança
- `storage.rules` permanece deny-all para clientes Web; `firestore.rules` também nega acesso direto às subcoleções de fotos e tarefas de cleanup.
- Removidos contratos ativos `photoDataUrl`/`solutionPhotoDataUrl` e flags/repositórios de armazenamento temporário.
- Limite de `express.json` reduzido para payloads JSON ordinários.
- Paths, bucket, checksum e identificadores administrativos não são expostos nos DTOs de fotografia.

### Testes e documentação
- Adicionados testes de processamento de imagem e fixtures sintéticas com EXIF/GPS/XMP.
- Adicionados testes de Storage Repository, compensação/cleanup, APIs públicas/administrativas, frontend, rules e integração Firestore + Storage.
- Adicionado `npm run storage:cleanup` e `npm run test:storage`.
- Documentação atualizada para arquitetura, Firebase/AI Studio, Storage, processamento, política de fotografias, metadados, segurança, órfãos, testes e inspeção final.

### Validação da base 0.4.1
- A etapa zero foi reexecutada. O ambiente de produção desta entrega não foi alterado nem recebeu deploy. Resultados efetivos e limitações da instalação npm estão registrados em `docs/TESTES_0.5.0.md`.

Todas as alterações relevantes do projeto são registradas neste arquivo.

## [0.4.1] — 2026-08-13

### Corrigido

- Preview do Google AI Studio deixou de cair no projeto fictício `olhos-do-campus-local` quando o Emulator Suite não está ativo;
- Firebase Admin SDK passou a selecionar explicitamente o banco Firestore nomeado provisionado pelo AI Studio;
- frontend passou a utilizar `firebase-applet-config.json` como fallback de configuração pública fora do Emulator, evitando tentativa de autenticação em `127.0.0.1` no Preview;
- `firebase:bootstrap-admin`, seed de referência e seed demonstrativo passaram a operar sobre o mesmo `firestoreDatabaseId` resolvido pelo servidor;
- `firebase-blueprint.json` foi alinhado ao domínio real da 0.4.x, removendo campos/estados inexistentes como `title`, `locationId`, `assignedTo`, `REGISTRADA` e `sequence`;
- teste de regras do Storage voltou a comprovar escrita negada, além de leitura e listagem negadas.

### Adicionado

- `server/config/firebaseRuntime.ts`, responsável por carregar somente os identificadores não secretos necessários de `firebase-applet-config.json` e resolver projeto/banco de forma testável;
- `FIRESTORE_DATABASE_ID` como override explícito do banco Firestore;
- `firebase.ai-studio.json`, configuração dedicada de regras e índices para o databaseId nomeado provisionado pelo AI Studio;
- testes unitários de resolução de projeto/banco e do fail-fast do projeto local sem Emulator;
- documentação específica da integração Firebase/AI Studio 0.4.1.

### Alterado

- versão atualizada para 0.4.1 em package, lockfile, metadata, runtime, health, validadores e documentação ativa;
- `firebase.json` continua reservado ao fluxo local/Emulator; deploy de regras do banco nomeado utiliza configuração separada;
- App Check continua desabilitável apenas fora de produção; site key é exigida pelo frontend somente quando App Check estiver habilitado.

### Removido

- `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` de `metadata.json`; o sistema não depende de execução Gemini para funcionamento ordinário.

## [0.4.0] — 2026-08-10

### Adicionado

- persistência real do domínio de ocorrências no Cloud Firestore por repositórios especializados e assíncronos;
- coleção `protocolCounters/{year}` e criação transacional de protocolo, ocorrência e evento inicial;
- derivação da chave de acompanhamento com `scrypt`, salt aleatório por ocorrência e comparação com `timingSafeEqual`;
- endpoint público `POST /api/occurrences/track`, com protocolo e chave no corpo da requisição;
- DTO público por lista positiva de campos, sem atribuição administrativa, prioridade, IDs internos, autores administrativos, observações internas ou material criptográfico;
- subcoleção append-only `occurrences/{occurrenceId}/events/{eventId}` com visibilidades `PUBLIC` e `INTERNAL`;
- máquina formal de estados, resolução e reabertura explícita por Administrador ou Gestor;
- integridade de duplicidade, incluindo referência existente, autorreferência proibida e prevenção transacional de ciclos;
- atribuição administrativa por `assignedToAdminUserId` estável, vinculada a `adminUsers`;
- optimistic locking por `version` e `expectedVersion`, com HTTP 409 em conflito concorrente;
- persistência Firestore de categorias, localizações hierárquicas e `systemSettings/operational`;
- snapshots de categoria e localização dentro da ocorrência;
- abstração `PhotoRepository`, com implementação temporária em memória somente para desenvolvimento/emulador e implementação desabilitada para os demais ambientes;
- scripts `firebase:seed-reference-data` e `firebase:seed-demo-data` com proteções contra execução acidental fora do Emulator Suite;
- agregações Firestore para os indicadores que podem ser calculados corretamente nesta versão e sinalização explícita das métricas indisponíveis;
- limite operacional de 100 ocorrências por listagem e sinalização `truncated`;
- testes unitários, de API, regras e integração preparados para concorrência de protocolo, persistência, visibilidade, papéis, duplicidade e concorrência otimista;
- documentação específica de modelo Firestore, histórico, fluxo de situações, protocolo/chave, dados de referência, migração, segurança, implementação, testes e inspeção final.

### Alterado

- ocorrências, protocolos, histórico, categorias, localizações e configuração operacional deixaram de utilizar `InMemoryDatabase` como fonte de verdade;
- `GET /api/admin/occurrences`, `GET /api/admin/occurrences/:id`, `PATCH /api/admin/occurrences/:id` e `GET /api/admin/stats` passaram a operar sobre Firestore;
- `PATCH /api/admin/occurrences/:id` passou a exigir `expectedVersion`;
- a configuração pública passou a expor somente a denominação institucional exibida e o aviso de serviço; parâmetros administrativos completos são consultados em rota restrita ao Administrador;
- a atribuição deixou de aceitar nome, e-mail ou UID como identificador de responsável;
- datas persistidas do domínio passaram a utilizar `Timestamp` do Firestore e são serializadas para ISO 8601 somente na API;
- o significado de modo demonstrativo foi removido do runtime de ocorrências; demonstração passou a designar apenas dados carregados por seed explícito;
- o banner de demonstração foi substituído por aviso específico de armazenamento temporário de fotografias;
- a interface pública desabilita anexos quando não há armazenamento temporário habilitado, evitando perda silenciosa;
- a consulta administrativa informa quando filtros secundários foram aplicados sobre uma leitura truncada;
- versão atualizada para 0.4.0 em `package.json`, `package-lock.json`, `metadata.json`, `src/config/version.ts`, health/runtime e documentação.

### Corrigido — defeitos herdados da 0.3.0

- `server/config/env.ts` deixou de fixar a porta 3000 e passou a ler/validar `process.env.PORT`, mantendo 3000 somente como padrão de desenvolvimento;
- a chave de acompanhamento deixou de trafegar em query string;
- a visão pública deixou de ser construída por `Omit` e não transporta mais `assignedTo`;
- indicadores deixaram de usar uma lista operacional truncada como se representasse o total institucional;
- documentação e matriz de permissões deixaram de mencionar compatibilidade de atribuição por dados livres provenientes da antiga memória.

### Removido

- `server/repositories/inMemoryDatabase.ts`;
- `server/repositories/initialData.ts` do runtime;
- utilitário público baseado em exclusão de campos (`src/utils/publicOccurrence.ts`);
- endpoint legado de acompanhamento `GET /api/occurrences/:protocol` com chave em query string;
- `ENABLE_DEMO_MODE` e o conceito de persistência de ocorrências em memória;
- carga automática de ocorrências demonstrativas no runtime.

### Mantido fora do escopo

- Cloud Storage definitivo, múltiplas fotografias, miniaturas, fotografia de solução e política de retenção;
- Cloud Functions, Trigger Email, SMTP e envio real de e-mail;
- rate limiting definitivo;
- paginação completa, pesquisa textual avançada e filtros escaláveis de alta cardinalidade;
- relatórios avançados, revisão visual geral, revisão WCAG 2.2 AA completa e CI/CD de produção.

### Observação de validação

A validação final desta entrega está registrada em `docs/TESTES_0.4.0.md`, com os comandos efetivamente executados, códigos de saída e limitações do ambiente. Nenhum teste bloqueado por instalação de dependências é tratado como aprovado.

## [0.3.0] — 2026-08-05

### Adicionado

- duas aplicações Firebase nomeadas e independentes para autenticação pública e administrativa;
- Firebase Authentication anônima silenciosa para o fluxo público;
- Google Sign-In administrativo com popup, fallback por redirecionamento e logout real;
- Firebase Admin SDK inicializado de forma idempotente com Application Default Credentials ou emuladores;
- verificação de Firebase ID Token e do provedor de autenticação no backend;
- autorização administrativa pelo Firestore na coleção `adminUsers`;
- vínculo transacional do primeiro UID Firebase ao cadastro previamente autorizado;
- gestão de usuários administrativos por API protegida e interface restrita ao papel Administrador;
- auditoria mínima de login e gestão de acesso na coleção `auditLogs`;
- proteção transacional contra inativação ou rebaixamento do último Administrador ativo;
- matriz efetiva de permissões para Administrador, Gestor e Atendente;
- Firebase App Check com reCAPTCHA Enterprise para produção;
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules` e Firebase Emulator Suite;
- script `firebase:bootstrap-admin` com validação de domínio, dry-run, emulador e proteção contra sobrescrita acidental;
- testes de autenticação, autorização, papéis, App Check, regras, emuladores, interface e políticas estáticas;
- documentação completa de configuração, autenticação, autorização, App Check, emuladores, regras, permissões e primeiro Administrador.

### Alterado

- versão centralizada em `src/config/version.ts` e atualizada para 0.3.0;
- cliente HTTP passou a anexar automaticamente o ID Token correto e o token App Check;
- rotas públicas de registro e acompanhamento passaram a exigir sessão anônima Firebase válida;
- APIs administrativas passaram a exigir Google, e-mail verificado, domínio permitido, cadastro ativo e papel proveniente do servidor;
- atualização de ocorrência passou a filtrar campos por papel e a ignorar papel ou autor declarados pelo cliente;
- Atendente passou a visualizar somente ocorrências atribuídas e não pode alterar prioridade ou responsável;
- runtime passou a declarar Firebase integrado, autenticação anônima, login Google, autorização Firestore e persistência temporária em memória;
- modo demonstrativo passou a se limitar aos dados e à persistência temporária das ocorrências;
- interface de configurações passou a oferecer gestão real de usuários e consulta de auditoria somente ao Administrador;
- `.env.example` e `.gitignore` foram ampliados para configuração por ambiente e exclusão de credenciais, logs e exportações locais.

### Corrigido

- divergência documental da versão 0.2.0: o relatório informava remoção de `bun.lock`, mas o ZIP efetivamente o continha;
- conflito de sessão entre autenticação pública e administrativa por meio de instâncias Firebase e persistências independentes;
- possibilidade de confiar em perfil, papel, nome, departamento ou autor enviados pelo navegador;
- atualização excessiva de `lastAuthorizedLoginAt`, agora limitada à verificação explícita da sessão administrativa;
- inicialização concorrente da autenticação Firebase no frontend, agora protegida por promessa idempotente;
- documentação anterior que descrevia autenticação administrativa demonstrativa como ativa.

### Removido

- `bun.lock`;
- endpoints `/api/auth/demo-users` e `/api/auth/login`;
- `INITIAL_ADMIN_USERS`;
- tokens artificiais com prefixo `demo-`;
- seleção de perfis administrativos simulados;
- armazenamento manual de sessão administrativa no navegador;
- `DemoAdminRoute` e qualquer fallback local de autenticação.

### Mantido fora do escopo

- persistência de ocorrências, protocolos e históricos no Firestore;
- Cloud Storage para fotografias;
- Cloud Functions, Trigger Email, SMTP e notificações reais;
- contador transacional de protocolos, hash persistente da chave e rate limiting definitivo;
- implantação em produção, CI/CD e revisão final WCAG 2.2 AA.

### Observação de validação

A configuração em nuvem permanece pendente de dados institucionais não secretos. A execução de `npm ci` e dos testes dependentes do Firebase CLI deve ser realizada em ambiente cujo registro npm contenha as dependências declaradas. Os resultados efetivos deste ambiente constam em `docs/TESTES_0.3.0.md`.

## [0.2.0] — 2026-08-05

### Adicionado

- identidade pública “Olhos do Campus” e nome administrativo oficial;
- arquivos oficiais horizontal e vertical do IFES — Campus Barra de São Francisco;
- React Router com URLs reais, página não encontrada e preparação de rotas administrativas;
- link de salto, foco no conteúdo após navegação, títulos por rota e melhorias básicas de acessibilidade;
- servidor Express modularizado em controladores, rotas, middlewares, repositório, serviços, tipos, utilitários e validadores;
- rota de saúde em `/api/health`;
- contratos HTTP validados no frontend;
- saneamento defensivo de metadados EXIF, XMP, IPTC e comentários antes da persistência temporária de fotografias;
- validação de entrada com Zod no frontend e backend;
- modo demonstrativo explicitamente configurável e identificado visualmente;
- ESLint, Vitest, ambiente de testes React e testes obrigatórios;
- documentação de identidade, arquitetura, modo demonstrativo, ativos, testes e implementação;
- `package-lock.json` no formato npm lockfile v3.

### Alterado

- TypeScript configurado em modo estrito, com verificações adicionais de nulidade, índices, retornos, parâmetros e variáveis não utilizadas;
- navegação por estado substituída por rotas reais;
- cliente HTTP alterado para preservar erros e validar respostas;
- formulário público reorganizado em seis etapas com terminologia institucional;
- confirmação pública alterada para “Ocorrência registrada”;
- configurações demonstrativas passaram a refletir avisos na página inicial e a denominação institucional no rodapé;
- protocolo normalizado para o formato `INF-AAAA-NNNNNN`;
- indicadores administrativos passaram a ser calculados sobre dados demonstrativos e identificados como tais;
- gerenciamento oficial de dependências migrado para npm.

### Corrigido

- duplicação do ano no protocolo;
- geração e saneamento do prefixo;
- afirmações indevidas sobre envio de e-mail;
- promessas indevidas de anonimato;
- QR Code decorativo removido e substituído por informação explícita de indisponibilidade;
- exposição potencial de observações internas na visão pública;
- fallback silencioso que convertia falhas HTTP em sucesso local;
- divergências terminológicas e de identidade institucional.

### Removido

- lockfile do gerenciador anterior;
- dependências e referências residuais de recursos generativos;
- biblioteca de animação sem uso;
- servidor monolítico original;
- componentes antigos substituídos pela arquitetura modular;
- QR Code meramente visual;
- dados e indicadores fixos apresentados sem identificação demonstrativa.

### Não incluído

- Firebase Authentication, Google Sign-In, Firebase Admin SDK, Firestore, Cloud Storage, App Check, Cloud Functions, Trigger Email, SMTP e implantação de produção.
