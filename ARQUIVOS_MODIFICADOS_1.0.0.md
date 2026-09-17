# Registro Detalhado de Arquivos Modificados, Criados e Preservados — Versão 1.0.0

## Sistema Institucional de Manutenção da Infraestrutura Física
### Instituto Federal do Espírito Santo — Campus Barra de São Francisco
### Gate 1.0-B — Implementação do Candidato 1.0.0
**Data de Emissão:** 15 de setembro de 2026

---

## 1. Sumário Quantitativo da Árvore

| Categoria | Quantidade Real | Observação / Justificativa de Governança |
| :--- | :---: | :--- |
| **Arquivos Modificados (`MODIFICADOS`)** | **16** | 15 arquivos autorizados inicialmente + 1 arquivo de teste (`tests/maintenanceWorker070.test.ts`) ampliado conforme instrução da Seção 15 |
| **Arquivos Criados (`CRIADOS`)** | **6** | Documentos formais exigidos para a release canônica 1.0.0 |
| **Arquivos Removidos (`REMOVIDOS`)** | **0** | Nenhum arquivo removido (`REMOVED_FILES=0`), preservando integralmente o histórico da baseline |
| **Total de Arquivos na Árvore 1.0.0** | **466** | 460 arquivos da baseline 0.9.0-g6c3 + 6 novos documentos formais |

---

## 2. Relação Exaustiva de Arquivos Modificados

Abaixo estão detalhados individualmente os 16 arquivos modificados:

### 1. `src/config/version.ts`
- **Motivo**: Atualização da constante global de versão da aplicação.
- **Natureza**: Configuração de Runtime / Identidade de Release.
- **Alteração Realizada**: `export const APP_VERSION = '1.0.0' as const;`
- **Risco**: Muito Baixo.
- **Impacto**: Atualiza a versão refletida no frontend (rodapé, página inicial) e nos metadados de runtime da API (`/api/health`).

### 2. `package.json`
- **Motivo**: Atualização da versão do pacote raiz do projeto.
- **Natureza**: Manifesto de Projeto / Metadados de Pacote.
- **Alteração Realizada**: `"version": "1.0.0"`.
- **Risco**: Muito Baixo.
- **Impacto**: Define a identidade formal da release no ecossistema npm.

### 3. `package-lock.json`
- **Motivo**: Sincronização dos metadados de versão da raiz do lockfile.
- **Natureza**: Metadados de Lockfile.
- **Alteração Realizada**: Atualização estrita de `version` na raiz (l. 3) e em `packages[""]` (l. 9) para `1.0.0`. Nenhuma versão de dependência foi alterada (`DEPENDENCY_GRAPH_CHANGED_BY_VERSION_SYNC=NO`).
- **Risco**: Nulo.
- **Impacto**: Garante reprodutibilidade estrita no `npm ci` sem alterar nenhuma biblioteca de terceiros.

### 4. `infra/cloudflare/maintenance-worker/package.json`
- **Motivo**: Atualização da versão do pacote do Maintenance Worker.
- **Natureza**: Manifesto de Projeto do Worker.
- **Alteração Realizada**: `"version": "1.0.0"`.
- **Risco**: Muito Baixo.
- **Impacto**: Alinha o worker como componente de primeira classe da release 1.0.0.

### 5. `infra/cloudflare/maintenance-worker/package-lock.json`
- **Motivo**: Sincronização de versão do lockfile do Maintenance Worker.
- **Natureza**: Metadados de Lockfile do Worker.
- **Alteração Realizada**: Atualização de `version` na raiz (l. 3) e em `packages[""]` (l. 9) para `1.0.0`. Grafo de dependências 100% inalterado.
- **Risco**: Nulo.
- **Impacto**: Mantém conformidade de build no diretório do worker.

### 6. `infra/cloudflare/maintenance-worker/src/index.ts`
- **Motivo**: Correção obrigatória da divergência histórica de runtime (emitia `0.7.7` na baseline).
- **Natureza**: Código de Runtime do Worker.
- **Alteração Realizada**: Atualização da propriedade `version` na resposta do método `fetch()` para `'1.0.0'`. Nenhuma lógica de agendamento, HMAC, rotas ou validações foi modificada.
- **Risco**: Muito Baixo.
- **Impacto**: Elimina a inconsistência detectada na auditoria adversarial; o endpoint de health do Worker agora reporta `1.0.0`.

### 7. `metadata.json`
- **Motivo**: Atualização da versão no catálogo institucional do sistema.
- **Natureza**: Metadados Institucionais.
- **Alteração Realizada**: `"version": "1.0.0"`.
- **Risco**: Muito Baixo.
- **Impacto**: Consistência com a documentação institucional e ferramentas de inspeção.

### 8. `firebase-blueprint.json`
- **Motivo**: Atualização da versão no blueprint arquitetural do Firebase.
- **Natureza**: Contrato de Arquitetura e Modelagem.
- **Alteração Realizada**: `"version": "1.0.0"`. Preservadas as menções históricas legítimas à versão 0.8.0 nos esquemas de entidades.
- **Risco**: Muito Baixo.
- **Impacto**: Alinhamento contratual da arquitetura do banco de dados.

### 9. `cloudbuild.yaml`
- **Motivo**: Atualização da tag padrão da imagem de container para a release 1.0.0.
- **Natureza**: Pipeline de CI/CD (Google Cloud Build).
- **Alteração Realizada**: `_IMAGE_TAG: v1.0.0`.
- **Risco**: Muito Baixo.
- **Impacto**: Assegura que builds futuros no Artifact Registry recebam a tag canônica `v1.0.0`.

### 10. `scripts/verifyRelease.mjs`
- **Motivo**: Atualização da versão esperada e endurecimento do verificador formal de release.
- **Natureza**: Script de Governança / Verificação Automatizada.
- **Alteração Realizada**: `EXPECTED_VERSION = '1.0.0'`, `EXPECTED_WORKER_BACKEND_URL = 'https://olhos-do-campus-hnwfymhsqq-uw.a.run.app'`, atualização de cabeçalhos e incorporação do 11º truth point (versão runtime do Worker), 12º truth point (alvo canônico de deploy `PROJECT_ID = gen-lang-client-0120954905` em `scripts/deployCloudRun.sh`) e 13º truth point (`vars.BACKEND_URL` em `infra/cloudflare/maintenance-worker/wrangler.jsonc`).
- **Risco**: Baixo.
- **Impacto**: O script opera em fail-closed e falha se qualquer um dos 13 truth points divergir ou contiver URLs inválidas/placeholders.

### 11. `scripts/deployCloudRun.sh`
- **Motivo**: Alinhamento cirúrgico com a infraestrutura comprovada de produção (Gate 1.0-C.1 / Finding G10C-F001).
- **Natureza**: Script Canônico de Implantação.
- **Alteração Realizada**: `PROJECT_ID="${PROJECT_ID:-gen-lang-client-0120954905}"`, `SERVICE_NAME="${SERVICE_NAME:-olhos-do-campus}"`, `REGION="${REGION:-us-west1}"`, `IMAGE_TAG="${IMAGE_TAG:-v1.0.0}"` e exigência estrita do token `ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0` para execução de `--apply`. Preservados `DRY_RUN=true`, `--max-instances=1`. Eliminada a menção ao projeto fictício `olhos-do-campus-prod`.
- **Risco**: Baixo.
- **Impacto**: Garante que o comando canônico aponte exatamente para o projeto e serviço reais de produção.

### 12. `infra/cloudflare/maintenance-worker/wrangler.jsonc`
- **Motivo**: Configuração do URL canônico comprovado do Cloud Run para o Maintenance Worker (Gate 1.0-D.2).
- **Natureza**: Configuração do Cloudflare Worker.
- **Alteração Realizada**: Substituição do placeholder `https://configure-cloud-run-url.example` por `https://olhos-do-campus-hnwfymhsqq-uw.a.run.app` em `vars.BACKEND_URL`. Preservados nome `olhos-do-campus-maintenance`, compatibility date e crons `*/10 * * * *` e `15 3 * * *`.
- **Risco**: Baixo.
- **Impacto**: Elimina o blocker operacional de deployment e estabelece a amarração correta entre o Worker e a API backend.

### 13. `tests/preDeployment071.test.ts`
- **Motivo**: Atualização das expectativas de versão e validação do worker na linha ativa 1.0.0.
- **Natureza**: Testes Automatizados Unitários / Contratuais.
- **Alteração Realizada**: Atualização do título do teste e validação de `rootPackage.version === '1.0.0'`, `workerPackage.version === '1.0.0'` e verificação da versão no código fonte do Worker.
- **Risco**: Muito Baixo.
- **Impacto**: Previne regressão de identidade nos testes de pré-implantação.

### 14. `tests/scaleConfigGuard.test.ts`
- **Motivo**: Atualização do token de confirmação e inclusão de guard rails contra divergência de projeto no deploy (Gate 1.0-C.1).
- **Natureza**: Teste de Invariante de Segurança e Governança.
- **Alteração Realizada**: Adicionadas asserções garantindo que `scripts/deployCloudRun.sh` defina `PROJECT_ID` padrão como `gen-lang-client-0120954905`, ausência total da string `olhos-do-campus-prod`, `SERVICE_NAME` padrão como `olhos-do-campus` e `REGION` como `us-west1`.
- **Risco**: Muito Baixo.
- **Impacto**: Mantém 100% de cobertura sobre a invariante `max-instances=1` e impede regressão no alvo de deploy.

### 15. `tests/maintenanceWorker070.test.ts`
- **Motivo**: Inclusão de testes de versão runtime e configuração do Maintenance Worker (Gates 1.0-B e 1.0-D.2).
- **Natureza**: Teste Automatizado de Regressão do Worker.
- **Alteração Realizada**: Adicionados os casos de teste:
  - `WORKER_RUNTIME_VERSION_TEST`: valida se o handler do worker reporta status `ok`, componente `maintenance-worker` e versão coincidente com `APP_VERSION` (`1.0.0`).
  - `WORKER_CONFIG_CRONS_TEST`: valida que `wrangler.jsonc` define exatamente os crons `*/10 * * * *` e `15 3 * * *`.
  - `WORKER_CONFIG_NAME_TEST`: valida que o nome configurado em `wrangler.jsonc` é estritamente `olhos-do-campus-maintenance`.
- **Risco**: Muito Baixo.
- **Impacto**: Comprova formalmente a integridade da configuração e runtime do worker.

### 16. `README.md`
- **Motivo**: Revisão substancial e alinhamento fático da documentação principal do projeto.
- **Natureza**: Documentação do Sistema.
- **Alteração Realizada**: Reescrita integral cobrindo arquitetura em 3 componentes, 60 ambientes canônicos, topologia do Firestore (`us-west1`), R2 privado, autenticação administrativa via Google Sign-In, rate limiting local (`INSTANCE_LOCAL`) com escala 1, declaração formal de acessibilidade no escopo homologado e remoção de termos proibidos.
- **Risco**: Nulo.
- **Impacto**: Documento coerente, sem alegações infladas e tecnicamente acurado.

### 17. `CHANGELOG.md`
- **Motivo**: Registro cumulativo canônico das releases 0.9.0 e 1.0.0.
- **Natureza**: Histórico Oficial de Mudanças.
- **Alteração Realizada**: Inclusão formal das seções `## [0.9.0] - 2026-09-15` e `## [1.0.0] - 2026-09-15`, preservando o histórico integral das versões 0.8.0 e anteriores.
- **Risco**: Nulo.
- **Impacto**: Manutenção da rastreabilidade e histórico único de versões.

---

## 3. Relação de Arquivos Criados

Os seguintes 6 arquivos foram criados na raiz da árvore do projeto para composição formal da release 1.0.0:

1. **`RELEASE_NOTES_1.0.0.md`**: Notas técnicas e de governança completas da release 1.0.0 em 22 seções estruturadas.
2. **`RELATORIO_IMPLEMENTACAO_1.0.0.md`**: Relatório executivo da implementação, rastreamento de custódia e comprovação de integridade.
3. **`ARQUIVOS_MODIFICADOS_1.0.0.md`**: Este documento, com o inventário exaustivo de alterações.
4. **`TESTES_1.0.0.md`**: Registro formal e minucioso de cada suíte de teste executada e suas evidências técnicas literais.
5. **`INSTRUCOES_INSTALACAO_IMPLANTACAO_1.0.0.md`**: Guia para instalação limpa, execução de suítes e runbook planejado de go-live e rollback futuro.
6. **`PENDENCIAS_1.0.0.md`**: Matriz de riscos residuais aceitos, pendências e itens do roadmap pós-1.0.

---

## 4. Relação de Arquivos Críticos Não Alterados (Preservação de Arquitetura)

Para assegurar que nenhuma alteração funcional ou arquitetural indevida foi introduzida, destacam-se como integralmente preservados:

- **Lógica Criptográfica da Chave**: `server/utils/trackingKey.ts` permaneceu 100% inalterado (charset 32, 12 caracteres, ~60 bits de entropia CSPRNG).
- **Regras de Segurança Firebase**: `firestore.rules` e `storage.rules` mantidas estritamente em modo *deny-all*.
- **Controle de Acesso RBAC**: `server/services/adminAuthorizationService.ts` e `server/middleware/auth.ts` inalterados.
- **Lógica de Autenticação NTLMv2 / EWS**: `server/providers/ews/ewsClient.ts` e `ewsEmailProvider.ts` inalterados.
- **Processamento de Fotos**: `server/services/imageProcessingService.ts` e `photoService.ts` inalterados.
- **Mecanismos de Rate Limiting**: `server/middleware/rateLimit.ts` e `scripts/checkScaleConfig.mjs` inalterados.
- **Scripts de Migração e Limpeza**: `scripts/migrate080.ts` e `scripts/cleanupArtificialLocations.ts` inalterados.