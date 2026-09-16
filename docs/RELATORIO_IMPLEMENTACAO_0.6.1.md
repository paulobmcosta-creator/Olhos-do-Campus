# Relatório de Implementação — 0.6.1

**Sistema:** Olhos do Campus — Sistema Institucional de Manutenção da Infraestrutura Física  
**Versão:** 0.6.1  
**Data:** 2026-08-17  
**Base:** ZIP `olhos-do-campus (11)(1).zip`, internamente identificado como 0.6.0.

## Objetivo do hotfix

Corrigir exclusivamente o empacotamento de produção utilizado pelo fluxo Publish do Google AI Studio/Cloud Run, preservando integralmente as funcionalidades da 0.6.0.

## Diagnóstico confirmado

A tentativa de publicação produziu um objeto `build_artifacts.tar.gz` de 249.560.700 bytes. A inspeção do objeto retornou:

- `gzip: unexpected end of file`;
- `tar: Unexpected EOF in archive`;
- 39.388 entradas em `node_modules` antes do ponto de truncamento;
- presença relevante de dependências exclusivamente de desenvolvimento, entre elas `firebase-tools`, ESLint, Vitest, jsdom e Testing Library;
- erro final do Cloud Run: `The provided source archive is corrupted.`

O defeito estava, portanto, na preparação do artefato de produção e não em regras de negócio, Firestore, Storage, App Check ou ciclo de SLA.

## Implementação

Foi criado `scripts/prepareProductionPackage.mjs`. Como etapa final de `npm run build`, o script:

1. executa `npm prune --omit=dev --no-audit --no-fund` no diretório raiz;
2. mantém somente dependências necessárias ao runtime;
3. remove `bun.lock` e `bun.lockb` caso o ambiente os gere;
4. preserva npm e `package-lock.json` como mecanismo oficial do projeto;
5. encerra com código diferente de zero se `npm prune` falhar.

O build continua compilando primeiro:

- frontend com Vite;
- backend com esbuild;

somente depois executando o prune. As ferramentas de desenvolvimento continuam disponíveis durante compilação e testes.

## Não alterado

Não houve mudança em:

- controllers;
- services;
- repositories;
- models de domínio;
- DTOs de ocorrência;
- páginas ou componentes funcionais;
- Firebase Authentication;
- App Check;
- Firestore/Storage Rules;
- SLA e calendário;
- permissões Administrador/Gestor;
- categorias, locais e equipes;
- exportações;
- auditoria;
- migração 0.6.0;
- seed institucional dos 60 ambientes.

## Versionamento

Foram atualizados para 0.6.1:

- `package.json`;
- raiz e pacote principal de `package-lock.json`;
- `metadata.json`;
- `firebase-blueprint.json`;
- `src/config/version.ts`;
- README e CHANGELOG.

O endpoint `/api/health` e RuntimeInfo utilizam `APP_VERSION` e, portanto, passam a informar 0.6.1 sem duplicação de constante.

## Dependências

Nenhuma dependência foi adicionada, removida ou teve versão alterada.

## Risco residual

O ambiente desta execução não conseguiu completar `npm ci` porque o cache offline não possui `zod-validation-error@4.0.2` e a tentativa online permaneceu sem resposta. Assim, a suíte integral deve ser repetida no AI Studio/Cloud Shell/CI com acesso ao npm registry antes de considerar a versão homologada para produção.

## Homologação esperada

Após importar a 0.6.1 no AI Studio:

1. executar Preview e verificar inicialização;
2. executar Publish uma única vez;
3. confirmar que o novo `build_artifacts.tar.gz` deixa de ficar próximo do limite anterior e é um gzip/tar íntegro;
4. confirmar criação de nova revisão Cloud Run automática;
5. executar smoke test público e administrativo.
