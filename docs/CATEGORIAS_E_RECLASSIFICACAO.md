# Categorias e reclassificação

## Catálogo

Somente Administrador gerencia nome, descrição, ordem, SLA-base e estado ativo. O identificador documental é estável; categoria utilizada historicamente não é excluída fisicamente.

## Preservação do reportado

Novas ocorrências armazenam simultaneamente:

- `reportedCategoryId` e `reportedCategoryNameSnapshot` — imutáveis;
- `categoryId` e `categoryNameSnapshot` — classificação atual.

Na criação ambos são iguais. Na triagem, Administrador ou Gestor pode corrigir a categoria atual, exigindo justificativa validada.

## Efeitos da correção

- preserva valor original;
- atualiza snapshot atual;
- incrementa `version` via optimistic locking;
- gera `CATEGORY_CHANGED` no histórico;
- gera `OCCURRENCE_CATEGORY_CHANGED` na auditoria;
- recalcula SLA de conclusão sem reiniciar o relógio;
- acompanhamento público mostra a categoria atual e aviso genérico de ajuste, sem expor o autor.
