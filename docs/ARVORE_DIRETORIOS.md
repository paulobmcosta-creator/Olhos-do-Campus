# Árvore de diretórios — versão 0.7.0

```text
.
├── src/                         frontend React/Vite
│   ├── pages/admin/             inclui Infraestrutura e capacidade
│   ├── services/                cliente HTTP
│   └── models/                  contratos de transporte
├── server/                      API Express/Cloud Run
│   ├── config/                  Firebase e ambiente
│   ├── controllers/             HTTP
│   ├── domain/                  regras de negócio
│   ├── middleware/              Auth, App Check, HMAC, erros
│   ├── models/                  domínio persistido
│   ├── providers/               Resend
│   ├── repositories/            Firestore, R2 e fallback Storage
│   ├── routes/                  API pública/admin/interna
│   └── services/                casos de uso
├── infra/
│   ├── cloudflare/maintenance-worker/
│   │   ├── src/index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── wrangler.jsonc
│   └── artifact-registry-cleanup-policy.json
├── scripts/
│   ├── migrateStorageToR2.ts
│   ├── reconcilePhotoStorage.ts
│   ├── storageCleanup.ts
│   ├── artifactRegistryCleanup.ts
│   ├── artifactRegistrySnapshot.ts
│   └── scripts preservados de bootstrap/seed/migração
├── public/
│   ├── _redirects             fallback SPA do Pages
│   └── _headers               headers de segurança do Pages
├── tests/                      unitários, contratos, emuladores e opt-in externo
├── docs/                       documentação ativa e histórico versionado
├── Dockerfile                  imagem da API
├── cloudbuild.yaml             build/push da API
├── firebase*.json              integração Firebase preservada
├── firestore.rules             deny-all para clientes
├── storage.rules               deny-all para clientes
├── package.json
└── package-lock.json
```

`dist/`, `node_modules/`, `.env` reais, `work/` e `outputs/` não fazem parte do ZIP-fonte. `dist/client` é o artefato do Pages e `dist/server` é o artefato de Cloud Run. O diretório `work/` existe apenas durante a preparação local e não pertence ao projeto entregue.
