# Configuração Técnica do Provedor EWS (Exchange Web Services) — Versão 0.7.7

Este documento detalha o funcionamento, arquitetura de autenticação NTLM e parâmetros de configuração do provedor **EwsEmailProvider** do **Sistema Institucional de Manutenção da Infraestrutura Física**.

---

> **Correção de transporte 0.7.7:** a requisição NTLM Type 3 que transporta o SOAP define `Content-Length` pelo tamanho real em bytes e remove `Transfer-Encoding` concorrente. Esta correção decorre de evidência operacional read-only: `GetFolder` retornou HTTP 400/corpo vazio sem framing explícito e HTTP 200 + `Success/NoError` com `Content-Length` correto.

## 1. Visão Geral da Integração

O **EwsEmailProvider** permite que o sistema envie notificações transacionais através do servidor Microsoft Exchange institucional do IFES, utilizando o endpoint SOAP padrão:

- **URL:** `https://webmail.ifes.edu.br/EWS/Exchange.asmx`
- **Domínio padrão:** `UPD1`
- **Método SOAP:** `CreateItem` com `MessageDisposition="SendAndSaveCopy"`
- **Pasta de cópia:** `DistinguishedFolderId Id="sentitems"`
- **Autenticação:** NTLM / NTLMv2 nativa com handshake HTTP 401 via conexão persistente (keep-alive).

---

## 2. Parâmetros de Configuração

| Variável de Ambiente | Descrição | Exemplo |
| :--- | :--- | :--- |
| `EMAIL_PROVIDER` | Define o provedor ativo (`ews` ou `resend`). Padrão: `ews`. | `ews` |
| `EWS_ENABLED` | Habilita ou desabilita o envio via EWS. | `true` |
| `EWS_URL` | URL completa do endpoint EWS. | `https://webmail.ifes.edu.br/EWS/Exchange.asmx` |
| `EWS_DOMAIN` | Domínio Windows/Active Directory para autenticação NTLM. | `UPD1` |
| `EWS_USERNAME` | Nome de usuário da conta de serviço no Exchange. | `<USUARIO_CONTA_SERVICO_EWS>` |
| `EWS_PASSWORD` | Senha da conta de serviço (injetada via Secret Manager). | `••••••••` |
| `EWS_FROM` | Endereço de e-mail institucional do remetente homologado. | `<ENDERECO_REMETENTE_EWS>` |

---

## 3. Funcionamento da Autenticação NTLM

1. **Mensagem Type 1 (Negotiate):** O cliente envia uma requisição inicial com o header `Authorization: NTLM <Type1-Base64>`.
2. **Mensagem Type 2 (Challenge):** O servidor responde `401 Unauthorized` com o header `WWW-Authenticate: NTLM <Type2-Base64>`, contendo o challenge criptográfico.
3. **Mensagem Type 3 (Authenticate):** O cliente gera as respostas NTLMv2 (utilizando HMAC-MD5, timestamp e client nonce aleatório) e reenvia a requisição SOAP completa na **mesma conexão HTTPS aberta (keep-alive)** com `Authorization: NTLM <Type3-Base64>`.
4. **Resposta SOAP:** O servidor valida as credenciais e processa a requisição `CreateItem`.

---

## 4. Matriz de Tratamento de Erros

| Resposta do Exchange / Transporte | Classificação Interna | Comportamento da Outbox |
| :--- | :--- | :--- |
| HTTP 200 + `ResponseCode === 'NoError'` | `ACCEPTED` / `SENT` | Notificação concluída com sucesso. `providerMessageId` mantido opcional. |
| HTTP 401 / HTTP 403 definitivo | `CONFIGURATION` | Notificação marcada como `FAILED_CONFIGURATION`. Sem retry automático. |
| DNS / Conexão recusada prévia | `TRANSIENT` | Agendamento de retry da mesma tentativa (`SAME_ATTEMPT` / `PROVIDER_REJECTED`). |
| Falha de certificado TLS | `CONFIGURATION` | Notificação marcada como `FAILED_CONFIGURATION`. |
| Timeout de socket / Conexão resetada | `UNCERTAIN` | Tentativa marcada como `UNCERTAIN` e outbox como `DELIVERY_UNCERTAIN` (evita duplicidade). |
| HTTP 500 sem prova de rejeição | `UNCERTAIN` | Classificada como `DELIVERY_UNCERTAIN` aguardando intervenção. |
| `ErrorInvalidRecipients` | `INVALID_RECIPIENT` | Notificação marcada como `FAILED` definitiva. |
| `ErrorServerBusy` | `TRANSIENT` | Backoff exponencial com `SAME_ATTEMPT`. |
| `ErrorQuotaExceeded` | `QUOTA` | Notificação diferida para o dia seguinte (`DEFERRED`). |

---

## 5. Política e Procedimento de Transição Resend → EWS (Fail-Closed)

Para garantir que notificações vinculadas ao Resend não sejam rejeitadas com `FAILED_CONFIGURATION` nem sofram interrupção indevida durante a virada para o EWS:

1. **Configuração Inicial da Virada:**
   - Definir `EMAIL_PROVIDER=ews` para que novos registros utilizem o provedor institucional.
   - Manter `RESEND_ENABLED=true` e `RESEND_API_KEY` configurados temporariamente enquanto houver itens do Resend na fila ou aguardando confirmação.
   - Manter `RESEND_WEBHOOK_SECRET` ativo para reconciliação contínua de entregas assíncronas do Resend.

2. **Diagnóstico e Pré-Check Fail-Closed:**
   - Executar o script somente leitura de pré-check:
     ```bash
     npx tsx scripts/preMigrationResendCheck.ts
     ```
   - O diagnóstico avalia todas as notificações do Resend (`PENDING`, `PROCESSING`, `DEFERRED`, `RETRY_PENDING`, `SENT`, `DELIVERY_UNCERTAIN`, `FAILED_CONFIGURATION`, status desconhecidos `OTHER`), tentativas aceitas aguardando confirmação, tentativas órfãs e webhooks pendentes (`UNMATCHED_PENDING`).

3. **Drenagem e Reconciliação:**
   - Permitir que o ciclo de processamento do Worker/Outbox consuma as notificações pendentes do Resend.
   - Reexecutar periodicamente `npx tsx scripts/preMigrationResendCheck.ts`.

4. **Desativação Segura do Envio Resend:**
   - **Regra de Ouro:** Somente desligar o Resend (`RESEND_ENABLED=false`) quando o pré-check retornar explicitamente `READY_TO_DISABLE_RESEND: YES` e tiver concluído sem nenhum erro de leitura/consulta (`Read/query errors: 0`).
   - **Se o script falhar por erro técnico ou registrar erros de consulta: NÃO desligar o Resend.**
   - Manter `RESEND_WEBHOOK_SECRET` ativo para preservar a capacidade de reconciliação passiva caso cheguem eventos residuais.


