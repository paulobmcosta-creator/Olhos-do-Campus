# GUIA DE INSTALAÇÃO E IMPLANTAÇÃO — VERSÃO 0.8.0

## SISTEMA INSTITUCIONAL DE MANUTENÇÃO DA INFRAESTRUTURA FÍSICA — OLHOS DO CAMPUS

---

## 1. Requisitos de Ambiente

* **Node.js**: `>=22.22.2 <23` (recomendado: `v22.22.2`)
* **npm**: `>=10.0.0` (recomendado: `10.9.7`)
* **Java JDK**: `>=21` (obrigatório para Firebase Emulator Suite; recomendado: `OpenJDK 21 LTS`)
* **Firebase CLI**: `>=15.0.0` (recomendado: `15.25.1`)

---

## 2. Instalação e Validação Local

```powershell
# 1. Instalação limpa e determinística das dependências
npm ci

# 2. Validação estática de tipos TypeScript
npm run typecheck

# 3. Análise estática de código com linter
npm run lint

# 4. Execução da suíte principal de testes unitários e de integração
npm run test

# 5. Compilação do cliente SPA (Vite) e do servidor Node (esbuild)
npm run build

# 6. Validação completa integrada
npm run validate
```

---

## 3. Execução da Firebase Emulator Suite

```powershell
# Configurar JAVA_HOME apontando para o JDK 21
$env:JAVA_HOME = "C:\Users\Extensão - Ifes Bsf\.cache\jdk21"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Testes de regras de segurança do Firestore e Storage
npm run test:rules

# Testes de integração de domínio persistente no Firestore
npm run test:firebase

# Testes de processamento e persistência no Storage
npm run test:storage
```

---

## 4. Arquitetura de Implantação em Produção

```text
[Usuário / Navegador]
       │
       ▼ (HTTPS)
[Cloudflare Pages] (Frontend SPA Estático)
       │
       ▼ (API REST / App Check / Auth Token)
[Google Cloud Run] (Backend Express / Node 22)
       ├──▶ [Cloud Firestore Enterprise] (Banco de Dados Primário)
       ├──▶ [Cloudflare R2] (Armazenamento de Fotografias WebP)
       └──▶ [EWS - webmail.ifes.edu.br] (Notificações Institucionais SOAP NTLM)
```

---

## 5. Roteiro Sugerido de Implantação Futura (Não Executar Agora)

1. **Backup Completo**: Executar exportação/backup dos documentos do Firestore e metadados.
2. **Migração em Dry-Run**: Executar `scripts/migrate080.ts --dry-run` e `scripts/cleanupArtificialLocations.ts --dry-run`.
3. **Revisão Humana**: Auditar os relatórios JSON gerados.
4. **Aplicação da Migração**: Executar `scripts/migrate080.ts --apply` com `ALLOW_080_MIGRATION`.
5. **Deploy do Backend (Cloud Run)**: Implantar com flag `--no-traffic` e traffic tag determinística.
6. **Deploy do Frontend (Cloudflare Pages)**: Publicar nova revisão estática.
7. **Smoke Tests e Promoção**: Validar rotas de saúde e promover tráfego para 100%.
