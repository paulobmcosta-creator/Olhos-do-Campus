# Tratamento de arquivos órfãos — versão 0.7.0

R2 e Firestore não compartilham transação atômica. Uma falha Firestore após upload pode deixar bytes órfãos; uma falha do provider após tombstone pode deixar objeto pendente.

## Compensação e tarefas

`PhotoService` tenta excluir, de forma idempotente, todos os paths de uma operação parcial. Se alguma exclusão falhar, grava `storageCleanupTasks` com provider, paths, motivo, estado, tentativas, timestamps e erro sanitizado; a tarefa não contém PII.

```bash
npm run storage:cleanup
```

O processador atua somente em tarefas `PENDING`, limita o lote, considera objeto ausente como sucesso, marca conclusão ou incrementa tentativa. Administrador e Maintenance Worker também podem processar a fila.

## Reconciliação independente

```bash
npm run storage:reconcile -- --dry-run
```

Ela pagina metadados Firestore e objetos R2, encontra metadados sem objeto, objetos sem metadata e divergências de tamanho. O limite evita scan/memória sem controle. Inventário truncado é marcado incompleto e nunca autoriza exclusão.

```bash
npm run storage:reconcile -- --apply
```

Apply só remove órfãos se o inventário for completo e o objeto for anterior à janela configurada. Não apaga ocorrência, metadata válida, foto referenciada ou histórico. O resultado agregado é registrado para o painel. Esta rotina não substitui backup nem cria política de retenção.

