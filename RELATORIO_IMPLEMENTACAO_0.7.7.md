# Relatório de Implementação — Versão 0.7.7

**Sistema:** Sistema Institucional de Manutenção da Infraestrutura Física  
**Data:** 25–26/08/2026  
**Classificação:** correção de transporte EWS/NTLM pós-gate operacional bloqueado

## 1. Origem da correção

A candidata 0.7.6 passou pelos gates de artefato, baseline produtiva, pré-check Resend e resolução de secrets EWS, porém o teste real `tests/ewsIntegration.optIn.test.ts` falhou com `EWS_MALFORMED_RESPONSE_UNCERTAIN: EWS_EMPTY_RESPONSE`. O destinatário do teste confirmou que a mensagem não foi recebida. Nenhum build ou deploy 0.7.6 foi promovido.

O diagnóstico controlado demonstrou:

1. NTLM Type 1: HTTP 401 com challenge NTLM válido;
2. Type 3 usando a implementação 0.7.6 + `GetFolder` read-only: HTTP 400 com corpo vazio;
3. mesmo Type 1, mesmo challenge, mesmo Type 3, mesmas credenciais e mesmo SOAP `GetFolder`, porém com `Content-Length` explícito: HTTP 200, `ResponseClass=Success`, `ResponseCode=NoError`.

A variável experimental foi exclusivamente o framing HTTP da segunda requisição NTLM.

## 2. Correção implementada

Em `server/providers/ews/ntlmClient.ts` foi introduzida a construção canônica dos headers da requisição autenticada:

- remoção case-insensitive de `Transfer-Encoding` recebido do chamador;
- remoção de `Content-Length` externo potencialmente incorreto;
- cálculo do comprimento real do corpo com `Buffer.byteLength`;
- inclusão de `Content-Length` apenas quando existe corpo;
- preservação de `Authorization: NTLM <Type3>` e `Connection: close`;
- nenhuma alteração em `createType1Message`, `parseType2Message`, `createType3Message` ou nas rotinas criptográficas NTLMv2.

## 3. Escopo preservado

Não foram alterados:

- modelos Firestore;
- regras Firestore/Storage;
- Firebase Authentication;
- Firebase App Check;
- Cloudflare R2;
- Cloudflare Worker, exceto marcador de versão;
- semântica de outbox, retries, idempotência ou estados de entrega;
- provider Resend;
- SOAP `CreateItem` e parser de resposta EWS;
- IAM ou configuração de produção.

## 4. Teste regressivo criado

`tests/ntlmHttpFraming077.test.ts` verifica:

- comprimento em bytes para string UTF-8;
- comprimento correto para `Buffer`;
- substituição de `Content-Length` incorreto;
- remoção case-insensitive de `Transfer-Encoding`;
- preservação dos demais headers;
- ausência de `Content-Length` quando não há corpo.

## 5. Versionamento

A correção recebeu versão **0.7.7**. Não foi reutilizado o identificador 0.7.6 porque o ZIP 0.7.6 já possuía hash autoritativo e evidência operacional própria. A nova versão exige novo ZIP e novo SHA-256.

## 6. Implantação

A implantação deve seguir `docs/IMPLANTACAO_0.7.7.md`, com build imutável, digest conferido e criação inicial de revisão com `--no-traffic` e tag `ews077`. Nenhuma promoção automática de tráfego é autorizada por este relatório.

## 7. Validação concluída da correção

A candidata 0.7.7 foi validada no Google Cloud Shell com Node `v22.22.2` e npm `10.9.7`. Foram observados:

- `npm ci`: PASS, 1204 pacotes instalados e 0 vulnerabilidades;
- TypeScript: PASS;
- lint: PASS;
- teste regressivo `ntlmHttpFraming077.test.ts`: 4/4 PASS;
- suíte principal: 390 testes PASS e 3 opt-in skipped;
- Maintenance Worker: typecheck PASS e 4/4 testes PASS;
- build local de produção: PASS;
- `GetFolder` EWS read-only usando diretamente o `executeNtlmRequest()` corrigido: HTTP 200, `ResponseClass=Success`, `ResponseCode=NoError`;
- teste EWS real opt-in: 2/2 PASS;
- confirmação humana: mensagem `[TESTE EWS] Verificação de integração 0.7.7 - 2026-08-26T01:45:08.774Z` recebida em `pauloborges@id.uff.br`, remetida por `cgao.bsf@ifes.edu.br`.

A evidência demonstra que a correção incorporada à 0.7.7 elimina o comportamento `HTTP 400 / corpo vazio` reproduzido na 0.7.6 e permite o fluxo `CreateItem` com `SendAndSaveCopy`.

## 8. Pendências de release

Antes de qualquer promoção produtiva, ainda devem ser concluídos sobre o artefato final:

1. Cloud Build da imagem 0.7.7;
2. conferência independente do digest pelo Cloud Build e Artifact Registry;
3. criação de revisão Cloud Run com `--no-traffic` e tag `ews077`;
4. health check da revisão 0.7.7;
5. confirmação read-only da configuração da revisão;
6. prova de que a produção 0.6.2 permanece inalterada e com 100% do tráfego ordinário.

Nenhuma promoção automática de tráfego é autorizada por este relatório.
