# Release Notes — Olhos do Campus 1.0.0

## Sistema Institucional de Manutenção da Infraestrutura Física
### Instituto Federal do Espírito Santo — Campus Barra de São Francisco
### Versão 1.0.0 — Candidato Oficial de Release
**Data de Emissão:** 15 de setembro de 2026

---

## 1. Resumo Executivo

A versão **1.0.0** do projeto **Olhos do Campus** constitui a promoção formal da árvore homologada e consolidada no Ciclo 0.9.0 para operação institucional estável no IFES — Campus Barra de São Francisco. 

Esta entrega unifica a identidade de release em todos os pontos de controle da árvore técnica, sincroniza a versão em runtime do Cloudflare Maintenance Worker com os manifestos de dependência, endurece o script de verificação formal da release com 11 truth points automatizados, refina as diretrizes operacionais de implantação e documenta exaustivamente a postura de segurança, privacidade e limites arquiteturais.

A release 1.0.0 não introduz alterações funcionais de negócio, modificações de esquema, coleções adicionais no Firestore ou rotinas de migração de dados. Trata-se de uma promoção de governança, qualidade técnica e prontidão de release baseada na estabilidade da árvore 0.9.0.

---

## 2. Objetivo da Release

- Promover a árvore homologada 0.9.0 para a versão candidata canônica 1.0.0.
- Sanar a inconsistência na versão emitida pelo handler de health do Cloudflare Maintenance Worker (`0.7.7` $\rightarrow$ `1.0.0`).
- Sincronizar todos os manifestos (`package.json`, `package-lock.json`, `metadata.json`, `firebase-blueprint.json`, `cloudbuild.yaml`, `src/config/version.ts`, `scripts/deployCloudRun.sh`).
- Expandir e endurecer o script de validação de release `scripts/verifyRelease.mjs` para validar 12 truth points (incluindo alvo canônico de deploy `gen-lang-client-0120954905`) em modo fail-closed.
- Estabelecer documentação técnica de alta fidelidade, eliminando reivindicações hiperbólicas e refletindo com precisão as capacidades reais do software.

---

## 3. Arquitetura

O sistema é estruturado em três camadas independentes com comunicação via HTTPS estrito e CORS restrito:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. CAMADA DE APRESENTAÇÃO WEB (Cloudflare Pages)            │
│    Single Page Application React 19 / Vite / Tailwind CSS   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON / App Check
┌──────────────────────────────▼──────────────────────────────┐
│ 2. CAMADA DE API E NEGÓCIO (Cloud Run)                      │
│    Node.js 22 / Express / TypeScript (Strict Mode)          │
│    - Autenticação e Autorização (Firebase Auth + App Check) │
│    - Rate Limiting em Memória (Instância Única)             │
│    - Processamento e Redimensionamento WebP de Fotos        │
│    - Fila Outbox Transacional e Roteamento Institucional     │
└──────┬───────────────────────┬───────────────────────┬──────┘
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│  FIRESTORE  │         │   R2 S3     │         │   EWS /     │
│  (Nomeado)  │         │  (Privado)  │         │   NTLMv2    │
└─────────────┘         └─────────────┘         └─────────────┘
                               ▲
                               │ Chamadas periódicas assinadas (HMAC)
┌──────────────────────────────┴──────────────────────────────┐
│ 3. MANUTENÇÃO NA BORDA (Cloudflare Maintenance Worker)       │
│    Agendamento de rotinas periódicas (Cron) via HMAC        │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Componentes Implantáveis

A release 1.0.0 é composta por três componentes implantáveis e versionados de maneira harmônica:

1. **`CLOUD_RUN_BACKEND`**: API Node.js 22 em container no Google Cloud Run (região `us-west1`), executando toda a lógica de domínio, persistência e autorização.
2. **`CLOUDFLARE_PAGES_FRONTEND`**: SPA estática React 19 servida globalmente na rede de distribuição de conteúdo da Cloudflare Pages.
3. **`CLOUDFLARE_MAINTENANCE_WORKER`**: Worker serverless na Cloudflare que atua como disparador confiável de tarefas agendadas via cron.

---

## 5. Fluxo Público de Ocorrências

- **Acesso Sem Cadastro Obrigatório**: Qualquer cidadão, estudante ou servidor pode reportar avarias na infraestrutura predial sem identificação pessoal mandatória (sem fornecimento de nome, CPF ou e-mail).
- **Classificação**: Seleção obrigatória de categoria de serviço e indicação precisa do local entre os 60 ambientes canônicos do campus.
- **Evidências Fotográficas**: Envio opcional de até 3 fotografias iniciais por ocorrência.
- **Entrega de Credenciais Públicas**: O solicitante recebe um identificador de protocolo legível e uma chave de acompanhamento de 12 caracteres.
- **Acompanhamento Transparente**: Consulta ao status da ocorrência e leitura de mensagens públicas mediante submissão do par protocolo + chave de acompanhamento fora da URL.

---

## 6. Fluxo Administrativo

- **Acesso Autenticado**: Restrito a contas institucionais autorizadas via Google Sign-In.
- **Triagem CGAO**: A Coordenação Geral de Administração, Orçamento e Finanças atua como equipe de acolhimento padrão das novas ocorrências.
- **Gestão Operacional**: Alteração de status, repasse entre setores, reclassificação de prioridade (Baixa, Normal, Alta, Urgente, Emergencial) e controle de SLA em horário comercial.
- **Notas Internas**: Mecanismo de colaboração interna com visibilidade restrita (`INTERNAL` para gestores/administradores ou `RESPONSIBLE_TEAM` para equipes executoras).
- **Fotos de Conclusão**: Registro de evidências fotográficas do reparo efetuado, com possibilidade de publicação pública condicionada a aprovação explícita.

---

## 7. Controle de Acesso Baseado em Papéis (RBAC)

O sistema opera com o princípio do menor privilégio, contemplando três papéis formais:

- **Administrador**: Controle pleno do sistema, gestão de acessos, parametrização de limiares de capacidade e configurações institucionais.
- **Gestor**: Roteamento, reatribuição, repriorização e atendimento de ocorrências em âmbito global.
- **Atendente**: Operação estritamente delimitada às ocorrências atribuídas individualmente (`assignedToAdminUserId === user.id`). Atendentes não visualizam ocorrências de terceiros nem dados transversais do sistema.

---

## 8. Segurança da Aplicação

- **Mediação Centralizada**: O navegador não possui credenciais diretas de leitura ou gravação no banco de dados Firestore ou no bucket R2. Todas as operações transitam pelo backend.
- **Regras Deny-All**: Regras do Firebase (`firestore.rules` e `storage.rules`) configuradas para rejeitar qualquer acesso cliente direto não intermediado.
- **Proteção contra Spoofing**: O rate limiting opera com verificação de identidade em duas camadas (cota por UID autenticado e cota global por operação), com imunidade comprovada a manipulações de cabeçalhos como `X-Forwarded-For`.
- **Topologia de Escala Controlada**: Topologia fixada em 1 instância máxima (`max-instances=1`) para assegurar a consistência do rate limiter em memória (`RATE_LIMIT_SCOPE=INSTANCE_LOCAL`).

---

## 9. Privacidade e Proteção de Dados

- **Terminologia Factual**: A aplicação garante *registro sem identificação pessoal obrigatória*. Não são feitas alegações absolutas de "anonimato total".
- **Minimização de Dados**: Mensagens de notificação e logs estruturados não contêm descrições sensíveis, nomes de solicitantes, chaves de acompanhamento, hashes, salts ou endereços IP.
- **Logs Estruturados**: Implementação de redação automática de campos confidenciais em `server/utils/logger.ts`.

---

## 10. Chave de Acompanhamento (Tracking Key)

- **Algoritmo**: Chave de 12 caracteres dividida em três quartetos (`XXXX-XXXX-XXXX`), gerada por CSPRNG (`randomInt`) sobre um alfabeto de 32 símbolos alfanuméricos (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
- **Entropia Teórica**: Aproximadamente 60 bits de entropia teórica (\(32^{12} = 2^{60}\)).
- **Armazenamento**: O valor em texto claro nunca é gravado no banco de dados. O backend persiste exclusivamente o hash derivado por `scrypt` com salt individual de 16 bytes.

---

## 11. Tratamento de Fotografias

- **Armazenamento Produtivo**: Cloudflare R2 (bucket privado acessado via credenciais restritas S3-compatible).
- **Sanitização de Imagem**: Todas as fotos enviadas passam por validação de formato e re-encoding compulsório para formato WebP com qualidade 80 via `sharp`. Metadados EXIF e marcas d'água geográficas são completamente descartados antes da gravação.
- **Controle de Exposição**: Fotos iniciais do cidadão são estritamente internas e nunca servidas na consulta pública. Fotos de solução exigem marcação explícita de publicação.

---

## 12. Mensageria e Notificações

- **Provedor Institucional**: Exchange Web Services (EWS) do IFES utilizando autenticação NTLMv2 institucional via transporte HTTPS estrito, com framing HTTP validado (`Content-Length` explícito).
- **Provedor Alternativo / Histórico**: Resend mantido para compatibilidade e histórico de transição.
- **Garantias de Entrega**: Outbox persistido transacionalmente no Firestore (`NotificationOutbox`), isolamento de tentativas individuais (`DeliveryAttempt`), deduplicação e identificação técnica idempotente sem exposição de dados pessoais.

---

## 13. Acessibilidade no Escopo Homologado

A aplicação passou por homologação pós-fix de acessibilidade nos fluxos e critérios auditados, incluindo navegação por teclado, gerenciamento de foco, semântica de formulários, modais e reflow responsivo. Essa homologação não constitui declaração de conformidade global WCAG.

---

## 14. Responsividade e Experiência do Usuário (UX)

- Design totalmente adaptável para dispositivos móveis (320px), tablets (768px) e desktops de alta resolução (1920px).
- Reflow responsivo sem overflow horizontal ou perda de funcionalidade.
- Zonas de toque móveis com dimensão mínima recomendada de 44x44px.

---

## 15. Infraestrutura de Produção

- **Banco de Dados**: Google Cloud Firestore (banco nomeado `ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf`, região `us-west1`).
- **Backend API**: Cloud Run na região `us-west1`, fixado em `max-instances=1`.
- **Frontend SPA**: Cloudflare Pages com headers de segurança e CSP restrito.
- **Ambientes Físicos**: 60 ambientes canônicos sem pavimentos artificiais.

---

## 16. Cloudflare Maintenance Worker

- Executa periodicamente no edge disparos agendados via cron para rotas de manutenção do backend Cloud Run.
- As chamadas são autenticadas por assinatura HMAC com timestamp e digest de corpo SHA-256 (`requireMaintenanceSignature.ts`).
- O worker atua exclusivamente como disparador de gatilhos HTTP; todo o processamento de snapshots e drenagem de outbox ocorre no backend.
- Endpoint de health validado: `GET /` retorna status `ok`, componente `maintenance-worker` e versão `1.0.0`.

---

## 17. Backup e Recuperação

- **Firestore**: Scripts de automação `firestoreBackup.sh` e `firestoreRestore.sh` com proteção contra sobreposição em ambiente produtivo.
- **Fotografias R2**: Scripts `r2Inventory.ts` e `r2Restore.ts` testados com sucesso em rehearsal sintético. Prontidão classificada como `PHOTO_BACKUP_READINESS=PARTIAL` até o provisionamento de réplica ativa contínua.
- **Rehearsal de Migração**: Script de extração de pré-imagem e rehearsal de restauração 100% íntegro sem uso de tipos genéricos `any`.

---

## 18. Bateria de Testes da Release 1.0.0

- **Typecheck Estático**: 0 erros TypeScript (`tsc --noEmit`).
- **Linter de Código**: 0 erros e 0 avisos ESLint (`eslint . --max-warnings=0`).
- **Suíte Principal Vitest**: 72 arquivos de teste aprovados, 565 testes aprovados, 3 pulados por opt-in cloud.
- **Suíte do Worker**: 5 testes aprovados (incluindo `WORKER_RUNTIME_VERSION_TEST`).
- **Emuladores Firebase**: Regras de segurança (2 testes), integração Firebase (19 testes) e storage (6 testes) aprovados.
- **Verificação de Release**: 12 truth points validados (`RELEASE_IDENTITY_TEST=PASS`).
- **Scale Guard**: Validação de max-instances=1 (`MAX_SCALE_GUARD_TEST=PASS`).
- **Auditoria de Dependências**: 0 vulnerabilidades em dependências de produção (`npm audit --omit=dev`).

---

## 19. Histórico de Homologação dos Gates

- **Gate G.1 (Segurança & Governança)**: Centralização de logs estruturados e correção da terminologia de privacidade.
- **Gate G.2 (RBAC & Menor Privilégio)**: Implementação do papel `Atendente` e restrição a 29 operações autorizadas.
- **Gate G.3 (Fluxos Funcionais)**: Estabilização do acolhimento pela CGAO e transições de status de ocorrências.
- **Gate G.4 (Acessibilidade)**: Homologação nos fluxos auditados e gerenciamento de foco.
- **Gate G.5 (Responsividade UX)**: Validação em múltiplos viewports e zonas de toque.
- **Gate G.6 / G.6C3 (Operações & Scale Guard)**: Scripts de backup, imutabilidade do Firestore documentada e guard de escala.
- **Gate 0.9-H (Regressão Integral)**: Bateria automatizada completa executada com 100% de sucesso.
- **Gate 0.9-I (Homologação Visual)**: Verificação de renderização de telas e paleta visual institucional.
- **Gate 0.9-J / J.1 (Implantação Controlada & Estabilização)**: Go-live da 0.9.0 em produção, testes de fumaça e encerramento de acessos transitórios.

---

## 20. Estabilização da Versão 0.9.0

A versão 0.9.0 operou de forma estável em produção, comprovando a robustez dos fluxos transacionais, isolamento de papéis e integridade da infraestrutura. A auditoria adversarial de entrada para a 1.0.0 atestou:
- Ausência de necessidade de alterações funcionais de negócio;
- Ausência de necessidade de alterações na arquitetura de segurança;
- Ausência de necessidade de alterações no modelo de dados ou novas coleções Firestore;
- Ausência de necessidade de migrações (`MIGRATION_080_ALREADY_APPLIED=YES`).

### Classificação Formal da Release
- `VERSION_1_0_BUSINESS_FUNCTIONAL_CHANGE=NO`
- `VERSION_1_0_DATA_MODEL_CHANGE=NO`
- `VERSION_1_0_API_CONTRACT_CHANGE=NO`
- `VERSION_1_0_WORKER_FIRST_TIME_PRODUCTION_ACTIVATION=YES`
- `VERSION_1_0_OPERATIONAL_BEHAVIOR_CHANGE=YES`
- `WORKER_DEPLOYMENT_TYPE=FIRST_TIME_PROVISIONING` (o estado pré-1.0 comprovado na conta Cloudflare produtiva é `WORKER_ABSENT`; a ativação operacional do Worker ocorre pela primeira vez nesta release).

---

## 21. Riscos Residuais Conhecidos

- **Capacidade de Instância Única**: Fixação em `max-instances=1` limita a vazão simultânea pico, sendo adequada para a demanda acadêmica do campus mas requerendo atenção em eventos massivos.
- **Rate Limiting em Memória**: `RATE_LIMIT_SCOPE=INSTANCE_LOCAL` depende da manutenção da topologia de 1 instância única.
- **Ausência de Alertas Automatizados**: Monitoramento proativo por e-mail/SMS para erros 5xx ainda depende de configuração manual no Cloud Monitoring.
- **Prontidão Parcial de Backup de Fotos**: Scripts e rehearsals validados, mas bucket secundário offsite não opera em replicação contínua síncrona.

---

## 22. Roadmap Pós-1.0.0

1. **Rate Limiting Distribuído**: Adoção de rate limiting na borda (Cloudflare Rate Limiting) ou Redis/Valkey para viabilizar scale-out horizontal do Cloud Run.
2. **Alertas Automatizados**: Implantação de políticas de notificação automática de incidentes no Google Cloud Monitoring.
3. **Migração Regional do Firestore**: Planejamento de projeto de transferência do banco de dados de `us-west1` para São Paulo (`southamerica-east1`) para redução de latência em solo nacional.
4. **Replicação Off-site de Fotos**: Automação de backup periódico de fotografias do Cloudflare R2 para bucket frio independente.