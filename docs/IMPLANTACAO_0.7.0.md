# Instalação, migração e implantação — versão 0.7.0

## Instalação

```bash
npm ci
npm run typecheck
npm run lint
npm run test
```

Use Node.js `>=20.19.0`, npm `>=10` e Java/JRE para os emuladores. Configure secrets fora do repositório.

## Ordem recomendada

1. Faça backup e registre o estado atual do Firebase Storage e do Artifact Registry.
2. Crie e configure o R2 privado; execute migração em dry-run, apply sem exclusão e verificação.
3. Mantenha fallback legado de leitura somente durante a janela de homologação.
4. Crie/configure Resend, mas mantenha `emailNotificationsEnabled=false`; valide teste e webhook.
5. Publique a API Cloud Run a partir de `Dockerfile`/`cloudbuild.yaml`, com R2, Resend, Firebase, App Check, CORS e HMAC em secrets. Esta entrega não executou esse passo.
6. Obtenha a URL final da API e gere `npm run build:pages` com `VITE_API_BASE_URL` e configurações Firebase/App Check públicas.
7. Publique `dist/client` no Pages, configure domínios autorizados e homologue CORS/login/registro/consulta/fotos.
8. Publique o Worker somente depois de validar manualmente os endpoints assinados.
9. Habilite notificações reais pelo Administrador.
10. Após observação, desabilite fallback Storage; remova a origem apenas por procedimento separado e aprovado.
11. Revise e aplique a policy do Artifact Registry somente depois do dry-run.

## Cloud Run API only

`npm run build:server` produz `dist/server/index.js`. `Dockerfile` executa o build de servidor e instala dependências de produção. `cloudbuild.yaml` constrói e envia a imagem da API; não publica Pages, Worker nem executa migrações. Em produção, são obrigatórios R2, App Check, origem CORS HTTPS e configuração Firebase válida. O servidor não contém fallback para `index.html`.

## Rollback

- **Pages:** republique o build frontend anterior e mantenha a API acessível para essa versão.
- **API:** reverta a revisão Cloud Run; confirme compatibilidade do schema antes. A outbox e novos documentos são aditivos.
- **R2:** durante a transição, reative o fallback de leitura; não grave novas fotos no Storage produtivo.
- **Resend:** desabilite `emailNotificationsEnabled` ou `RESEND_ENABLED`; os itens persistem para análise/reprocessamento.
- **Worker:** pause Cron Triggers; a manutenção manual continua disponível.
- **Artifact policy:** remova/substitua a policy para impedir futuras exclusões; objetos já apagados precisam ser reconstruídos.

Não há rollback automático de ações destrutivas. Preserve origens e artefatos até concluir a homologação.

