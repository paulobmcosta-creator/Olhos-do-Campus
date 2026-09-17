# Roteiro de Homologação Manual — Versão 0.7.7

Este documento estabelece o roteiro de testes e verificações manuais para homologação da versão **0.7.7** do **Sistema Institucional de Manutenção da Infraestrutura Física**.

---

## 1. Objetivos da Homologação 0.7.7

1. Validar o envio transacional de e-mails via Exchange Web Services (EWS) do IFES com autenticação NTLM e `SendAndSaveCopy`.
2. Verificar a ausência de fallback automático silencioso entre provedores de e-mail.
3. Confirmar a preservação da semântica de notificações (`PENDING` → `PROCESSING` → `SENT`, sem ID externo fabricado no EWS).
4. Validar o script de snapshot do Artifact Registry sem necessidade de credenciais do Cloudflare R2.
5. Verificar a exibição do provedor ativo nos painéis administrativos do frontend.

---

## 2. Casos de Teste Operacionais

### Cenário 1: Envio de E-mail de Teste via Painel Administrativo (EWS)

1. **Pré-requisitos:**
   - Backend configurado com `EMAIL_PROVIDER=ews`, `EWS_ENABLED=true`, `EWS_URL=https://webmail.ifes.edu.br/EWS/Exchange.asmx`, `EWS_DOMAIN=UPD1`, `EWS_USERNAME`, `EWS_PASSWORD` e `EWS_FROM`.
   - Acesso ao painel administrativo autenticado como Administrador.
2. **Passos:**
   - Acessar a aba **Configurações** → **Notificações institucionais por e-mail**.
   - Verificar se o campo **Provedor** exibe `EWS`.
   - No bloco **Enviar e-mail de teste**, preencher um e-mail institucional válido (ex: `seu.email@ifes.edu.br`) e clicar em **Registrar teste**.
   - Observar o processamento da fila de notificações.
3. **Critérios de Aceitação:**
   - Mensagem de sucesso confirmando o registro na outbox.
   - Mensagem de e-mail recebida na caixa postal com o assunto `[TESTE] Teste de notificação institucional`.
   - No Firestore, documento em `notificationOutbox` atinge status `SENT` e subcoleção `attempts` registra status `ACCEPTED` com `providerMessageId` ausente (não fabricado).

---

### Cenário 2: Criação de Ocorrência Real e Disparo de Notificações

1. **Pré-requisitos:**
   - Lista de destinatários institucionais cadastrada nas configurações operacionais.
   - Flag "Habilitar notificações para novas ocorrências reais" ativada.
2. **Passos:**
   - Acessar a página pública de abertura de ocorrência.
   - Preencher uma nova ocorrência (categoria, local, descrição) e submeter.
   - Acompanhar o log do backend durante o processamento em background da outbox.
3. **Critérios de Aceitação:**
   - A ocorrência é persistida e o protocolo gerado normalmente.
   - Cada destinatário configurado recebe uma mensagem individual com os dados da ocorrência e o link para triagem administrativa.
   - Cada entrega na outbox é vinculada com `provider: 'ews'` e processada com sucesso.

---

### Cenário 3: Comportamento Sem Provedor Configurado (Ausência de Fallback Silencioso)

1. **Pré-requisitos:**
   - Iniciar o servidor com `EMAIL_PROVIDER=ews` mas com credenciais inválidas ou incompletas (`EWS_ENABLED=false` ou senha incorreta).
2. **Passos:**
   - Registrar um teste de notificação.
   - Aguardar a execução do ciclo de processamento da outbox.
3. **Critérios de Aceitação:**
   - O item de notificação transiciona para `FAILED_CONFIGURATION`.
   - O sistema **NÃO** tenta despachar a notificação para o Resend de forma silenciosa.
   - O painel administrativo exibe a pendência na lista de "Verificações de configuração".

---

### Cenário 4: Execução do Script de Snapshot do Artifact Registry

1. **Pré-requisitos:**
   - Terminal autenticado com `gcloud auth login` ou service account com permissão de leitura no Artifact Registry.
   - Ambiente sem variáveis do Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY`, etc.).
2. **Passos:**
   - Executar: `npx tsx scripts/artifactRegistrySnapshot.ts`.
3. **Critérios de Aceitação:**
   - O script conecta ao Artifact Registry, coleta as imagens e calcula o tamanho em bytes.
   - O snapshot é gravado na coleção `artifactRegistrySnapshots` do Firestore sem erros de validação de ambiente R2.
   - Se as imagens possuírem tamanho numérico, os bytes são somados; se não houver campo de tamanho, o script falha rápido impedindo a gravação de `bytes: 0`.
