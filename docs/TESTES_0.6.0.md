# Relatório de testes — versão 0.6.0

**Sistema:** Olhos do Campus  
**Nome oficial:** Sistema Institucional de Manutenção da Infraestrutura Física  
**Instituição:** Instituto Federal do Espírito Santo — Campus Barra de São Francisco  
**Versão:** 0.6.0  
**Data da execução:** 16/08/2026  
**Ambiente utilizado:** Node.js 22.16.0 / npm 10.9.2

## 1. Regra de interpretação

Este relatório distingue rigorosamente três situações:

1. **aprovado** — comando executado e concluído com código 0;
2. **não executável integralmente neste ambiente** — comando foi efetivamente iniciado, mas dependências/ferramentas não puderam ser instaladas ou acessadas;
3. **verificação suplementar** — teste estático ou determinístico executado fora da suíte oficial, útil para reduzir risco, mas que **não substitui** `npm run typecheck`, Vitest, build ou Firebase Emulator Suite.

Nenhum comando abaixo é declarado aprovado quando não terminou com sucesso.

## 2. Validação da base 0.5.1 antes da implementação

A especificação original previa base 0.5.2, porém o usuário autorizou expressamente o uso do ZIP 0.5.1. Antes das modificações, a identificação interna foi conferida em `package.json`, `package-lock.json`, `metadata.json`, `src/config/version.ts`, RuntimeInfo, `/api/health`, README e CHANGELOG.

A validação completa da 0.5.1 **não pôde ser concluída** neste ambiente porque a instalação íntegra das dependências não ficou disponível. As tentativas de `typecheck`, lint, testes, build, auditoria e emuladores da base apresentaram o mesmo tipo de limitação observado ao final: tipos/pacotes locais ausentes e indisponibilidade do registro npm/Firebase CLI. Portanto, a 0.5.1 não é declarada “validada integralmente”; essa limitação foi separada da implementação 0.6.0.

## 3. Comandos obrigatórios da 0.6.0

| # | Comando | Código de saída | Duração | Resultado efetivo |
|---|---|---:|---:|---|
| 1 | `npm ci` | 137 | 17,002 s | **Não concluído.** A instalação ficou aguardando acesso ao registry; foi encerrada para evitar espera indefinida. Foram emitidos avisos `EBADENGINE` para `jsdom@30.0.1` e `undici@8.10.0`. |
| 2 | `npm run typecheck` | 2 | 0,723 s | **Não executável integralmente.** `tsc` informou ausência das definições `@testing-library/jest-dom`, `node` e `vite/client`, consequência da instalação incompleta. |
| 3 | `npm run lint` | 127 | 0,083 s | **Não executável.** `eslint: not found`. |
| 4 | `npm run test` | 127 | 0,081 s | **Não executável.** `vitest: not found`. |
| 5 | `npm run build` | 127 | 0,081 s | **Não executável.** `vite: not found`. |
| 6 | `npm run validate` | 2 | 0,874 s | **Não concluído.** Interrompido no `typecheck` pelos três tipos ausentes. |
| 7 | `npm audit --omit=dev` | 1 | 10,651 s | **Não executável online.** Falha DNS `EAI_AGAIN registry.npmjs.org` no endpoint de auditoria. |
| 8 | `npm run test:rules` | 127 | 0,084 s | **Não executável.** `firebase: not found`. |
| 9 | `npm run test:firebase` | 127 | 0,082 s | **Não executável.** `firebase: not found`. |
| 10 | `npm run test:storage` | 127 | 0,091 s | **Não executável.** `firebase: not found`. |

### 3.1 Diagnóstico da instalação

Foi executada uma validação adicional do lockfile:

| Comando | Código | Duração | Resultado |
|---|---:|---:|---|
| `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund` | 0 | 0,655 s | **Aprovado.** `package-lock.json` está coerente e não exigiu alteração estrutural. |
| `npm ci --ignore-scripts --offline --no-audit --no-fund` | 1 | 1,163 s | Falha `ENOTCACHED`: o pacote `zod-validation-error@4.0.2` não estava disponível no cache local. |

Isso confirma que o bloqueio principal é a indisponibilidade das dependências no ambiente de execução, e não uma inconsistência detectada entre `package.json` e `package-lock.json`.

### 3.2 Avisos de engine

O Node disponível foi **22.16.0**. Durante as tentativas de instalação, npm informou:

- `jsdom@30.0.1`: requer `^22.22.2 || ^24.15.0 || >=26.0.0`;
- `undici@8.10.0`: requer `>=22.19.0`.

Para homologação, recomenda-se Node **22.22.2 ou superior dentro de uma faixa suportada pelas dependências travadas**, evitando esses avisos.

## 4. Testes específicos exigidos

Os seguintes comandos foram efetivamente chamados, mas todos dependeram de `vitest` ou `tsx`, que não ficaram instalados por causa do bloqueio descrito acima:

| Finalidade | Comando | Código | Duração | Resultado |
|---|---|---:|---:|---|
| SLA | `npm run test -- tests/sla060.test.ts` | 127 | 0,083 s | `vitest: not found` |
| Seed/60 espaços | `npm run test -- tests/referenceData.test.ts` | 127 | 0,078 s | `vitest: not found` |
| Migração dry-run | `npm run firebase:migrate-0.6 -- --dry-run` | 127 | 0,080 s | `tsx: not found` |
| Seed de espaços dry-run | `npm run firebase:seed-campus-spaces -- --dry-run` | 127 | 0,077 s | `tsx: not found` |
| Exportações | `npm run test -- tests/reportExport060.test.ts` | 127 | 0,078 s | `vitest: not found` |
| Paginação | `npm run test -- tests/pagination060.test.ts` | 127 | 0,080 s | `vitest: not found` |
| Permissões | `npm run test -- tests/adminRoles060.test.ts tests/occurrencePermissions.test.ts tests/operationalAdministration060.test.ts tests/internalNoteAudience060.test.ts` | 127 | 0,078 s | `vitest: not found` |
| Indicadores | `npm run test -- tests/analytics060.test.ts` | 127 | 0,084 s | `vitest: not found` |
| Polling | `npm run test -- tests/polling060.test.ts` | 127 | 0,079 s | `vitest: not found` |

Os arquivos de teste foram incluídos no projeto e devem ser executados novamente após `npm ci` bem-sucedido.

## 5. Verificações suplementares executadas com sucesso

Como a suíte oficial ficou indisponível, foram executadas verificações independentes que não dependem da instalação local completa.

### 5.1 Sintaxe TypeScript/TSX

- mecanismo: `TypeScript transpileModule` usando TypeScript global 5.8.3;
- arquivos TS/TSX inspecionados: **168**;
- erros sintáticos: **0**;
- código de saída: **0**;
- duração: **1,061 s**.

Essa verificação detecta erros de parsing/transpilação, mas não substitui checagem semântica completa do `tsc` com todos os tipos instalados.

### 5.2 Imports relativos

- imports relativos analisados: **654**;
- destinos inexistentes: **0**;
- código de saída: **0**;
- duração: **0,568 s**.

### 5.3 JSON

- arquivos JSON analisados: **9**;
- erros de parse: **0**;
- código de saída: **0**;
- duração: **0,554 s**.

Inclui `package.json`, `package-lock.json`, configurações Firebase, Blueprint e índices.

### 5.4 Uso explícito de `any`

Busca estática em `src/`, `server/`, `scripts/` e `tests/`:

- ocorrências explícitas encontradas: **0**;
- código de saída: **0**;
- duração: **0,005 s**.

### 5.5 Exercícios determinísticos do domínio de SLA

Os módulos finais `businessTime.ts`, `sla.ts` e `referenceSeedData.ts` foram transpilados isoladamente com o TypeScript global e executados no Node. Foram confirmados por `assert`:

- total de ambientes: **60**;
- distribuição: **28 / 26 / 2 / 4**;
- jornada padrão 09:00–19:00: **600 minutos úteis**;
- sexta-feira 18:00 + 120 minutos úteis → segunda-feira 10:00;
- primeira resposta Normal: 1.200 minutos úteis;
- categoria Iluminação Normal: 3.600 minutos úteis;
- pausa de 12:00 a 18:00: 360 minutos úteis acumulados;
- reabertura: intervalo terminal de 600 minutos úteis excluído do SLA efetivo;
- tempo efetivo do cenário de reabertura: 420 minutos úteis.

Todas as asserções desse exercício suplementar foram satisfeitas.

### 5.6 Exportações

O módulo final de exportação foi executado isoladamente com uma ocorrência sintética contendo deliberadamente `trackingKeyHash` e `trackingKeySalt` de teste.

Resultados:

- limite institucional: **2.000 registros**;
- CSV: gerado com BOM UTF-8;
- XLSX: gerado e aberto com sucesso pelo `openpyxl`; célula `A2 = INF-2026-000001`;
- PDF: gerado com assinatura `%PDF-1.4`;
- `trackingKeyHash` e `trackingKeySalt`: **não presentes nos três arquivos**.

Esses testes validam a serialização básica dos três formatos, mas não substituem o teste Vitest completo de filtros, permissões e auditoria.

## 6. Cobertura prevista na suíte incluída

A suíte adicionada/ajustada contém casos para:

- remoção do papel ativo `Atendente` e bloqueio do legado;
- Administrador × Gestor;
- equipes, membro ativo e responsável opcional;
- categoria/local reportados versus atuais;
- justificativa e optimistic locking;
- primeira resposta por mudança pública de situação;
- calendário útil, fim de semana, feriados, recessos e horário especial;
- metas e multiplicadores de SLA;
- pausas, múltiplas pausas, encerramento e reabertura;
- recalculação sem reinício do relógio;
- 60 ambientes institucionais;
- audiência de notas internas;
- paginação 25/50/100 e cursores;
- analytics com contagens, médias e medianas determinísticas;
- CSV/XLSX/PDF e campos proibidos;
- polling de 60 segundos, erro de rede e limpeza do timer;
- exclusão de `TEST` e bloqueio de `REAL`;
- Firestore/Storage server-only por Rules.

A existência desses testes não é apresentada como aprovação enquanto o Vitest/Emulator não for realmente executado.

## 7. Homologação funcional manual

A homologação em Preview com credenciais reais **não foi executada neste ambiente**. Portanto permanecem pendentes, antes de produção, os 33 cenários funcionais definidos na especificação: login Administrador/Gestor, usuários/equipes/categorias/locais, registro público, risco imediato, reclassificações, SLA, pausa/retomada, dashboard, filtros, paginação, analytics, três audiências de nota, auditoria, polling e exclusão TEST/bloqueio REAL.

## 8. Sequência obrigatória antes de implantação

Em Cloud Shell, CI ou estação com acesso ao registry, Node compatível e Java/JRE para os emuladores:

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
npm run test:storage
npm run test -- tests/sla060.test.ts
npm run test -- tests/referenceData.test.ts
npm run test -- tests/reportExport060.test.ts
npm run test -- tests/pagination060.test.ts
npm run test -- tests/adminRoles060.test.ts tests/occurrencePermissions.test.ts tests/operationalAdministration060.test.ts tests/internalNoteAudience060.test.ts
npm run test -- tests/analytics060.test.ts
npm run test -- tests/polling060.test.ts
npm run firebase:migrate-0.6 -- --dry-run
npm run firebase:seed-campus-spaces -- --dry-run
```

Somente após essa bateria terminar satisfatoriamente devem ser realizados backup, migração em homologação, seed e testes manuais. **Nenhum deploy de produção foi realizado nesta entrega.**

## 9. Conclusão técnica dos testes

A implementação passou nas verificações suplementares de sintaxe, imports, JSON, ausência de `any`, exercícios determinísticos de SLA e geração/leitura de exportações. Entretanto, **a suíte oficial não pode ser declarada aprovada**, porque `npm ci` não conseguiu obter todas as dependências neste ambiente e, consequentemente, lint, Vitest, build e Firebase Emulator Suite não ficaram disponíveis.

A versão deve ser tratada como **artefato implementado para homologação**, condicionado à execução bem-sucedida da bateria oficial em ambiente com conectividade e toolchain compatível.
