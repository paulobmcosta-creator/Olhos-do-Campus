# Relatório de Testes — Versão 0.7.7

**Sistema:** Sistema Institucional de Manutenção da Infraestrutura Física  
**Data da validação operacional:** 25–26/08/2026  
**Runtime homologado:** Node.js `v22.22.2` / npm `10.9.7`

## 1. Objetivo

Validar a correção do framing HTTP da segunda etapa NTLM utilizada pelo provedor EWS, comprovar ausência de regressões na aplicação e demonstrar, em ambiente real, que a implementação 0.7.7 elimina o erro `EWS_EMPTY_RESPONSE` observado na candidata 0.7.6.

## 2. Instalação limpa

Comando:

```bash
npm ci
```

A primeira tentativa foi interrompida por limitação ambiental do Google Cloud Shell (`ENOSPC: no space left on device`). O problema foi resolvido exclusivamente com remoção de diretórios `node_modules` regeneráveis de árvores antigas do mesmo projeto, sem alteração de código, ZIPs ou evidências.

Nova execução em Node `v22.22.2`:

```text
added 1204 packages, and audited 1205 packages in 30s
found 0 vulnerabilities
```

**Resultado:** PASS.

## 3. TypeScript

Comando:

```bash
npm run typecheck
```

Resultado observado:

```text
TYPECHECK_STATUS=0
TYPECHECK=PASS
```

**Resultado:** PASS.

## 4. Lint

Comando:

```bash
npm run lint
```

Resultado observado:

```text
LINT_STATUS=0
LINT=PASS
```

**Resultado:** PASS.

## 5. Teste regressivo específico do framing NTLM 0.7.7

Comando:

```bash
vitest run tests/ntlmHttpFraming077.test.ts
```

Resultado observado:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
NTLM_FRAMING_REGRESSION=PASS
```

A suíte cobre:

- `Content-Length` calculado em bytes para `string` UTF-8;
- corpo `Buffer`;
- substituição de `Content-Length` externo incorreto;
- remoção case-insensitive de `Transfer-Encoding`;
- preservação de headers não conflitantes;
- ausência de `Content-Length` quando não existe corpo.

**Resultado:** PASS.

## 6. Suíte principal

Comando:

```bash
npm test
```

Resultado observado:

```text
Test Files  56 passed | 2 skipped (58)
Tests       390 passed | 3 skipped (393)
MAIN_TEST_STATUS=0
MAIN_TEST_SUITE=PASS
```

Os testes opt-in de integração externa permaneceram ignorados na suíte principal conforme projeto. As mensagens de `stderr` para App Check e ID Token correspondem a cenários negativos intencionais e não representaram falha da suíte.

**Resultado:** PASS.

## 7. Maintenance Worker

### Typecheck

```bash
npm run worker:typecheck
```

Resultado:

```text
WORKER_TYPECHECK_STATUS=0
WORKER_TYPECHECK=PASS
```

### Testes

```bash
npm run worker:test
```

Resultado:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
WORKER_TEST_STATUS=0
WORKER_TEST=PASS
```

**Resultado:** PASS.

## 8. Build de produção local

Comando:

```bash
npm run build
```

Resultado observado:

```text
BUILD_STATUS=0
SERVER_BUNDLE_PRESENT=YES
LOCAL_PRODUCTION_BUILD=PASS
```

Artefatos principais gerados:

- `dist/client/index.html`;
- bundle frontend Vite;
- `dist/server/index.js`;
- source map do servidor.

O Vite emitiu apenas aviso não bloqueante sobre chunk JavaScript superior a 500 kB após minificação.

**Resultado:** PASS.

## 9. Diagnóstico EWS real somente leitura — implementação nativa 0.7.7

Foi executado `GetFolder` contra `https://webmail.ifes.edu.br/EWS/Exchange.asmx`, usando diretamente `executeNtlmRequest()` da 0.7.7, sem workaround externo de `Content-Length` e sem `CreateItem`.

Credenciais foram injetadas pelo Secret Manager usando as versões numéricas previamente fixadas, sem exibição de valores.

Resultado observado:

```text
STATUS_CODE=200
STATUS_MESSAGE=OK
BODY_BYTES=1190
CONTENT_TYPE=text/xml; charset=utf-8
SOAP_RESPONSE_CLASS=Success
SOAP_RESPONSE_CODE=NoError
EWS_GETFOLDER_NATIVE_077=PASS
DIAGNOSTIC_PROCESS_STATUS=0
```

**Resultado:** PASS.

Esta é a prova operacional de que o framing corrigido está efetivamente incorporado à implementação 0.7.7.

## 10. Teste EWS real opt-in

Comando:

```bash
RUN_EWS_INTEGRATION=true npm run test:ews
```

Parâmetros não secretos utilizados:

```text
EWS_URL=https://webmail.ifes.edu.br/EWS/Exchange.asmx
EWS_DOMAIN=UPD1
EWS_FROM=cgao.bsf@ifes.edu.br
EWS_TEST_RECIPIENT=pauloborges@id.uff.br
```

Secrets utilizados sem exibição de valor:

```text
odc-ews-username:1
odc-ews-password:1
```

Resultado observado:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
EWS_TEST_PROCESS_STATUS=0
EWS_REAL_077=PASS
```

O teste `estabelece handshake NTLM e despacha CreateItem SOAP com SendAndSaveCopy para o Exchange real` foi aprovado.

**Resultado técnico:** PASS.

## 11. Confirmação humana de recebimento

O destinatário controlado confirmou recebimento na caixa de entrada da mensagem:

```text
[TESTE EWS] Verificação de integração 0.7.7 - 2026-08-26T01:45:08.774Z
```

Remetente observado:

```text
Coordenadoria Geral de Administração, Orçamento e Finanças <cgao.bsf@ifes.edu.br>
```

Conteúdo confirmou handshake NTLM e envio SOAP `SendAndSaveCopy` concluídos com sucesso.

**Resultado humano:** PASS.

## 12. Resultado consolidado

| Gate | Resultado |
| --- | --- |
| Node `>=22.22.2 <23` | PASS |
| `npm ci` | PASS |
| vulnerabilidades npm | 0 |
| TypeScript | PASS |
| lint | PASS |
| regressão NTLM 0.7.7 | PASS — 4/4 |
| suíte principal | PASS — 390/390 executados |
| Maintenance Worker typecheck | PASS |
| Maintenance Worker testes | PASS — 4/4 |
| build local de produção | PASS |
| EWS `GetFolder` read-only nativo | PASS — HTTP 200 / Success / NoError |
| EWS real `CreateItem` opt-in | PASS — 2/2 |
| confirmação humana de recebimento | PASS |

## 13. Itens ainda não executados nesta fase

Ainda não foram executados sobre o artefato final 0.7.7:

- Cloud Build da imagem final;
- comparação entre digest do Cloud Build e Artifact Registry;
- criação da revisão Cloud Run `ews077` com `--no-traffic`;
- health check da revisão `ews077`;
- prova pós-deploy de que a produção 0.6.2 permanece com 100% do tráfego ordinário.

Esses itens pertencem ao gate de release subsequente e não devem ser confundidos com a validação do código e da integração EWS concluída neste relatório.
