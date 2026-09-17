# Checklist de homologação manual — versão 0.7.5

## Gate A — artefato

- [x] SHA-256 do ZIP final será registrado externamente no sidecar e na devolutiva.
- [x] ZIP reaberto sem erro.
- [x] raiz única `olhos-do-campus-0.7.5/`.
- [x] sem `node_modules`, `dist`, `.env` real, logs ou backups.

## Gate B — regressão automatizada

Na próxima sessão Cloud Shell/CI com Node 22.22.2:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run worker:typecheck
npm run worker:test
npm run build
npm audit
npm audit --omit=dev
npm run test:rules
npm run test:firebase
npm run test:storage
```

O novo arquivo `tests/firestoreEnterprise075.test.ts` deve passar dentro de `npm run test`.

## Gate C — Firestore Enterprise real

Confirmar os seis índices `attempts` como `READY`:

```bash
DB="ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf"
PROJECT="gen-lang-client-0120954905"

gcloud firestore indexes composite list \
  --project="$PROJECT" \
  --database="$DB" \
  --filter="COLLECTION_GROUP:attempts"
```

Esperado: seis entradas, todas `STATE: READY`.

Não refazer deploy baseado em `fieldOverrides`.

## Gate D — infraestrutura externa

Depois do Gate C:

1. configurar bucket R2 privado e credenciais server-only;
2. executar verificação opt-in R2;
3. configurar domínio/remetente e secrets Resend;
4. validar webhook Resend;
5. cadastrar secrets/variáveis no Google Cloud;
6. build/push da imagem no Artifact Registry;
7. deploy da API no Cloud Run em `us-west1`;
8. publicar frontend no Cloudflare Pages;
9. ajustar Auth, App Check e CORS ao domínio final;
10. publicar Maintenance Worker;
11. homologar fluxo público e administrativo ponta a ponta.

## Gate E — funcionalidades críticas

Na homologação ponta a ponta validar, no mínimo:

- registro sem identificação pessoal obrigatória;
- protocolo + chave obrigatórios para consulta pública;
- upload de 0 a 3 fotos e remoção de EXIF;
- ausência de acesso público direto ao Storage/R2;
- login Google administrativo e autorização Firestore;
- histórico para mudanças de situação;
- separação de mensagem pública e nota interna;
- retry técnico Resend sem inflar DeliveryAttempt;
- webhook Resend correlacionado por notification/attempt;
- ausência de envio duplicado em replay/idempotência.
