# Migração 0.5.1 → 0.6.0

## 1. Origem efetivamente utilizada

A especificação inicial da 0.6.0 previa base 0.5.2. O primeiro pacote recebido não passou pela trava de versão. Posteriormente, o usuário autorizou expressamente o uso do ZIP identificado internamente como **0.5.1**. A implementação desta entrega deriva somente dessa base autorizada; nenhuma 0.5.2 foi reconstruída ou presumida.

## 2. Princípios

A migração:

- não roda na inicialização do servidor;
- é `--dry-run` por padrão;
- exige `--apply` para escrita;
- fora dos emuladores exige `ALLOW_060_MIGRATION=CONFIRM_MIGRATION_0_6`;
- recomenda backup/export recuperável antes de aplicação;
- não promove `Atendente` automaticamente;
- não apaga `department` legado;
- não apaga eventos nem fotografias;
- não reutiliza protocolo;
- não inventa timestamps quando não há evidência histórica segura.

## 3. Comandos

Dry-run:

```bash
npm run firebase:migrate-0.6 -- --dry-run
```

Aplicação em ambiente autorizado:

```bash
npm run firebase:migrate-0.6 -- --apply
```

Em ambiente não-emulador, além de `--apply`, configure temporariamente a variável de confirmação indicada acima e confira rigorosamente projeto, databaseId e backup.

## 4. Campos tratados

Para cada ocorrência legada, conforme necessidade:

- `reportedCategoryId` / `reportedCategoryNameSnapshot` recebem a categoria atual existente como melhor evidência do valor originalmente conhecido;
- `reportedLocation` recebe o local atual existente como melhor evidência disponível;
- `priorityRank`;
- `dataClassification` — padrão conservador `REAL`, salvo evidência explícita de `TEST`;
- `hasTeam`, `hasResponsible`, `hasPhoto`, `isClosed`, `reopened`;
- `searchTokens`;
- `reopenedCount` / `lastReopenedAt` quando reconstruíveis;
- snapshot de SLA.

## 5. Atendente

Documentos `adminUsers` com `role = Atendente` são apenas identificados no relatório da migração. Eles **não são convertidos**. A sessão permanece bloqueada até um Administrador escolher explicitamente:

1. converter para Gestor; ou
2. inativar.

O procedimento administrativo está disponível no backend/UI de usuários da 0.6.0.

## 6. department

`department` não é removido nem usado como autorização. O novo vínculo estrutural é `teamIds` + `operationalTeams`. A migração não adivinha equivalências entre texto livre de departamento e equipes institucionais.

## 7. SLA legado

A reconstrução usa:

- `createdAt` original;
- categoria/prioridade existentes;
- eventos históricos realmente usados pela 0.5.1 (`STATUS_CHANGED`, `OCCURRENCE_RESOLVED`, `OCCURRENCE_CLOSED`, `OCCURRENCE_REOPENED`);
- mudanças públicas de situação para primeira resposta;
- estados de espera quando há evidência suficiente para pausas/retomadas.

Quando a reconstrução é segura, `legacyAssessment = CALCULATED`. Quando há inferência parcial controlada, `ESTIMATED`. Quando faltam evidências para um timestamp essencial, `UNAVAILABLE`. A migração não fabrica datas para obter métricas completas.

## 8. Rollback

Não há rollback automático destrutivo. O rollback recomendado é:

1. interromper escrita administrativa;
2. restaurar o backup/export realizado imediatamente antes da migração;
3. republicar a aplicação anterior, se necessário;
4. validar Storage e subcoleções de eventos/fotos após restauração.

Como a 0.6.0 acrescenta campos e não depende de remoção automática de `department`/`Atendente`, o dry-run deve ser arquivado e conferido antes do `--apply`.
