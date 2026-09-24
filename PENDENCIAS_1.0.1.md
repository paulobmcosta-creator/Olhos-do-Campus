# Pendências e Decisões — Versão 1.0.1

## Pendências técnicas não bloqueantes

1. **Métrica de demandas físicas distintas:** a 1.0.1 preserva cada protocolo como registro recebido. Não foi criada métrica adicional que desconte ocorrências apensadas para representar “problemas físicos únicos”.
2. **Propagação de notificações externas:** alterações compartilhadas atualizam os documentos e históricos do grupo, mas não multiplicam notificações de roteamento por cada ocorrência, evitando duplicação de e-mails. A política pode ser revista caso haja necessidade institucional.
3. **Limite transacional do agrupamento:** a implementação aplica limite defensivo de até 100 documentos na operação de propagação (ocorrência iniciadora + até 99 demais membros). Agrupamentos maiores exigiriam estratégia de processamento em lotes.
4. **Testes com Firebase Emulator e integrações reais:** não integram o workflow de PR criado nesta versão e devem ser executados quando houver ambiente/credenciais apropriados.

## Decisões adotadas

- `Apensada` não é uma situação operacional.
- O mecanismo legado de situação `Duplicada` permanece para compatibilidade.
- Apensamento e duplicidade legada são mutuamente exclusivos no mesmo registro.
- TEST e REAL não podem coexistir no mesmo agrupamento.
- Mensagens públicas somente são replicadas ao grupo por opção explícita.
- Dados originais e de acompanhamento não são fundidos.
