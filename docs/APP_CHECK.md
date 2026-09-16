# Firebase App Check — versão 0.5.0

## 1. Objetivo

App Check reduz o uso indevido das APIs por clientes não reconhecidos. Não substitui autenticação, autorização, validação Zod, regras do Firestore ou controles de infraestrutura.

## 2. Provedor de produção

A integração utiliza **reCAPTCHA Enterprise**. A chave pública do site é informada em:

```dotenv
VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY=REPLACE_WITH_PUBLIC_SITE_KEY
VITE_APP_CHECK_ENABLED=true
```

O token é obtido pelo Firebase SDK, renovado automaticamente e enviado em:

```http
X-Firebase-AppCheck: <token>
```

O backend verifica o token com Firebase Admin SDK.

## 3. APIs protegidas

App Check é aplicado a:

- bootstrap público de configuração;
- criação de ocorrência;
- acompanhamento por protocolo e chave;
- sessão administrativa;
- listagem, consulta e atualização administrativa;
- indicadores;
- configurações;
- lista de responsáveis;
- gestão de usuários;
- auditoria.

`GET /api/health` é isento e não retorna configuração Firebase, domínios ou usuários.

## 4. Produção

O frontend falha na inicialização quando:

- `VITE_APP_CHECK_ENABLED` não é `true`;
- configuração Firebase ou chave pública está ausente;
- emuladores ou debug estão habilitados.

O servidor falha quando `APP_CHECK_ENFORCEMENT` não é `true` em `NODE_ENV=production`.

## 5. Desenvolvimento e debug token

O modo de debug depende simultaneamente de:

```dotenv
VITE_APP_CHECK_ENABLED=true
VITE_APP_CHECK_DEBUG=true
```

Ele somente é aceito em desenvolvimento. O SDK gera ou utiliza um debug token que deve ser cadastrado no console Firebase para o aplicativo de desenvolvimento. O token real não deve ser incluído em `.env.example`, documentação, logs ou ZIP.

Com emuladores locais e `APP_CHECK_ENFORCEMENT=false`, o token pode ser omitido. Isso não altera a exigência de ID Token e autorização.

## 6. Cadastro do aplicativo

1. Abra App Check no console Firebase.
2. Registre o aplicativo Web correto.
3. Selecione reCAPTCHA Enterprise.
4. Cadastre domínios autorizados.
5. Informe a chave pública por variável de ambiente.
6. Valide telemetria antes da aplicação de enforcement.
7. Ative enforcement no backend e nos produtos compatíveis.

## 7. Testes

Os testes unitários injetam um verificador controlado no servidor. Isso valida o fluxo de middleware, mas não comprova o serviço real. A validação real exige um projeto Firebase e uma chave reCAPTCHA Enterprise configurados.
