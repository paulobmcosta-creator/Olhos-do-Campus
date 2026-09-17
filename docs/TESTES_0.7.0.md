# Testes — versão 0.7.0

Data: 2026-08-18. Ambiente: Windows/PowerShell, Node fornecido pelo runtime local. Nenhuma chamada de deploy foi feita.

## Resultado final sobre instalação limpa

| Comando | Resultado |
|---|---|
| `npm ci` | PASSOU — 1.198 pacotes instalados; 0 vulnerabilidades |
| `npm run typecheck` | PASSOU |
| `npm run lint` | PASSOU — zero warnings permitidos |
| `npm run test` | PASSOU — 41 arquivos aprovados, 2 opt-in ignorados; 213 testes aprovados, 2 ignorados |
| `npm run worker:typecheck` | PASSOU |
| `npm run worker:test` | PASSOU — 1 arquivo, 4 testes |
| `npm run build` | PASSOU — cliente e servidor |
| `npm audit` | PASSOU — 0 vulnerabilidades |
| `npm audit --omit=dev` | PASSOU — 0 vulnerabilidades |
| validação JSON de applet, blueprint, metadata e indexes | PASSOU |

O build foi executado com valores públicos temporários de validação para todas as variáveis `VITE_FIREBASE_*`, App Check e `VITE_API_BASE_URL=https://api.validation.invalid`. Nenhuma credencial real foi usada. Artefatos: JS principal 684,09 kB minificado/176,17 kB gzip; o Vite emitiu aviso de chunk acima de 500 kB, registrado como risco residual.

## Firebase Emulator Suite

`npm run test:rules` foi efetivamente invocado, mas o Firebase CLI encerrou antes de iniciar os emuladores:

```text
Error: Could not spawn `java -version`. Please make sure Java is installed and on your system PATH.
```

Resultado: **BLOQUEADO PELO AMBIENTE — Java/JRE ausente.**

Pelo mesmo pré-requisito comprovadamente ausente:

- `npm run test:firebase`: **NÃO EXECUTADO — requer Java/JRE para o Firebase Emulator Suite**;
- `npm run test:storage`: **NÃO EXECUTADO — requer Java/JRE para o Firebase Storage Emulator**.

`test:storage` é somente teste local da abstração com Firebase Storage Emulator. Produção usa R2.

## Integrações externas opt-in

| Comando/recurso | Resultado |
|---|---|
| `npm run test:r2` | comando passou; 1 teste ignorado — chamada real NÃO EXECUTADA por ausência de credenciais/bucket descartável |
| `npm run test:resend` | comando passou; 1 teste ignorado — envio real NÃO EXECUTADO por ausência de credenciais/destinatário autorizado |
| Cloudflare Pages real | NÃO EXECUTADO — requer projeto/domínio externo |
| Cloud Run real | NÃO EXECUTADO — requer projeto/revisão externa |
| Maintenance Worker real | NÃO EXECUTADO — requer conta, secret e backend externo |
| Artifact Registry snapshot/cleanup | NÃO EXECUTADO — requer `gcloud`, permissão e repositório externo |
| Migração Firebase Storage → R2 | NÃO EXECUTADO — requer acesso aos buckets reais |

## Cobertura adicionada

- Resend/outbox: determinismo, idempotência, destinatários, lease, retries/erros/quota, configuração, REAL/TEST, flag, teste administrativo, webhook e privacidade;
- R2: fake S3, path, CRUD, metadata, inexistência, falha, compensação, cleanup, fallback e reconciliação segura;
- Pages/CORS: origem, preflight, headers, API base, SPA e API only;
- infraestrutura: snapshot/histórico/estimativa, limites, thresholds, projeções, ausência de dados, Artifact e autorização;
- Worker/HMAC: assinatura compatível, timestamp/replay/path/secret e endpoints.

## Baseline antes da edição

`npm ci` e typecheck passaram. Lint falhou por configuração do parser para `.mjs`. A suíte existente registrou 155 testes aprovados e 9 falhas, ligadas ao applet config vazio, contrato antigo de ocorrência JSON versus multipart, conflito sem mensagem, seleção de foto obsoleta, spawn `npm.cmd` no Windows e blueprint sem `lastSequence`. Esses pontos foram corrigidos e a regressão final passou.

