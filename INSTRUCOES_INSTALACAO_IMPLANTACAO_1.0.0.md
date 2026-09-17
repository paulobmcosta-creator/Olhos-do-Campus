# Instruções de Instalação, Testes e Implantação — Olhos do Campus 1.0.0

## Sistema Institucional de Manutenção da Infraestrutura Física
### Instituto Federal do Espírito Santo — Campus Barra de São Francisco
### Versão 1.0.0 — Candidato Oficial de Release

---

## 1. Instalação e Configuração do Ambiente Local

### 1.1. Pré-requisitos de Sistema

- **Node.js**: Versão `>=22.22.2 <23` (homologada com Node.js `v22.23.2`).
- **npm**: Versão `>=10.0.0` (homologada com npm `10.9.8`).
- **Java JDK**: OpenJDK 21 LTS (homologada com Eclipse Temurin 21.0.12.1 LTS). Necessário para executar localmente o Firebase Emulator Suite.
- **Firebase CLI**: `firebase-tools` instalado globalmente ou executável via `npx`.
- **Git**: Para versionamento e controle de integridade.

### 1.2. Instalação Limpa de Dependências

O projeto utiliza controle estrito de versões fixadas via `package-lock.json`. Para instalar dependências em qualquer ambiente de desenvolvimento, auditoria ou CI:

```bash
# Na raiz do projeto:
npm ci
```

*Nota: Nunca utilize `npm install` sem argumentos ou `npm update`, pois isso altera o grafo determinístico de dependências.*

### 1.3. Configuração de Variáveis de Ambiente

Copie o arquivo de exemplo de variáveis para criação do ambiente local:

```bash
cp .env.example .env
```

Preencha os valores locais conforme o modo de execução:
- Em **desenvolvimento com emuladores**, as credenciais e segredos sintéticos do `.env.example` são suficientes para a inicialização dos serviços.
- Em **produção**, nenhuma credencial ou chave privada deve ser commitada no repositório; os valores reais são injetados exclusivamente via secrets do Cloud Run, Cloudflare Pages e Cloudflare Workers.

### 1.4. Execução dos Emuladores Locais

Para simular localmente os serviços Firebase (Auth, Firestore e Cloud Storage):

```bash
# Inicializar emuladores:
npm run emulators
```

---

## 2. Roteiro Completo de Testes e Validação da Release

Antes de qualquer empacotamento ou publicação, execute todas as suítes de teste e verificadores de conformidade:

### 2.1. Checagem de Tipos e Análise Estática

```bash
# Checagem de tipagem estática TypeScript (strict mode):
npm run typecheck

# Análise estática de código (ESLint sem tolerância a avisos):
npm run lint
```

### 2.2. Suíte Principal de Testes Automatizados (Vitest)

```bash
# Executa 72 arquivos de teste unitários e de integração local:
npm run test
```

### 2.3. Build de Produção

```bash
# Constrói cliente web (dist/client via Vite) e servidor (dist/server/index.js via esbuild):
npm run build
```

### 2.4. Validação Integrada

```bash
# Executa o pipeline sequencial typecheck + lint + test + build:
npm run validate
```

### 2.5. Testes do Cloudflare Maintenance Worker

```bash
# Verificação de tipos TypeScript do worker:
npm run worker:typecheck

# Testes de regressão HMAC, roteamento de cron, validação de segredos e runtime version 1.0.0:
npm run worker:test
```

### 2.6. Testes com Firebase Emulator Suite

*Requer Java JDK 21 configurado no `PATH` e `JAVA_HOME`.*

```bash
# Testes das regras de segurança de Firestore e Cloud Storage (deny-all):
npm run test:rules

# Testes de integração funcional com Firebase (Auth, Firestore):
npm run test:firebase

# Testes de integração com storage local:
npm run test:storage
```

### 2.7. Verificações Formais de Conformidade de Release

```bash
# Valida os 13 truth points de versão 1.0.0, alvo de deploy e BACKEND_URL do Worker em toda a árvore:
npm run verify:release

# Valida a invariante de max-instances=1 atrelada ao rate limiting local:
npm run check:scale
```

### 2.8. Auditoria de Segurança de Dependências

```bash
# Auditoria das dependências de produção:
npm audit --omit=dev
```

---

## 3. Arquitetura de Componentes Implantáveis

A release 1.0.0 possui três componentes implantáveis independentes, sem dependência mútua de deploy simultâneo atômico:

```text
┌─────────────────────────────────────────────────────────────┐
│                    RELEASE 1.0.0                            │
├──────────────────────────────┬──────────────────────────────┤
│ 1. CLOUD_RUN_BACKEND         │ API REST Express container   │
│ 2. CLOUDFLARE_PAGES_FRONTEND │ SPA React 19 / Vite          │
│ 3. CLOUDFLARE_WORKER         │ Maintenance Worker (Cron)    │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 4. Procedimento de Implantação Futura (Planejamento)

> **AVISO CRÍTICO**: Esta seção descreve exclusivamente o procedimento para execução em janela de implantação futura autorizada. NENHUM deploy deve ser executado durante esta auditoria de preparação.

### 4.1. Sequência Canônica Recomendada de Go-Live

1. **Validação Prévia do Pacote**: Confirmar o SHA-256 de `olhos-do-campus-1.0.0.zip` e a aprovação de todos os testes locais.
2. **Verificação do Estado do Maintenance Worker**: O estado pré-1.0 comprovado na conta Cloudflare produtiva é `WORKER_ABSENT`. Não há Worker ou segredo atualmente provisionado, caracterizando a implantação como `WORKER_DEPLOYMENT_TYPE=FIRST_TIME_PROVISIONING`.
3. **Backup Cautelar do Firestore**: Executar o script de backup formal `bash scripts/backup/firestoreBackup.sh` para assegurar ponto de restauração imutável antes da janela.
4. **Build e Tag do Container Backend**:
   - Submeter o build via Cloud Build:
     ```bash
     gcloud builds submit --config=cloudbuild.yaml --substitutions=_IMAGE_TAG=v1.0.0
     ```
5. **Smoke Privado em Staging / Revisão Isolada**: Validar a imagem criada em ambiente ou revisão sem tráfego antes de promover.
6. **Deploy do Backend no Cloud Run**:
   - O deploy canônico DEVE utilizar o wrapper de segurança `scripts/deployCloudRun.sh`:
     ```bash
     ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0 bash scripts/deployCloudRun.sh --apply
     ```
   - O wrapper garante a imposição estrita de `--max-instances=1` e impede escala horizontal sem proteção distribuída.
7. **First-Time Provisioning em Fases do Cloudflare Maintenance Worker**:
   - O Worker não deve ser ativado com agendamentos periódicos antes da validação de seu endpoint e de seus segredos. O provisionamento segue 4 fases controladas:
   - **Fase A — Baseline sem crons**: Criar temporariamente configuração derivada com agendamentos vazios (`"triggers": { "crons": [] }`) e implantar o baseline:
     ```bash
     cd infra/cloudflare/maintenance-worker
     # Implantar baseline sem agendamentos ativos:
     npx wrangler deploy --name olhos-do-campus-maintenance --triggers-crons ""
     ```
   - **Fase B — Configuração do Secret**: Após o provisionamento inicial do Worker na nuvem, configurar o segredo HMAC a partir do Secret Manager institucional (`odc-maintenance-hmac-secret`) sem exibir seu valor:
     ```bash
     npx wrangler secret put MAINTENANCE_HMAC_SECRET --name olhos-do-campus-maintenance
     # Validar apenas presença do nome:
     npx wrangler secret list --name olhos-do-campus-maintenance --format json
     ```
   - **Fase C — Health Check pré-ativação de crons**: Validar o endpoint HTTP do Worker:
     ```bash
     curl -s https://<worker-url>/
     # Esperado: {"status":"ok","component":"maintenance-worker","version":"1.0.0"}
     ```
   - **Fase D — Ativação dos Crons**: Com o Worker validado e seguro, aplicar a configuração canônica completa com os agendamentos (`*/10 * * * *` e `15 3 * * *`):
     ```bash
     npx wrangler deploy
     ```
8. **Deploy do Frontend no Cloudflare Pages**:
   - Gerar o bundle de produção:
     ```bash
     npm run build:pages
     ```
   - Publicar no Cloudflare Pages via CLI ou pipeline CI conectado ao repositório institucional.
9. **Smoke Test Integrado Pós-Deploy**:
   - Verificar `/api/health` retornando versão `1.0.0`;
   - Verificar rodapé da aplicação web exibindo versão `1.0.0`;
   - Testar fluxo público de consulta de protocolo;
   - Testar autenticação administrativa Google Sign-In.
10. **Período de Observação Pós-Release**: Monitorar logs estruturados do Cloud Run via Cloud Logging e painel de métricas por 2 horas.

---

## 5. Procedimento de Rollback de Emergência

Em caso de anomalia crítica detectada pós-deploy, o procedimento de reversão para a versão estável 0.9.0 deve ser executado na seguinte ordem:

### 5.1. Rollback do Backend Cloud Run

Reverter imediatamente para a revisão estável homologada da versão 0.9.0:

```bash
gcloud run services update-traffic olhos-do-campus \
  --to-revisions=olhos-do-campus-00010-gj9=100 \
  --region=us-west1 \
  --project=gen-lang-client-0120954905
```

Identificador de rollback do backend:
`BACKEND_090_ROLLBACK_REVISION=olhos-do-campus-00010-gj9`

### 5.2. Rollback do Frontend Cloudflare Pages

No painel da Cloudflare Pages ou via Wrangler, reverter para a implantação estável da 0.9.0:

Identificador de rollback do frontend:
`FRONTEND_090_ROLLBACK_DEPLOYMENT=626b64aa-194f-4d11-b910-6ae30af668a7`

### 5.3. Rollback do Cloudflare Maintenance Worker (First-Time Provisioning)

Dado que o estado pré-1.0 comprovado na conta Cloudflare produtiva é `WORKER_ABSENT`, não existe versão anterior 0.9.0 para rollback no Cloudflare. O runbook operacional prevê três ações distintas conforme o objetivo:

1. **Rollback de Código (em revisões 1.0.x futuras com versão estável conhecida)**:
   ```bash
   npx wrangler rollback <KNOWN_GOOD_VERSION_ID> --name olhos-do-campus-maintenance
   ```

2. **Rollback Operacional Imediato dos Crons (Cessar Invocação Periódica)**:
   Aplicar configuração com triggers vazios (`"triggers": { "crons": [] }`), desativando imediatamente os disparos agendados contra o Cloud Run:
   ```bash
   npx wrangler deploy --name olhos-do-campus-maintenance --triggers-crons ""
   ```

3. **Reversão Completa ao Estado Pré-1.0 (`WORKER_PRE_1_0_STATE=ABSENT`)**:
   Caso seja necessário desprovisionar integralmente o Worker e retornar ao estado original de ausência pré-1.0:
   ```bash
   npx wrangler delete --name olhos-do-campus-maintenance
   ```

---

## 6. Governança de Migração e Banco de Dados

- **Migração 0.8.0**: Já aplicada e consolidada na base de dados produtiva (`MIGRATION_080_ALREADY_APPLIED=YES`).
- **NÃO REEXECUTAR MIGRAÇÕES**: A release 1.0.0 NÃO requer e NÃO deve executar scripts de migração de banco de dados (`MIGRATION_080_REEXECUTION_FOR_1_0=NO`).
- **NUNCA EXECUTAR EM PRODUÇÃO**:
  - `npm run firebase:seed-reference-data`
  - `npm run firebase:seed-demo-data`
  - `tsx scripts/migrate080.ts --apply`
  - `tsx scripts/cleanupArtificialLocations.ts --apply`