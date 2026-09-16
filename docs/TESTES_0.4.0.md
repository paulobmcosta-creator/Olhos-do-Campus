# Relatório de testes — versão 0.4.0

## 1. Ambiente

- Data: 10/08/2026 (fuso do projeto: America/Sao_Paulo).
- Node disponível: `v22.16.0`.
- npm disponível: `10.9.2`.
- TypeScript global disponível: `5.8.3`.
- Restrição crítica: o ambiente não conseguiu completar downloads no registro npm.

O `package-lock.json` não apresentou divergência entre as dependências declaradas na raiz e `package.json`. A tentativa offline falhou por artefato ausente do cache (`ENOTCACHED` para `zod-validation-error-4.0.2.tgz`), portanto não houve base técnica para regenerar ou substituir arbitrariamente o lockfile.

## 2. Validação prévia da base 0.3.0

Antes das alterações, foram tentados `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run validate`, `npm run test:rules` e `npm run test:firebase`.

`npm ci` não concluiu por bloqueio de acesso ao registro. Uma tentativa offline retornou `ENOTCACHED`. Sem `node_modules` completo, `typecheck` reportou ausência de `@testing-library/jest-dom`, `node` e `vite/client`; os demais comandos reportaram executáveis ausentes (`eslint`, `vitest`, `vite`, `firebase`). Portanto a limitação informada na documentação da 0.3.0 foi reproduzida neste ambiente.

Também foram observados avisos `EBADENGINE`: `jsdom@30.0.1` solicita Node `^22.22.2 || ^24.15.0 || >=26.0.0` e `undici@8.10.0` solicita Node `>=22.19.0`, enquanto o ambiente possui Node 22.16.0.

## 3. Comandos finais obrigatórios

| Comando | Saída | Duração observada | Resultado |
|---|---:|---:|---|
| `npm ci` | 124 | 26,019 s | **Não concluído**. Interrompido após 25 s por bloqueio de instalação/acesso ao registro; houve apenas avisos `EBADENGINE` antes da interrupção. |
| `npm run typecheck` | 2 | <1 s | **Não executou validação semântica completa**: faltam tipos de `@testing-library/jest-dom`, `node` e `vite/client` porque a instalação não concluiu. |
| `npm run lint` | 127 | <1 s | **Não executado**: `eslint: not found`. |
| `npm run test` | 127 | <1 s | **Não executado**: `vitest: not found`. |
| `npm run build` | 127 | <1 s | **Não executado**: `vite: not found`. |
| `npm run validate` | 2 | 1 s | **Não concluído**: interrompido no `typecheck` pela ausência dos tipos instalados. |
| `npm audit --omit=dev` | 1 | 6 s | **Não concluído**: `getaddrinfo EAI_AGAIN registry.npmjs.org`; endpoint de auditoria indisponível. |
| `npm run test:rules` | 127 | <1 s | **Não executado**: `firebase: not found`. |
| `npm run test:firebase` | 127 | <1 s | **Não executado**: `firebase: not found`. |

Os códigos e mensagens acima são os resultados efetivos da árvore final; nenhum deles é tratado como aprovação.

## 4. Concorrência de protocolo

O teste real contra Firestore Emulator foi implementado em `tests/firebaseIntegration.test.ts` com 20 criações simultâneas e verificação de unicidade, sequência 1–20 e contador anual. Ele integra `npm run test:firebase`, mas **não pôde ser executado** porque o Firebase CLI/Vitest não estavam instalados após a falha do `npm ci`.

Consequência: a lógica transacional foi inspecionada e o teste está preparado, mas a ausência de duplicidades sob concorrência ainda precisa ser comprovada em execução de Emulator Suite antes de produção.

## 5. Seeds

| Comando | Saída | Resultado |
|---|---:|---|
| `npm run firebase:seed-reference-data` | 127 | Não executado: `tsx: not found`. |
| `npm run firebase:seed-demo-data` | 127 | Não executado: `tsx: not found`. |

Os scripts possuem verificações estáticas de ambiente e não são acionados automaticamente pelo servidor. Sua execução real contra Emulator Suite permanece obrigatória em ambiente com dependências instaladas.

## 6. Verificações auxiliares efetivamente executadas

Estas verificações não substituem a suíte obrigatória, mas foram úteis para reduzir risco estático:

- transpilação sintática com TypeScript global 5.8.3: **128 arquivos TS/TSX, 0 erros sintáticos**;
- coerência da raiz `package.json`/`package-lock.json`: versão 0.4.0 em ambos, lockfile v3, dependências e devDependencies correspondentes;
- busca por `any` em `src`, `server`, `scripts` e `tests`: nenhum uso encontrado;
- busca por importação de `firebase/firestore` ou Firebase Admin no frontend: nenhum acesso de negócio encontrado;
- busca no runtime por `InMemoryDatabase`, `INITIAL_OCCURRENCES`, `INITIAL_CATEGORIES`, `INITIAL_LOCATIONS`, `INITIAL_CONFIG` e `ENABLE_DEMO_MODE`: nenhum resultado;
- inspeção estática da proteção da chave confirma `scrypt`, salt aleatório e `timingSafeEqual`;
- regras Firestore/Storage permanecem deny-by-default.

## 7. Cobertura preparada

Foram preparados testes para:

- geração, formato, derivação e verificação da chave;
- comparação segura e salts distintos;
- protocolo e normalização de prefixo;
- matriz completa de transições;
- resolução/reabertura;
- DTO público e remoção de campos internos/atribuição/prioridade;
- filtragem de eventos internos;
- atribuição existente, ativa e por identificador estável;
- optimistic locking;
- duplicidade A→A, A→inexistente, A→B, A→B→C e ciclo;
- categorias ativas e snapshots de localização/categoria;
- serialização de Timestamp;
- `PORT`;
- API pública/administrativa e papéis;
- bloqueio direto do Firestore e Storage para não autenticado, anônimo e Google;
- persistência após nova instância de serviço;
- contador anual e concorrência;
- configurações operacionais e referências no Firestore.

## 8. Conclusão

A implementação contém a suíte prevista, porém os testes críticos não puderam ser efetivamente executados por falha de instalação das dependências e indisponibilidade do registro npm. **A versão 0.4.0 não deve ser considerada validada para produção neste ambiente.**

Para concluir a validação em ambiente adequado:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate
npm audit --omit=dev
npm run test:rules
npm run test:firebase
npm run firebase:seed-reference-data
npm run firebase:seed-demo-data
```

Utilizar Node 22.22.2 ou versão compatível mais recente recomendada pelo grafo atual evitará os avisos de engine observados.
