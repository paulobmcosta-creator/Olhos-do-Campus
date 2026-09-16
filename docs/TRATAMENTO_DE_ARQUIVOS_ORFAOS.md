# Tratamento de arquivos órfãos — versão 0.5.0

## Problema

Cloud Storage e Firestore não oferecem transação atômica comum. Uma falha Firestore após upload pode deixar objeto órfão; uma falha Storage após exclusão lógica pode deixar bytes sem acesso lógico.

## Compensação

`PhotoService.compensate()` tenta apagar todos os paths envolvidos, eliminando duplicidades. O repository trata objeto inexistente como sucesso. Se alguma exclusão falhar, é criada tarefa persistente em `storageCleanupTasks`.

## Tarefa

Campos: `storagePaths`, `reason`, `status`, `attempts`, `createdAt`, `updatedAt`, `lastError`. Não contém dados pessoais.

## Execução

```bash
npm run storage:cleanup
```

O script:
- processa apenas tarefas `PENDING` válidas;
- tenta exclusão idempotente;
- considera objeto ausente como concluído;
- marca `COMPLETED` ao finalizar;
- em erro incrementa `attempts` e registra erro operacional sanitizado;
- não lista o bucket para decidir o que excluir;
- não apaga objetos sem tarefa persistente.

Não há Cloud Function agendada na 0.5.0.
