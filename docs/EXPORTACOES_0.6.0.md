# Exportações — 0.6.0

Formatos: CSV UTF-8 com BOM, XLSX e PDF institucional. Administrador e Gestor podem exportar a consulta filtrada.

## Limite

Máximo de **2.000 registros por exportação**. Se o conjunto exceder o limite, a API rejeita e orienta restringir filtros/período. Não há carregamento ilimitado em memória.

## Conteúdo

Inclui protocolo, abertura/encerramento, categoria atual, local atual, situação, prioridade, equipe, responsável, risco, metas/resultados de SLA, tempos total/efetivo, pausa e classificação de dados.

Não inclui tracking key/hash/salt, paths de Storage, checksum, tokens, e-mail público, observações internas por padrão ou dados de segurança.

CSV aplica proteção contra início de célula interpretável como fórmula (`=`, `+`, `-`, `@`).

## Auditoria

Toda exportação registra `REPORT_EXPORTED` com ator, formato, quantidade e resumo dos filtros, sem duplicar conteúdo sensível.
