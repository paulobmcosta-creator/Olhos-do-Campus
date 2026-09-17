# Relatório de Inspeção e Validação do Pacote ZIP — Versão 0.7.6

**Arquivo Inspecionado:** `olhos-do-campus-0.7.6.zip`  
**Localização do Pacote:** `c:\Projetos\Sistema de Infraestrutura\olhos-do-campus-0.7.6.zip`  
**Arquivo Sidecar de Integridade:** `c:\Projetos\Sistema de Infraestrutura\olhos-do-campus-0.7.6.zip.sha256`  
**Data da Inspeção:** 2026-08-24  

> **Nota Metodológica de Integridade Criptográfica:**  
> O SHA-256 definitivo do artefato de distribuição reside exclusivamente no arquivo sidecar externo `olhos-do-campus-0.7.6.zip.sha256`, gerado logo após o empacotamento. Este documento interno registra os critérios estruturais validados, integridade dos componentes, método de geração, comandos de conferência e regras de aceitação.

---

## 1. Verificação Estrutural de Raiz Única

A análise de entradas do pacote confirma conformidade com o padrão de entrega institucional de **raiz única**:
- **Raiz Única Identificada:** `olhos-do-campus-0.7.6/` (todas as entradas prefixadas com a raiz única).
- **Ausência de Aninhamento Redundante:** O pacote **NÃO** contém subpastas duplicadas como `olhos-do-campus-0.7.6/olhos-do-campus-0.7.6/` (0 entradas).
- **Entradas:** Arquivos essenciais devidamente limpos de artefatos de build temporários, dependências e logs.
- **Tamanho e Checksum:** O tamanho final do ZIP e o SHA-256 são calculados externamente após o empacotamento e registrados no arquivo sidecar (`olhos-do-campus-0.7.6.zip.sha256`) e na devolutiva da versão.

---

## 2. Auditoria de Conteúdo e Ausência de Arquivos Proibidos

| Critério de Inspeção | Resultado da Validação | Detalhes |
| :--- | :---: | :--- |
| **Ausência de `node_modules/`** | **CONFORME** | 0 dependências ou pacotes compilados presentes. |
| **Ausência de `.git/`** | **CONFORME** | 0 metadados de versionamento local. |
| **Ausência de `.env` e segredos** | **CONFORME** | Apenas `.env.example` sanitizado está presente. |
| **Ausência de arquivos de build (`dist/`)** | **CONFORME** | Código-fonte limpo para build reproduzível no destino. |
| **Presença dos relatórios 0.7.6** | **CONFORME** | `RELATORIO_IMPLEMENTACAO_0.7.6.md`, `TESTES_0.7.6.md` e relatórios documentais incluídos. |
| **Presença de testes obrigatórios** | **CONFORME** | 60 arquivos de teste no total (3 Firebase/Storage executados separadamente, 57 na suíte regular: 55 passados, 2 opt-in skipped). |

---

## 3. Amostra da Árvore de Arquivos Inspecionada

```
olhos-do-campus-0.7.6/
├── .dockerignore
├── .env.example
├── .firebaserc
├── .gitignore
├── CHANGELOG.md
├── cloudbuild.yaml
├── Dockerfile
├── eslint.config.js
├── firebase-applet-config.json
├── firebase-blueprint.json
├── firebase.ai-studio.json
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── index.html
├── package.json
├── package-lock.json
├── RELATORIO_IMPLEMENTACAO_0.7.6.md
├── TESTES_0.7.6.md
├── INSPECAO_ZIP_FINAL_0.7.6.md
├── docs/
│   ├── ARQUIVOS_0.7.6.md
│   ├── EWS_CONFIGURACAO_0.7.6.md
│   ├── HOMOLOGACAO_MANUAL_0.7.6.md
│   └── IMPLANTACAO_0.7.6.md
├── infra/
│   └── cloudflare/maintenance-worker/
├── server/
│   ├── app.ts
│   ├── config/
│   ├── domain/
│   ├── models/
│   ├── providers/
│   │   ├── emailProvider.ts
│   │   ├── ewsEmailProvider.ts
│   │   ├── resendEmailProvider.ts
│   │   └── ews/
│   │       ├── ewsSoap.ts
│   │       ├── ntlmClient.ts
│   │       └── ntlmCrypto.ts
│   ├── repositories/
│   ├── services/
│   └── utils/
├── src/
└── tests/
```
