# Pendências e Decisões — Versão 1.0.2

## Pendências técnicas não bloqueantes

1. **Métrica de demandas físicas distintas:** continua pendente uma métrica que represente problemas físicos únicos descontando ocorrências apensadas.
2. **Propagação de notificações externas em grupos:** alterações compartilhadas sincronizam documentos e histórico, mas não multiplicam e-mails por cada membro do grupo.
3. **Limite transacional do agrupamento:** permanece o limite defensivo de até 100 documentos por propagação.
4. **Suítes externas:** testes com Firebase Emulator e integrações reais EWS/R2/Resend permanecem fora do workflow padrão de PR.
5. **Registros históricos em Duplicada:** não há migração automática. Esses registros permanecem legíveis e serão normalizados quando houver alteração explícita para uma situação ativa.

## Decisões adotadas

- a situação operacional não possui sequência obrigatória;
- a matriz de transição é livre para qualquer situação ativa;
- o papel do usuário controla o escopo da ocorrência e outras operações, não a sequência de situação;
- `Duplicada` deixa de ser situação ativa;
- duplicidade e similaridade passam a ser representadas por apensamento;
- campos `duplicateOf*` permanecem apenas para compatibilidade histórica;
- toda alteração de situação continua gerando histórico e auditoria;
- saída de situação final para situação não final é sempre tratada como reabertura;
- não há migração obrigatória do Firestore.
