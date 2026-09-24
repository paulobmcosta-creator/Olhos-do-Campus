# Olhos do Campus

**Sistema Institucional de Manutenção da Infraestrutura Física**  
**Instituto Federal do Espírito Santo — Campus Barra de São Francisco**  
**Versão 1.0.1**

Aplicação institucional para registro de ocorrências de manutenção da infraestrutura física sem identificação pessoal obrigatória, acompanhamento por protocolo e chave de acompanhamento no portal público, e gestão operacional e administrativa pelo corpo técnico e gestor do IFES Campus Barra de São Francisco.

A versão 1.0.1 acrescenta controles de gestão operacional para classificar registros de teste e apensar ocorrências duplicadas ou similares. Registros TEST permanecem auditáveis, mas são excluídos dos indicadores operacionais padrão; ocorrências apensadas preservam seus registros individuais e compartilham o tratamento operacional definido para o agrupamento.

---

## 1. Arquitetura

O sistema adota uma arquitetura em camadas com desacoplamento rigoroso entre a camada de apresentação web, serviços de API, persistência de dados e serviços transacionais:

```text
Cloudflare Pages (Frontend SPA — React 19 / TypeScript / Vite)
  │
  ▼ [HTTPS / CORS restrito / App Check]
Cloud Run (Backend API — Node.js 22 / Express / TypeScript)
  ├── Autenticação & Autorização:
  │     ├── Firebase Authentication (Sessões anônimas públicas e Google Sign-In administrativo)
  │     └── Firebase App Check (Attestation de integridade)
  ├── Persistência de Dados e Metadados:
  │     └── Google Cloud Firestore (Banco de dados nomeado: ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf em us-west1)
  ├── Armazenamento de Fotografias:
  │     └── Cloudflare R2 (Bucket privado S3-compatible, com stripping de EXIF e re-encoding WebP no backend)
  ├── Mensageria e Notificações Transacionais:
  │     ├── Exchange Web Services / EWS NTLMv2 institucional (Provedor primário)
  │     └── Resend (Provedor alternativo / histórico preservado)
  └── Rotinas Periódicas de Manutenção:
        └── Cloudflare Maintenance Worker (Disparo agendado via HMAC para rotas internas de manutenção)
```

O cliente web no navegador nunca acessa o Firestore nem os buckets de armazenamento de fotos diretamente. Todas as operações transitam exclusivamente pelo backend Cloud Run, que atua como mediador seguro de regras de negócio, autorização e sanitização. As regras de segurança (`firestore.rules` e `storage.rules`) são configuradas em modo *deny-all*.

---

## 2. Componentes Implantáveis

A release 1.0.1 possui três componentes implantáveis e versionados de forma unificada:

1. **Cloud Run Backend (`CLOUD_RUN_BACKEND`)**: Serviço containerizado Node.js 22 rodando a API REST Express, executando a lógica de negócio, RBAC, auditoria, outbox de notificações e processamento de fotografias.
2. **Cloudflare Pages Frontend (`CLOUDFLARE_PAGES_FRONTEND`)**: Single Page Application (SPA) construída com React 19 e Vite, servindo a interface pública para a comunidade acadêmica e o painel administrativo restrito.
3. **Cloudflare Maintenance Worker (`CLOUDFLARE_MAINTENANCE_WORKER`)**: Worker serverless na borda da Cloudflare responsável pelo agendamento periódico (cron) de chamadas autenticadas via HMAC para os endpoints de manutenção do backend.

---

## 3. Fluxo Público de Ocorrências

- **Registro sem Identificação Pessoal Obrigatória**: Qualquer membro da comunidade acadêmica ou visitante pode registrar problemas de infraestrutura física sem necessidade de login prévio ou fornecimento de dados pessoais (como nome, CPF ou e-mail).
- **Classificação e Localização**: Seleção orientada por categoria de manutenção e ambiente canônico institucional dentro dos blocos do campus.
- **Descrição e Fotografias**: Descrição textual da ocorrência e anexo opcional de fotos probatórias da avaria.
- **Protocolo e Chave de Acompanhamento**: Ao submeter a ocorrência com sucesso, o cidadão recebe imediatamente:
  - Um **número de protocolo** público sequencial/canônico;
  - Uma **chave de acompanhamento** única, de uso exclusivo do autor para consultas futuras.
- **Consulta de Status e Mensagens**: O acompanhamento do andamento da ocorrência e a visualização de respostas ou mensagens públicas da administração são realizados via formulário com protocolo e chave de acompanhamento submetidos fora da URL.

---

## 4. Gestão Administrativa e Controle de Acesso (RBAC)

O acesso ao painel administrativo requer autenticação segura via **Google Sign-In administrativo com restrições institucionais configuradas**. O sistema implementa controle de acesso baseado em papéis (RBAC) com mínimo privilégio:

- **Administrador**: Controle pleno do sistema, gerenciamento de usuários administrativos, equipes operacionais, configurações de e-mail e capacidade, categorias, ambientes e auditoria global.
- **Gestor**: Triagem e roteamento de ocorrências, priorização, redistribuição entre setores e equipes, acompanhamento operacional global, classificação de registros REAL/TEST e gestão de apensamentos.
- **Atendente**: Papel de menor privilégio; acesso restrito estritamente às ocorrências atribuídas individualmente (`assignedToAdminUserId === user.id`), com permissão para adicionar notas internas com visibilidade delimitada, transitar status autorizados e registrar fotos de conclusão/solução.
- **Equipe CGAO**: A Coordenação Geral de Administração, Orçamento e Finanças atua como equipe inicial canônica de acolhimento e triagem institucional das demandas.
- **Histórico e Notas Internas**: Registro de auditoria append-only para cada evento de mudança de estado, comentários internos com controle de audiência (`INTERNAL` vs `RESPONSIBLE_TEAM`) e fotos de solução com publicação pública condicionada a aprovação explícita.
- **Registros de teste e apensamento**: Gestores e Administradores podem classificar ocorrências como `TEST`; esses registros não compõem dashboard, indicadores ou relatórios operacionais padrão. Ocorrências duplicadas ou similares podem ser apensadas sem fusão destrutiva: situação, prioridade, equipe, responsável, SLA e classificação REAL/TEST são sincronizados no grupo, enquanto protocolo, chave de acompanhamento, descrição, dados reportados, fotos e observações permanecem individualizados.

---

## 5. Infraestrutura e Ambientes Físicos

- **Topologia de Ambientes**: Mapeamento de 60 ambientes institucionais canônicos do IFES — Campus Barra de São Francisco (distribuídos entre Bloco 01: 28 ambientes, Bloco 02: 26 ambientes, Bloco 03: 2 ambientes, e Áreas Externas: 4 ambientes).
- **Banco de Dados**: Instância nomeada do Google Cloud Firestore:
  - `FIRESTORE_DATABASE_ID`: `ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf`
  - `FIRESTORE_LOCATION`: `us-west1`
  *(Nota de Governança: A localização do Firestore é imutável in-place; a eventual migração para região geográfica mais próxima como São Paulo `southamerica-east1` está documentada como roadmap pós-1.0 através de export/import e cutover planejado).*
- **Armazenamento de Fotografias (Cloudflare R2)**: Armazenamento produtivo de fotografias em bucket privado compatível com S3. As imagens sofrem stripping completo de metadados EXIF/XMP e re-encoding em WebP antes da persistência. Status de prontidão de backup: `PHOTO_BACKUP_READINESS=PARTIAL` (rehearsals locais aprovados; replicação geográfica/off-site formal compõe o roadmap).
- **Limitação de Topologia e Rate Limiting**:
  - `RATE_LIMIT_SCOPE=INSTANCE_LOCAL`: O rate limiter ativo opera localmente na memória do processo backend.
  - Para garantir a eficácia do rate limiting na topologia atual, o Cloud Run é fixado estritamente em 1 instância máxima (`--max=1` / `--max-instances=1`), assegurado por verificador automatizado (*Scale Guard*).
  - A eventual ampliação da capacidade através de scale-out horizontal exigirá a implementação prévia de rate limiting distribuído ou na borda (edge).

---

## 6. Rotinas de Manutenção e Snapshots Técnicos

- O Cloudflare Maintenance Worker dispara chamadas periódicas assinadas por HMAC para rotas internas de manutenção no backend. O processamento do snapshot de infraestrutura ocorre no backend.
- O Worker não realiza processamento local de banco de dados; sua atribuição é exclusivamente atuar como disparador confiável e autenticado de cron na borda.
- As chamadas distinguem rotas de alta frequência (drenagem do outbox de notificações) e rotas diárias de agregação técnica (snapshots de infraestrutura e capacidade para o painel administrativo).

---

## 7. Chave de Acompanhamento (Tracking Key)

- A chave de acompanhamento é composta por 12 caracteres aleatórios distribuídos em três quartetos (`XXXX-XXXX-XXXX`), gerada por CSPRNG (`randomInt`) sobre um alfabeto de 32 símbolos alfanuméricos legíveis (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), evitando caracteres ambíguos.
- Apresenta aproximadamente 60 bits de entropia teórica (32^12 = 2^60).
- A chave em texto claro é exibida uma única vez ao usuário no momento da criação da ocorrência e **não é armazenada em texto claro no banco de dados**. O backend persiste apenas o hash derivado por `scrypt` com salt criptográfico individual de 16 bytes.

---

## 8. Acessibilidade e Experiência do Usuário

A aplicação passou por homologação pós-fix de acessibilidade nos fluxos e critérios auditados, incluindo navegação por teclado, gerenciamento de foco, semântica de formulários, modais e reflow responsivo. Essa homologação não constitui declaração de conformidade global WCAG.

---

## 9. Operações e Ciclo de Desenvolvimento

### Requisitos de Ambiente Local

- **Node.js**: `>=22.22.2 <23` (homologado na versão `v22.23.2`)
- **npm**: `>=10.0.0` (homologado na versão `10.9.8`)
- **Java**: OpenJDK 21 LTS (necessário para execução local do Firebase Emulator Suite)

### Instalação

```bash
# Instalação estrita e determinística das dependências
npm ci
```

### Pipelines de Qualidade e Verificação

```bash
# Checagem estática de tipos TypeScript
npm run typecheck

# Análise de linting (ESLint com zero tolerância a avisos)
npm run lint

# Execução da suíte principal de testes automatizados (Vitest)
npm run test

# Build de produção do cliente (Vite) e do servidor (esbuild)
npm run build

# Validação integrada (typecheck + lint + test + build)
npm run validate

# Checagem de tipos do Cloudflare Maintenance Worker
npm run worker:typecheck

# Testes automatizados do Cloudflare Maintenance Worker
npm run worker:test

# Testes de regras de segurança no Firebase Emulator (Firestore e Storage)
npm run test:rules

# Testes de integração Firebase no Emulator
npm run test:firebase

# Testes de integração de Storage no Emulator
npm run test:storage

# Verificação formal de conformidade da release 1.0.1 (13 truth points)
npm run verify:release

# Verificação da invariante de segurança de escala (Scale Guard)
npm run check:scale
```

---

## 10. Segurança e Responsabilidade Operacional

- **Princípio da Transparência**: O sistema não alega "anonimato absoluto" ou "segurança incondicional". O fluxo público oferece registro sem identificação pessoal obrigatória, garantindo privacidade nos metadados de domínio sob responsabilidade do software.
- **Sanitização de Mídia**: Todas as imagens enviadas passam por validação de formato e tamanho, re-encoding forçado para formato WebP e expurgo determinístico de metadados EXIF e XMP.
- **Comunicação por E-mail**: E-mails de notificação institucional não contêm chaves de acompanhamento, hashes, descrições detalhadas da ocorrência, anexos fotográficos ou endereços IP.
- **Ausência de Credenciais em Código**: O repositório não contém segredos, chaves privadas ou senhas hardcoded. Todas as configurações confidenciais são providas via variáveis de ambiente seguras (`.env.example` serve como referência não confidencial).