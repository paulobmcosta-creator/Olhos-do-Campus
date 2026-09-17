# RELATÓRIO DE IMPLEMENTAÇÃO — VERSÃO 0.8.0

## SISTEMA INSTITUCIONAL DE MANUTENÇÃO DA INFRAESTRUTURA FÍSICA — OLHOS DO CAMPUS

---

## 1. Objetivo da Versão 0.8.0

A versão `0.8.0` consolida o modelo institucional de atendimento operacional do IFES Campus Barra de São Francisco, introduzindo:
1. **Papel Atendente com Menor Privilégio**: Acesso operacional restrito estritamente às ocorrências atribuídas individualmente ao usuário (`assignedToAdminUserId === user.id`).
2. **Fluxo e Transições do Atendente**: 7 transições autorizadas na máquina de estados, adição de mensagens públicas e notas internas de audiência `RESPONSIBLE_TEAM`, e anexo de fotografias de solução (sem autorização de publicação ou exclusão).
3. **Gestão Segura de Locais e Ambientes**: Ocultação estrita de locais inativos no portal público (`listActiveForPublic()`), reativação de blocos/ambientes e exclusão física protegida com bloqueio HTTP 409 em caso de histórico em ocorrências.
4. **Saneamento dos 60 Ambientes Institucionais**: Bloco 01 (28), Bloco 02 (26), Bloco 03 (2) e Externo (4), com remoção de pavimentos artificiais.
5. **Acolhimento Inicial pela CGAO**: Definição da Coordenação Geral de Administração, Orçamento e Finanças (`team-cgao`) como setor padrão de triagem de novas ocorrências públicas, com notificação automática para `cgao.bsf@ifes.edu.br`.
6. **Notificações Institucionais de Roteamento**: Eventos `OCCURRENCE_TEAM_ROUTED` e `OCCURRENCE_RESPONSIBLE_ASSIGNED` integrados ao outbox com suporte a chaves de idempotência que suportam reatribuições sucessivas.
7. **Scripts Operacionais com Modo Seguro**: `scripts/migrate080.ts` e `scripts/cleanupArtificialLocations.ts` implementando `--dry-run` por padrão e execução transacional idempotente.
8. **Remediação do Finding GD-F001**: Correção da serialização de propriedades opcionais em `templateData` no outbox sem ativação global de `ignoreUndefinedProperties`.

---

## 2. Baseline e Arquitetura Preservada

* **Baseline Canônica**: `olhos-do-campus-0.7.7.zip` (SHA-256: `c8765edf96329ad87c51006ad310b19a4e7e3bbe111cd589ae9fca838a1d2fbb`).
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, SPA estática servida via Cloudflare Pages.
* **Backend**: Node.js 22, Express, TypeScript, esbuild bundle para Google Cloud Run.
* **Persistência**: Cloud Firestore Enterprise com SDK Admin (server-side only) e índices DENSE de collection group.
* **Armazenamento de Imagens**: Cloudflare R2 com fallback para Cloud Storage, metadados persistidos no Firestore, processamento WebP server-side, e isolamento de imagens de registro (restritas) versus solução (publicação explícita).
* **Notificações**: Exchange Web Services (EWS) nativo SOAP NTLM institucional com outbox assíncrono transacional.

---

## 3. Detalhamento das Funcionalidades

### 3.1. Papel Atendente e RBAC (29 Operações)
* **Permitido**: Login ativo, listagem de ocorrências próprias (`Minhas Ocorrências`), consulta de detalhe da ocorrência própria, 7 transições autorizadas de status, inserção de mensagem pública própria, inserção de nota interna com audiência `RESPONSIBLE_TEAM` própria, adição de foto de solução própria, dashboard pessoal.
* **Bloqueado (403 FORBIDDEN)**: Acesso a ocorrências de outros atendentes ou sem atribuição, alteração de categoria, prioridade, local, setor, responsável, duplicidade, reabertura, cancelamento, publicação de fotos, exclusão de fotos, notas `ADMIN_ONLY` ou `ADMINS_AND_MANAGERS`, visualização de auditoria global, analytics global, exportações de relatórios e configurações operacionais.

### 3.2. Sete Transições Autorizadas do Atendente
1. `Em análise` $\rightarrow$ `Em atendimento`
2. `Encaminhada ao setor responsável` $\rightarrow$ `Em atendimento`
3. `Em atendimento` $\rightarrow$ `Aguardando material`
4. `Aguardando material` $\rightarrow$ `Em atendimento`
5. `Em atendimento` $\rightarrow$ `Aguardando contratação ou serviço externo`
6. `Aguardando contratação ou serviço externo` $\rightarrow$ `Em atendimento`
7. `Em atendimento` $\rightarrow$ `Resolvida`

### 3.3. Locais e Ambientes
* Método `listActiveForPublic()` garante que nenhum ambiente ou bloco desativado seja exposto no catálogo público de abertura de ocorrências.
* Exclusão segura verifica `isLocationReferenced()`; se houver ocorrências vinculadas em `location` ou `reportedLocation`, retorna 409 com a mensagem: `"Este local já foi utilizado em ocorrências e não pode ser excluído definitivamente. Desative-o para impedir novos registros."`.

### 3.4. Equipes e Acolhimento CGAO
* Equipe `team-cgao` com e-mail `cgao.bsf@ifes.edu.br` configurada como inicial (`isInitialIntakeTeam === true`).
* Invariante pós-migração: exatamente uma equipe de acolhimento inicial ativa.
* Novas ocorrências geram item outbox para o e-mail setorial da CGAO sem disparar e-mails individuais para membros da equipe.

---

## 4. Histórico dos Gates e Remediação GD-F001

* **Gate A**: Aprovado com ressalva operacional (leitura e diagnóstico da 0.7.7).
* **Gate B**: Decisões arquiteturais fechadas (desenho formal da 0.8.0).
* **Gate C**: Implementação principal concluída.
* **Gate C.1**: Correções obrigatórias pré-Gate D (locais inativos no público, exclusão segura de locais, allowlist de cleanup).
* **Gate D Inicial**: Veredito **FAIL** devido ao finding `GD-F001` capturado pela Firebase Emulator Suite (`templateData.teamName: undefined` rejeitado pelo Firestore Admin SDK em `tests/firebaseIntegration.test.ts`).
* **Gate C.2**: Remediação cirúrgica de `GD-F001` (construção condicional no builder e repositório de outbox para omitir chaves `undefined`, novos testes unitários).
* **Gate D.2**: Reexecução integral com veredito **PASS** (19/19 testes na suíte Firebase, 425 testes ordinários, 4 no Worker, 2 em Rules e 6 em Storage).
* **Gate E**: Fechamento documental e empacotamento da versão `0.8.0`.

---

## 5. Limitações e Próximos Passos (Versão 0.9.0)

* A versão 0.8.0 encerra o escopo funcional e de arquitetura de atendimento.
* A versão **0.9.0** será o gate pré-produção focado em:
  - Auditoria de infraestrutura e observabilidade;
  - Procedimentos de backup e recovery;
  - Estratégia de deploy com canary traffic e rollback.
