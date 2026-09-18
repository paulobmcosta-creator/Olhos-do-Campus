# Cloudflare Pages via GitHub Actions — produção 1.0.0

## Objetivo

Publicar o frontend do Sistema Institucional de Manutenção da Infraestrutura Física no projeto Cloudflare Pages `olhos-do-campus` por GitHub Actions, mantendo o build e a validação no GitHub e evitando depender das variáveis de build do pipeline automático do Cloudflare Pages.

## Workflow

Arquivo:

`.github/workflows/deploy-cloudflare-pages.yml`

O workflow é inicialmente manual (`workflow_dispatch`) para impedir publicação antes da configuração das variáveis e credenciais.

Etapas executadas:

1. checkout explícito da branch `main`;
2. Node.js 22.22.2;
3. validação das variáveis obrigatórias;
4. `npm ci`;
5. `npm run typecheck`;
6. `npm run lint`;
7. `npm run test`;
8. `npm run build:pages`;
9. inspeção do bundle para confirmar incorporação da API, Firebase App ID e chave reCAPTCHA Enterprise;
10. publicação de `dist/client` com Wrangler no projeto Pages `olhos-do-campus`.

## GitHub Actions Variables

Configurar em **Settings > Secrets and variables > Actions > Variables**:

- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY`

As políticas de produção abaixo ficam fixadas no workflow:

- `VITE_USE_FIREBASE_EMULATORS=false`
- `VITE_APP_CHECK_ENABLED=true`
- `VITE_APP_CHECK_DEBUG=false`

## GitHub Actions Secret

Configurar em **Settings > Secrets and variables > Actions > Secrets**:

- `CLOUDFLARE_API_TOKEN`

O token deve possuir somente as permissões necessárias para publicar no Cloudflare Pages da conta correspondente.

## Cloudflare Pages

O projeto existente pode continuar conectado ao GitHub, porém os builds automáticos do Cloudflare Pages devem ser desabilitados antes de adotar o GitHub Actions como pipeline de produção. O Wrangler pode publicar diretamente em um projeto Pages já integrado ao Git depois que os builds automáticos forem desativados.

A branch de produção deve permanecer `main`.

## CSP

`public/_headers` deve autorizar a origem HTTPS da API Cloud Run utilizada em `VITE_API_BASE_URL` em `connect-src`. Não ampliar a política com curingas apenas para facilitar a publicação.

## Ativação

1. garantir que a branch padrão do repositório voltou a ser `main`;
2. configurar Variables e Secret no GitHub;
3. desabilitar deployments automáticos de produção e preview no Cloudflare Pages;
4. executar manualmente o workflow **Deploy Cloudflare Pages**;
5. revisar todas as etapas e confirmar sucesso;
6. verificar o bundle publicado;
7. homologar `https://olhos-do-campus.pages.dev`;
8. somente após a primeira execução bem-sucedida, avaliar adicionar gatilho automático em `push` para `main`.

## Homologação mínima pós-deploy

- carregamento da página inicial;
- ausência de erro de App Check;
- registro de ocorrência;
- protocolo e chave de acompanhamento;
- consulta pública;
- upload e leitura de fotografia;
- autenticação administrativa Google;
- alteração de situação com histórico;
- separação entre mensagem pública e observação interna;
- conclusão da ocorrência;
- `/api/health` do backend permanecendo em versão 1.0.0.
