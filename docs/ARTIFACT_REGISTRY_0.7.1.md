# Artifact Registry — controle operacional 0.7.1

## Objetivo da correção

A política 0.7.0 excluía somente versões `untagged`, enquanto `cloudbuild.yaml` publica cada imagem com `${SHORT_SHA}`. Isso permitiria que imagens antigas, embora automáticas e não destinadas a preservação, permanecessem fora do cleanup indefinidamente.

A 0.7.1 mantém o mesmo Artifact Registry e o mesmo fluxo `gcloud`; muda apenas a política de retenção.

## Política ativa

`infra/artifact-registry-cleanup-policy.json` contém três regras complementares:

1. `delete-old-versions`: candidatas a exclusão com mais de 30 dias, usando `tagState: any`, portanto alcançando versões tagueadas e não tagueadas;
2. `keep-protected-tags`: preserva versões com tags deliberadas iniciadas por `release-`, `keep-` ou `rollback-`;
3. `keep-recent-for-rollback`: preserva as 10 versões mais recentes.

Regras de **Keep** protegem versões que também coincidam com uma regra de **Delete**. Assim, `tagState: any` não significa exclusão indiscriminada das versões protegidas.

### Convenção de tags

- `${SHORT_SHA}`: tag automática de build; **não é proteção permanente**;
- `release-*`: release explicitamente preservada;
- `rollback-*`: imagem selecionada para rollback operacional;
- `keep-*`: preservação administrativa excepcional.

Não use prefixos protegidos como tag automática de todo build.

## Cenário de controle — 100 builds antigos

Considere 100 imagens com mais de 30 dias, todas com tags automáticas de commit, mais 10 imagens recentes e 2 imagens antigas protegidas (`release-0.7.1` e `rollback-pre-migration`).

Resultado esperado no dry-run:

- as 100 versões antigas automáticas entram no universo elegível da regra de exclusão;
- as 10 versões mais recentes permanecem protegidas pela regra `mostRecentVersions`;
- as versões antigas com tags protegidas permanecem protegidas;
- nenhuma versão é apagada durante o dry-run.

O teste `tests/preDeployment071.test.ts` valida estruturalmente que a regra de exclusão usa `tagState: any`, que os três prefixos protegidos existem e que 10 versões recentes são preservadas.

## Dry-run obrigatório

Configure:

```text
ARTIFACT_REGISTRY_PROJECT_ID=<projeto>
ARTIFACT_REGISTRY_LOCATION=us-west1
ARTIFACT_REGISTRY_REPOSITORY=<repositório>
ARTIFACT_REGISTRY_IMAGE=<imagem-opcional>
```

Execute:

```bash
npm run infra:artifact-cleanup:dry-run
```

Antes do apply, confirme no resultado real:

- imagens automáticas antigas esperadas aparecem como candidatas;
- imagens recentes continuam preservadas;
- tags `release-`, `keep-` e `rollback-` necessárias continuam preservadas;
- o repositório e a região são os pretendidos.

## Apply destrutivo

Somente depois da revisão do dry-run:

```bash
CONFIRM_ARTIFACT_REGISTRY_CLEANUP=APPLY_REVIEWED_ARTIFACT_REGISTRY_POLICY \
npm run infra:artifact-cleanup:apply
```

O script recusa `--apply` sem a confirmação literal. A política não é aplicada automaticamente por build ou deploy.

## Snapshot e rollback

```bash
npm run infra:artifact-snapshot
```

O snapshot registra somente agregados. Remover/substituir a política impede exclusões futuras, mas não recupera versões já apagadas. Por isso, tags de preservação e dry-run devem ser definidos antes do apply.
