# Guia de Implantação — Versão 0.7.6

Este documento orienta os procedimentos futuros de build, homologação e implantação da versão **0.7.6** do **Sistema Institucional de Manutenção da Infraestrutura Física**.

> **Proteção e Integridade de Produção:**
> - As etapas abaixo constituem um roteiro operacional de implantação futura. **Nenhum comando de deploy ou build remoto foi executado nesta tarefa.**
> - A produção ativa `olhos-do-campus` permanece na versão `0.6.2` e não foi alterada.

---

## 1. Dados Reais de Infraestrutura Institucional

- **Projeto GCP:** `gen-lang-client-0120954905`
- **Região GCP:** `us-west1`
- **Repositório Artifact Registry:** `cloud-run-source-deploy`
- **Imagem Artifact Registry:** `olhos-do-campus-api`
- **Tag Determinística de Release:** `v0.7.6`
- **Serviço Cloud Run:** `olhos-do-campus` (versão `0.6.2` ativa em produção)
- **Banco Firestore:** `ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf`
- **Segredos no Secret Manager:** `odc-ews-username`, `odc-ews-password`, `odc-r2-access-key-id`, `odc-r2-secret-access-key`, `odc-maintenance-hmac-secret`

---

## 2. Variáveis de Ambiente no Cloud Run

Para ativar o envio institucional via **Exchange Web Services (EWS)**, configure as seguintes variáveis no serviço do Cloud Run:

```env
EMAIL_PROVIDER=ews
EWS_ENABLED=true
EWS_URL=https://webmail.ifes.edu.br/EWS/Exchange.asmx
EWS_DOMAIN=UPD1
EWS_FROM=<ENDERECO_REMETENTE_EWS>
```

> **Nota de Segurança:** As credenciais `EWS_USERNAME` e `EWS_PASSWORD` devem ser injetadas exclusivamente via **Google Cloud Secret Manager** (`odc-ews-username:latest` e `odc-ews-password:latest`), nunca em texto claro nas variáveis de ambiente.

---

## 3. Passo a Passo de Build e Deploy do Backend (Cloud Run)

### Etapa A — Build futuro da imagem

1. Preparar o pacote de produção do backend:
   ```bash
   npm run build:cloud-run
   ```

2. Disparar a compilação e envio da imagem Docker via Cloud Build:
   ```bash
   gcloud builds submit \
     --config=cloudbuild.yaml \
     --substitutions=_IMAGE_TAG=v0.7.6 \
     --project=gen-lang-client-0120954905 \
     .
   ```
   *(Nota: O arquivo `cloudbuild.yaml` define `_IMAGE_TAG: v0.7.6` por padrão, tornando o comando reproduzível e determinístico).*

### Etapa B — URI resultante da imagem

A execução da Etapa A produzirá e publicará exatamente a seguinte imagem no Artifact Registry:

```text
us-west1-docker.pkg.dev/gen-lang-client-0120954905/cloud-run-source-deploy/olhos-do-campus-api:v0.7.6
```

### Etapa C — Deploy futuro no Cloud Run (0% de tráfego + tag ews076)

Comando para implantação da nova revisão no Cloud Run apontando estritamente para a imagem gerada na Etapa A/B, isolada com **0% de tráfego produtivo** e vinculada à traffic tag **`ews076`** (a ser executado apenas em janela de implantação autorizada):

```bash
gcloud run deploy olhos-do-campus \
  --image=us-west1-docker.pkg.dev/gen-lang-client-0120954905/cloud-run-source-deploy/olhos-do-campus-api:v0.7.6 \
  --region=us-west1 \
  --project=gen-lang-client-0120954905 \
  --no-traffic \
  --tag=ews076 \
  --update-env-vars EMAIL_PROVIDER=ews,EWS_ENABLED=true,EWS_URL=https://webmail.ifes.edu.br/EWS/Exchange.asmx,EWS_DOMAIN=UPD1,EWS_FROM=<ENDERECO_REMETENTE_EWS> \
  --update-secrets EWS_USERNAME=odc-ews-username:latest,EWS_PASSWORD=odc-ews-password:latest
```

> **Salvaguarda Absoluta de Produção:** A combinação de `--no-traffic` e `--tag=ews076` garante que a nova revisão 0.7.6 seja provisionada sem receber qualquer tráfego público ordinário, ficando acessível exclusivamente por uma URL dedicada com prefixo de tag para testes de homologação.

### Etapa D — Validação Estruturada em Dois Gates e Promoção Explícita

O procedimento de validação operacional da candidata 0.7.6 é estruturado em dois gates técnicos independentes:

#### Gate A — Verificação da Revisão Cloud Run 0.7.6 (Saúde e Infraestrutura)
*Objetivo: Comprovar que a imagem 0.7.6 sobe com sucesso no Cloud Run com 0% de tráfego produtivo e responde ao contrato de saúde.*

1. **Recuperação e Validação da URL da Tag `ews076`:**
   Recuperar a URL dedicada da tag gerada pelo Cloud Run por meio de consulta estruturada e validação fail-closed:
   ```bash
   TAG_URL="$(
     gcloud run services describe olhos-do-campus \
       --region=us-west1 \
       --project=gen-lang-client-0120954905 \
       --flatten='status.traffic[]' \
       --filter='status.traffic.tag=ews076' \
       --format='value(status.traffic.url)'
   )"

   echo "$TAG_URL"

   if [ -z "$TAG_URL" ] || [ "$(echo "$TAG_URL" | wc -l)" -ne 1 ]; then
     echo "ERRO: Esperava-se exatamente uma URL para a traffic tag ews076."
     exit 1
   fi
   ```

2. **Health Check e Verificação de Versão:**
   Acessar o endpoint `/api/health` utilizando diretamente a `$TAG_URL` retornada para a tag `ews076` (o processo Cloud Run é estritamente a API de backend; o frontend produtivo é hospedado separadamente no Cloudflare Pages):
   ```bash
   curl -i "$TAG_URL/api/health"
   ```
   *Evidência esperada:* HTTP 200 com JSON contendo `status: "ok"` e `version: "0.7.6"`.

3. **Confirmação de Tráfego Produtivo Intocado:**
   Confirmar que a produção continua com 100% do tráfego direcionado à revisão anterior (0.6.2).

#### Gate B — Teste de Integração EWS Real da Implementação 0.7.6
*Objetivo: Comprovar que o cliente NTLMv2 e o provedor EWS implementados na 0.7.6 realizam com sucesso a autenticação e o despacho SOAP CreateItem contra o servidor Exchange real.*

1. **Execução do Teste de Integração EWS Opt-In:**
   Executar o teste opt-in específico da versão 0.7.6 em ambiente com credenciais injetadas de forma segura (via Google Cloud Secret Manager / ambiente controlado):
   ```bash
   RUN_EWS_INTEGRATION=true npm run test:ews
   ```
   > **Salvaguardas de Segurança:**
   > - O teste exige obrigatoriamente `EWS_USERNAME`, `EWS_PASSWORD`, `EWS_FROM` e `EWS_TEST_RECIPIENT` (sem fallback silencioso para `EWS_FROM`).
   > - `EWS_TEST_RECIPIENT` deve ser definido para um endereço de e-mail institucional controlado escolhido para o teste operacional.
   > - Nunca versione credenciais nem solicite que o usuário exponha senhas no terminal.
   > - O teste não imprime credenciais, tokens ou payloads SOAP sensíveis no log de saída.
   > - Evidência de conectividade de versões anteriores (ex: 0.6.x) não substitui a comprovação da implementação 0.7.6.

2. **Verificação do Pré-Check de Desativação do Resend:**
   Executar o script pré-check fail-closed antes de qualquer alteração definitiva nos registros do provedor anterior:
   ```bash
   npx tsx scripts/preMigrationResendCheck.ts
   ```

#### Promoção de Tráfego e Salvaguarda de Rollback

1. **Identificação da Revisão Atual para Salvaguarda de Rollback:**
   Antes de qualquer modificação de tráfego, identificar e validar a revisão que atende 100% do tráfego produtivo (versão 0.6.2):
   ```bash
   REVISAO_PRODUCAO="$(
     gcloud run services describe olhos-do-campus \
       --region=us-west1 \
       --project=gen-lang-client-0120954905 \
       --flatten='status.traffic[]' \
       --filter='status.traffic.percent=100' \
       --format='value(status.traffic.revisionName)'
   )"

   echo "$REVISAO_PRODUCAO"

   if [ -z "$REVISAO_PRODUCAO" ] || [ "$(echo "$REVISAO_PRODUCAO" | wc -l)" -ne 1 ]; then
     echo "ERRO: Não foi possível determinar de forma unívoca a revisão que atende 100% do tráfego produtivo."
     exit 1
   fi
   ```

2. **Promoção Explícita de Tráfego (Proibido o uso de `--to-latest`):**
   Somente após a aprovação formal do **Gate A** (Health Check), do **Gate B** (Integração EWS Real) e da homologação funcional, promover o tráfego direcionando explicitamente para a tag homologada `ews076`:
   ```bash
   gcloud run services update-traffic olhos-do-campus \
     --to-tags=ews076=100 \
     --region=us-west1 \
     --project=gen-lang-client-0120954905
   ```
   *(Nota: O uso de `--to-tags=ews076=100` garante determinismo absoluto, impedindo a promoção acidental de revisões intermediárias que poderiam ocorrer com `--to-latest`).*

3. **Procedimento de Rollback Imediato:**
   Caso seja detectada qualquer anomalia após a promoção, reverter o tráfego instantaneamente para a revisão anterior anotada:
   ```bash
   gcloud run services update-traffic olhos-do-campus \
     --to-revisions="${REVISAO_PRODUCAO}=100" \
     --region=us-west1 \
     --project=gen-lang-client-0120954905
   ```

---

## 4. Frontend (Cloudflare Pages)

1. Executar o build do cliente:
   ```bash
   npm run build:client
   ```
2. Publicar a pasta `dist/client` no Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist/client --project-name=olhos-do-campus
   ```

