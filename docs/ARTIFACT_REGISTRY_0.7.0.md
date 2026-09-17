# Artifact Registry — controle operacional 0.7.0

## Escopo

O Artifact Registry permanece como repositório das imagens do Cloud Run. A versão 0.7.0 adiciona levantamento agregado e uma política de cleanup revisável. O Cloud Run não recebe permissão para listar o Registry; a coleta é feita por operador/CI autorizado e grava apenas bytes, quantidade de versões, repositório e data no Firestore.

## Levantamento inicial e snapshot

Configure apenas no ambiente operacional:

```text
ARTIFACT_REGISTRY_PROJECT_ID=<projeto>
ARTIFACT_REGISTRY_LOCATION=<região>
ARTIFACT_REGISTRY_REPOSITORY=<repositório>
ARTIFACT_REGISTRY_IMAGE=<imagem-opcional>
```

Autentique `gcloud` com uma identidade de leitura e execute:

```bash
gcloud artifacts docker images list <região>-docker.pkg.dev/<projeto>/<repositório> --include-tags
npm run infra:artifact-snapshot
```

O script lista artefatos via `gcloud` e grava um snapshot agregado em `artifactRegistrySnapshots`; não grava nomes de usuário, tokens ou manifestos.

## Cleanup: dry-run obrigatório

A política em `infra/artifact-registry-cleanup-policy.json`:

- remove versões sem tag com mais de 30 dias;
- preserva as 10 versões mais recentes;
- não remove versões tagueadas pela regra de exclusão entregue.

Primeiro execute:

```bash
npm run infra:artifact-cleanup:dry-run
```

Analise no console/gcloud todos os artefatos que seriam atingidos e confirme que as revisões necessárias para rollback continuam preservadas. Não aplique em repositório diferente do revisado.

Depois de aprovação explícita:

```bash
CONFIRM_ARTIFACT_REGISTRY_CLEANUP=APPLY_REVIEWED_ARTIFACT_REGISTRY_POLICY \
npm run infra:artifact-cleanup:apply
```

O script recusa apply sem a confirmação literal.

## Conferência e rollback

Após aplicar, consulte as versões/tag e gere novo snapshot. Cleanup de bytes já executado não restaura manifests apagados. O rollback operacional consiste em remover/substituir a política no repositório usando uma política previamente versionada; ele impede novas exclusões, mas não recupera versões. Se uma versão removida for necessária, reconstrua-a a partir do commit e dependências imutáveis ou recupere de outro registro autorizado.

Quando nenhum snapshot estiver disponível, o painel mostra “não coletado”; não estima nem inventa uso.

