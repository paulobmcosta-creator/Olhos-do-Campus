# Firebase App Check — versão 0.7.0

App Check reduz uso indevido por clientes não reconhecidos; não substitui Auth, autorização, CORS, validação Zod ou regras deny-all.

## Pages e reCAPTCHA Enterprise

Configure no build do Cloudflare Pages:

```dotenv
VITE_APP_CHECK_ENABLED=true
VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY=<chave-publica-do-site>
```

Cadastre todos os domínios Pages/customizados no Firebase Authentication e no App Check/reCAPTCHA Enterprise. A chave é pública; tokens de debug e credenciais de serviço não são.

O SDK renova o token e a API recebe `X-Firebase-AppCheck`. Em produção o backend exige `APP_CHECK_ENFORCEMENT=true`; emuladores e debug são recusados. `GET /api/health`, o webhook Resend assinado e endpoints internos HMAC usam seus controles específicos.

## Desenvolvimento

Auth, Firestore e Storage Emulator devem ser configurados conjuntamente. Com `APP_CHECK_ENFORCEMENT=false`, o token pode ser omitido localmente, sem remover ID Token/autorização. Se usar debug token em app Firebase real, mantenha-o somente no ambiente local e cadastre-o no console.

## Homologação

1. Valide telemetria antes do enforcement.
2. Teste registro/consulta pública e Google Sign-In a partir do domínio Pages.
3. Confirme que domínio não cadastrado ou token inválido é recusado.
4. Consulte o uso no console Firebase/reCAPTCHA; o painel interno não substitui a métrica do provedor.
5. Não inclua tokens em logs, ZIP ou tickets.
