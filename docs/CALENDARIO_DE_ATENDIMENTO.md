# Calendário institucional de atendimento

## Configuração inicial

Timezone: `America/Sao_Paulo`.

| Dia | Situação | Expediente |
|---|---|---|
| Segunda-feira | aberto | 09:00–19:00 |
| Terça-feira | aberto | 09:00–19:00 |
| Quarta-feira | aberto | 09:00–19:00 |
| Quinta-feira | aberto | 09:00–19:00 |
| Sexta-feira | aberto | 09:00–19:00 |
| Sábado | fechado | — |
| Domingo | fechado | — |

Um dia útil padrão corresponde a 10 horas úteis. A configuração inicial não desconta almoço.

## Persistência

- calendário semanal: `serviceCalendars/default`;
- exceções: `serviceCalendarExceptions/{id}`.

Exceções aceitas: `FERIADO`, `RECESSO`, `SUSPENSAO` e `HORARIO_ESPECIAL`. Uma exceção pode fechar completamente a data ou definir janela reduzida/ampliada.

## Administração

Somente Administrador pode alterar calendário e exceções. O backend valida horários e registra auditoria. Gestor recebe HTTP 403 nas rotas estruturais.

## Snapshot histórico

Cada SLA de ocorrência mantém snapshot do calendário e das exceções aplicáveis. Assim, editar o expediente institucional depois não altera retroativamente prazos históricos.
