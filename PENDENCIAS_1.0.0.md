# Matriz de Riscos Residuais, Pendências e Roadmap Técnico — Versão 1.0.0

## Sistema Institucional de Manutenção da Infraestrutura Física
### Instituto Federal do Espírito Santo — Campus Barra de São Francisco
### Versão 1.0.0 — Candidato Oficial de Release

---

## 1. Visão Geral de Governança

A versão 1.0.0 atinge a maturidade para operação institucional plena através da consolidação formal de todos os requisitos de segurança, integridade transacional, isolamento de dados e operabilidade homologados ao longo dos Ciclos 0.7.x, 0.8.x e 0.9.x.

Este documento consolida as pendências técnicas conhecidas, riscos residuais formalmente aceitos e itens do roadmap pós-1.0.0, assegurando total transparência técnica e alinhamento com os órgãos gestores da infraestrutura.

---

## 2. Matriz Consolidada de Pendências e Riscos

| Identificador | Título / Descrição Técnica | Classificação de Governança | Mitigação Vigente / Plano de Ação |
| :--- | :--- | :---: | :--- |
| **G09J-F001** | **Ausência de Alertas Automatizados (Métricas/Incidentes)** | `POST_1_0_ROADMAP` | Atualmente, a observabilidade depende de inspeção via Cloud Logging e painel administrativo. A configuração de políticas automatizadas de alerta (Google Cloud Monitoring Alerting Policies para erros 5xx e latência) está prevista para o primeiro ciclo pós-1.0. |
| **G09J-F004** | **`max-instances=1` não constitui fronteira criptográfica rígida de segurança** | `ACCEPTED_RISK` | A imposição de instância única é assegurada no nível de infraestrutura pelo Cloud Run e validada pelo wrapper canônico `scripts/deployCloudRun.sh` e pelo guard `checkScaleConfig.mjs`. Embora robusta operacionalmente, não substitui um rate limiter distribuído contra concorrência massiva maliciosa. |
| **G09B-F003** | **Risco de Capacidade de Instância Única (`SINGLE_INSTANCE_CAPACITY_RISK=MEDIUM`)** | `ACCEPTED_RISK` | A fixação em 1 instância protege o rate limiting em memória (`RATE_LIMIT_SCOPE=INSTANCE_LOCAL`), mas limita a vazão pico do backend. O benchmark local representativo (`SINGLE_INSTANCE_LOAD_TEST=LIMITED`) demonstrou capacidade estável para a demanda institucional esperada do campus. |
| **RATE-LIMIT-DIST** | **Necessidade de Rate Limiting Distribuído ou Edge antes de Scale-Out** | `POST_1_0_ROADMAP` | Pré-requisito técnico mandatório antes de qualquer expansão para `max-instances > 1`. A implementação futura adotará Cloudflare Rate Limiting na borda ou Redis/Valkey centralizado. |
| **PHOTO-BACKUP-PARTIAL** | **Prontidão de Backup de Fotografias Parcial (`PHOTO_BACKUP_READINESS=PARTIAL`)** | `ACCEPTED_RISK` | Os scripts de inventário (`r2Inventory.ts`) e restauração cruzada entre buckets (`r2Restore.ts`) foram implementados e testados com sucesso em ensaio local (5 objetos sintéticos com integridade SHA-256 total). No entanto, o bucket secundário de contingência ainda não está permanentemente conectado via replicação assíncrona automática. |
| **R2-OFFSITE** | **Replicação Off-site / Multi-Cloud de Fotografias** | `POST_1_0_ROADMAP` | Estabelecer rotina periódica de backup automatizado para armazenamento secundário externo independente (offsite R2 dump ou bucket Google Cloud Storage frio). |
| **RPO-RTO-FORMAL** | **Definição Formal de RPO / RTO pelo Comitê Institucional** | `GOVERNANCE_DECISION` | O runbook operacional `docs/RUNBOOK_BACKUP_RESTORE_0.9.0.md` prevê procedimentos manuais e scripts de restore, mas as metas institucionais formais de Tempo Máximo de Recuperação (RTO) e Ponto Máximo de Recuperação (RPO) dependem de pactuação pelo comitê gestor de TI. |
| **REGION-MIGRATION** | **Estratégia Regional Futura (São Paulo `southamerica-east1`)** | `POST_1_0_ROADMAP` | A instância atual do Firestore está provisionada em `us-west1`. Como a localização do Firestore é imutável in-place, a migração para `southamerica-east1` (reduzindo latência de rede no Brasil) será planejada como projeto pós-1.0 via provisionamento paralelo, export/import e cutover em janela programada. |
| **DEV-ADVISORIES** | **Avisos de Auditoria em Dependências de Ferramentas de Dev (npm audit)** | `ACCEPTED_RISK` | As dependências de produção do projeto apresentam **0 vulnerabilidades** (`PRODUCTION_VULNERABILITIES=0`). As vulnerabilidades residuais reportadas pelo `npm audit` concentram-se estritamente em ferramentas de desenvolvimento (devDependencies, ex.: Vitest, ESLint, esbuild) sem exposição no runtime de produção. |
| **GOOGLE-AUTH-SCOPE** | **Restrições Institucionais de Google Sign-In** | `GOVERNANCE_DECISION` | A autenticação administrativa utiliza Google Sign-In com validação da allowlist no backend e restrição de domínio configurada. A vinculação institucional estrita a Google Workspace depende de parametrização da organização no Google Identity. |
| **WORKER-FIRST-TIME** | **First-Time Provisioning do Cloudflare Maintenance Worker (`WORKER_DEPLOYMENT_TYPE=FIRST_TIME_PROVISIONING`)** | `ACCEPTED_RISK` | O estado pré-1.0 comprovado na conta Cloudflare produtiva é `WORKER_ABSENT`. Não há versão 0.9.0 para rollback do Worker. O go-live operacional adota provisionamento faseado seguro (baseline sem triggers -> configuração de secret -> health check -> ativação de crons), com procedimento de reversão documentado via remoção (`wrangler delete`) ou esvaziamento de triggers. |

---

## 3. Classificação Resumida

### 3.1. Riscos Aceitos para Operação 1.0 (`ACCEPTED_RISK`)
- Limitação de vazão a 1 instância do Cloud Run com rate limiting em memória.
- Backup de fotos em prontidão parcial (scripts e rehearsals funcionais, sem bucket de réplica ativa contínua).
- Vulnerabilidades residuais restritas a ferramentas de desenvolvimento (`devDependencies`).
- First-Time Provisioning do Cloudflare Maintenance Worker sem rollback target pré-1.0 na nuvem, mitigado por procedimento operacional faseado.

### 3.2. Itens do Roadmap Pós-1.0 (`POST_1_0_ROADMAP`)
- Implementação de alertas automatizados de métricas e incidentes (Cloud Monitoring).
- Rate limiting distribuído (Cloudflare / Redis) habilitando escala horizontal.
- Replicação contínua off-site de fotografias.
- Planejamento da migração geográfica para região América do Sul (`southamerica-east1`).

### 3.3. Decisões Institucionais de Governança (`GOVERNANCE_DECISION`)
- Homologação de metas formais de SLA, RTO e RPO pelo Comitê de Governança Digital do IFES.
- Parametrizações de restrição corporativa no Google Cloud Identity.