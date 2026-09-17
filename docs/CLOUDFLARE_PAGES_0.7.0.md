# Cloudflare Pages — frontend da versão 0.7.0

## Build e publicação

1. Instale com `npm ci`.
2. Configure as variáveis públicas de build `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_APP_CHECK_ENABLED`, `VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY` e `VITE_API_BASE_URL`.
3. Use `VITE_USE_FIREBASE_EMULATORS=false` em produção.
4. Execute `npm run build:pages`.
5. Crie o projeto Pages e use `dist/client` como diretório de saída.
6. Publique somente depois de revisar o bundle. Este repositório não executa deploy automaticamente.

`VITE_API_BASE_URL` deve ser a origem HTTPS da API Cloud Run, sem `/api` final. O cliente monta os paths `/api/...`.

## Configuração cruzada

1. Adicione o domínio Pages e o domínio customizado em Firebase Authentication > Authorized domains.
2. Adicione os domínios ao App Check/reCAPTCHA Enterprise e use a site key correspondente.
3. No Cloud Run, defina `ALLOWED_WEB_ORIGINS` com cada origem HTTPS exata, separada por vírgula. Wildcard e origem com path são recusados.
4. Mantenha `APP_CHECK_ENFORCEMENT=true` em produção.

## SPA e segurança

`public/_redirects` direciona rotas não encontradas para `index.html`, preservando refresh em rotas React. `public/_headers` habilita `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e proteção contra framing.

Uma CSP estática não foi incluída porque as origens efetivas de Firebase Auth, Google Sign-In, reCAPTCHA/App Check e Cloud Run variam por implantação. Uma CSP incorreta bloquearia autenticação ou API. Antes de adicionar CSP, derive as origens reais da implantação e cubra login, App Check e API com testes; não use uma política ampla apenas para facilitar publicação.

## Homologação

- abrir `/` e atualizar uma rota interna;
- registrar ocorrência sem foto e com foto;
- consultar por protocolo + chave;
- autenticar Administrador com Google;
- validar que Gestor não acessa rotas exclusivas;
- verificar fotos internas e publicadas;
- confirmar CORS aceitando o Pages e recusando origem estranha;
- inspecionar `dist/client` e a aba Network para confirmar ausência de secrets Resend, R2, HMAC e credenciais privadas Firebase.

O arquivo público `firebase-applet-config.json` pode conter identificadores Firebase e `storageBucket` por compatibilidade de Auth/App Check/AI Studio. Isso não converte o Firebase Storage no armazenamento produtivo das fotos.
