# Relatório de implementação — versão 0.6.0

**Sistema:** Olhos do Campus  
**Nome oficial:** Sistema Institucional de Manutenção da Infraestrutura Física  
**Instituição:** Instituto Federal do Espírito Santo — Campus Barra de São Francisco  
**Versão:** 0.6.0

## 1. Fonte de verdade e exceção autorizada

A especificação inicial exigia partir da 0.5.2. A primeira base recebida era 0.5.0 e foi corretamente rejeitada. Em seguida, o usuário enviou `olhos-do-campus-0.5.1 (1).zip` e determinou “utilize essa versão”. Essa instrução foi tratada como autorização expressa para substituir a trava original e usar a 0.5.1 como única fonte de verdade.

Não foram reutilizados arquivos de versões anteriores nem de outros projetos.

## 2. Diagnóstico da base

A base 0.5.1 mantinha a arquitetura server-only de Firestore/Storage e fotografias persistentes, mas ainda possuía:

- `Atendente` como papel ativo;
- atribuição individual sem entidade institucional de equipe;
- categoria/local sem separação entre valor originalmente reportado e valor atual corrigido;
- primeira resposta associada a mensagem pública, e não à primeira mudança pública de situação;
- listagem limitada sem paginação real por cursor e com parte do tratamento em memória;
- ausência de SLA em horas úteis, calendário institucional, analytics completo, exportações e auditoria operacional global.

## 3. Papéis e autorização

Papéis ativos: `Administrador` e `Gestor`. `Atendente` foi removido de contratos de criação/edição e mantido somente como valor legado detectável e bloqueado. Não existe promoção automática.

Gestor administra ocorrências. Administrador possui as mesmas capacidades operacionais e administra também usuários, equipes, categorias, locais, SLA/calendário, auditoria e expurgo de TEST.

A autorização crítica está no backend e é duplicada na UI apenas para experiência de uso.

## 4. Equipes/setores

Criada `operationalTeams` com membros, ordem, ativo/inativo e metadados. Usuários podem integrar múltiplas equipes. Uma ocorrência pode ter somente equipe, equipe + responsável ou permanecer sem encaminhamento. Responsável individual deve ser usuário ativo Administrador/Gestor e, quando há equipe, integrante dela.

## 5. Categoria e local reportados × atuais

Novas ocorrências persistem `reportedCategory*` e `reportedLocation` imutáveis, além da categoria/local atuais. Correções por Gestor/Administrador exigem justificativa, optimistic locking, histórico e auditoria. A visão pública mostra o valor atual e aviso genérico de ajuste, sem identificar o autor.

## 6. SLA

Criados `businessTime.ts` e `sla.ts`. O calendário padrão é segunda–sexta 09:00–19:00 em `America/Sao_Paulo`, sem almoço descontado. Há exceções para feriado, recesso, suspensão e horário especial.

A primeira resposta é fixada exatamente uma vez na primeira mudança de situação publicamente visível. Metas: 30/20/10/4/2 horas úteis por prioridade.

A conclusão usa SLA-base por categoria e multiplicadores 1,50/1,00/0,80/0,60/0,40. Categoria/prioridade podem recalcular o alvo sem reiniciar o relógio. Pausas operacionais deslocam prazos. Estados terminais param o SLA; eventual reabertura exclui do SLA efetivo o intervalo em que o registro permaneceu encerrado.

Cada ocorrência recebe snapshot do calendário/política para preservar historicidade.

## 7. Locais do campus

A carga institucional contém 60 ambientes: 28/26/2/4. Nenhum pavimento foi inventado. O seed é aditivo e idempotente e preserva alterações administrativas existentes.

## 8. Paginação, filtros e consultas

A listagem usa cursor Firestore, tamanhos 25/50/100 e preserva filtros/ordenação. Foram materializados somente campos de consulta necessários. A busca por palavra-chave é tokenizada e limitada; não é apresentada como full-text search escalável.

Consultas com desigualdade ordenam primeiro pelos campos de intervalo e usam a ordem escolhida como desempate, compatibilizando cursor com Firestore. Índices compostos foram limitados aos caminhos operacionais efetivamente implementados.

## 9. Dashboard e indicadores

Dashboard inicial: urgentes/emergenciais, SLA vencido, sem encaminhamento, em atendimento, aguardando providência, resolvidas recentemente e novas hoje. Cards são acionáveis.

`/administracao/indicadores` usa período padrão de 30 dias e distingue coorte de aberturas da coorte de encerramentos. Contagens usam agregação; médias/medianas exigem leitura limitada a 5.000 itens. Acima do limite, a métrica é declarada indisponível, não extrapolada.

## 10. Notas internas

Audiências:

- `ADMIN_ONLY`;
- `ADMINS_AND_MANAGERS`;
- `RESPONSIBLE_TEAM`.

A audiência da equipe persiste snapshot de `teamId`, impedindo que uma troca posterior de equipe altere retroativamente a visibilidade histórica. O backend aplica a regra e a consulta pública jamais recebe notas internas.

## 11. Exportações

CSV, XLSX e PDF, limite 2.000 registros, filtros ativos e auditoria `REPORT_EXPORTED`. Campos de segurança, tracking material, Storage paths, checksum e notas internas são excluídos.

## 12. Dados TEST

Novos registros públicos normais são `REAL`; seeds demonstrativos são `TEST`. Não existe operação para converter `REAL → TEST`. Somente Administrador pode expurgar TEST, incluindo metadados/subcoleções e tentativa idempotente de remoção de objetos do Storage. O auditLog da exclusão permanece e o contador de protocolo não é reduzido.

## 13. Polling e concorrência

Dashboard/lista/detalhe verificam mudanças a cada 60 s sem sobrescrever edição local. Optimistic locking por `expectedVersion`/HTTP 409 permanece em toda alteração relevante.

## 14. Segurança preservada

Auth anônimo público, Google Sign-In administrativo, App Check, Firebase Admin server-only, Firestore/Storage deny-all ao cliente, tracking key fora da URL, remoção de EXIF, ausência de IP na ocorrência e streaming protegido de fotografias foram preservados.

## 15. Fora do escopo

Nenhum envio de e-mail real, SMTP, Trigger Email, Cloud Functions de notificação, WebSocket, SSE, ações em lote, múltiplos campi ou BI externo foi antecipado.

## 16. Validação

Resultados efetivamente executados, falhas de ambiente e testes suplementares constam de `docs/TESTES_0.6.0.md`. A inspeção do artefato final consta de `docs/INSPECAO_ZIP_FINAL_0.6.0.md`.

## 17. Dependências e scripts

Nenhuma dependência de produção ou desenvolvimento foi adicionada ou removida em relação à base 0.5.1. O `package-lock.json` foi mantido como lockfile único. Foram acrescentados apenas os scripts:

- `firebase:migrate-0.6` → `tsx scripts/migrate060.ts`;
- `firebase:seed-campus-spaces` → `tsx scripts/seedCampusSpaces.ts`.

Não foi adicionado `bun.lock`, Yarn ou pnpm.

## 18. Endpoints administrativos relevantes

A API mantém o fluxo Express → App Check → Auth → autorização → serviço → repositório. As principais capacidades 0.6.0 são expostas por:

- `GET /api/admin/occurrences`, `GET /api/admin/occurrences/:id`, `PATCH /api/admin/occurrences/:id`;
- `GET /api/admin/dashboard`, `GET /api/admin/analytics`;
- `GET /api/admin/exports/occurrences`;
- `GET/POST/PATCH /api/admin/categories` conforme operação;
- `GET /api/admin/locations` e endpoints estruturais de áreas/ambientes;
- `GET/POST/PATCH /api/admin/teams`;
- `GET/PUT /api/admin/sla-config`;
- `PUT /api/admin/service-calendar` e CRUD de exceções de calendário;
- `GET /api/admin/audit-logs`;
- `DELETE /api/admin/occurrences/:id/test-data`;
- CRUD administrativo de usuários e resolução explícita de papel legado.

Não existe patch arbitrário do documento Firestore; as operações passam por DTOs/validators específicos e `expectedVersion` nas alterações concorrentes pertinentes.

## 19. Índices Firestore

`firestore.indexes.json` contém somente índices direcionados às consultas implementadas:

- usuários ativos por papel;
- fila operacional por prioridade/SLA/antiguidade;
- intervalos por abertura, encerramento, reabertura e SLA;
- filtros por situação, equipe e responsável com data;
- auditoria por tipo, alvo e ator com timestamp.

Consultas com desigualdade ajustam a ordem para respeitar a restrição do Firestore e preservam os critérios operacionais como desempate. Não foi criada uma matriz especulativa de todas as combinações possíveis.

## 20. Migração e rollback operacional

A migração 0.5.1 → 0.6.0 é executada somente por script explícito. O modo padrão é dry-run. Antes de `--apply` devem ser realizados backup/exportação recuperável e revisão do relatório do dry-run.

A migração não remove eventos/fotografias, não promove `Atendente`, não apaga `department` e não classifica registros como TEST sem evidência explícita. O rollback recomendado é restauração do backup do Firestore/Storage e retorno da aplicação à versão anterior; por isso nenhuma migração irreversível é executada no startup.

## 21. Seed institucional

`firebase:seed-campus-spaces` valida a cardinalidade 28/26/2/4 e atua de forma aditiva. O modo padrão é dry-run; `--apply` exige ambiente autorizado. Cadastros administrativos já existentes não são apagados nem renomeados silenciosamente.

## 22. Instalação e homologação

A sequência de instalação, migração e homologação está documentada no README, `MIGRACAO_0.5.1_PARA_0.6.0.md`, `LOCAIS_E_CORRECAO_DE_LOCAL.md` e `TESTES_0.6.0.md`.

A suíte oficial não pôde ser concluída neste ambiente por indisponibilidade do registry/dependências locais. Consequentemente, esta entrega **não é declarada pronta para produção** até a bateria oficial e a homologação funcional serem concluídas em ambiente compatível.

## 23. Pendências reservadas à 0.7.0

Permanecem deliberadamente fora da 0.6.0:

- Trigger Email;
- outbox/idempotência de notificações;
- templates e destinatários institucionais de e-mail;
- retentativas/falhas/auditoria de envio;
- qualquer envio real SMTP/e-mail.

## 24. Relação de arquivos e inspeção final

A relação definitiva de arquivos criados/modificados/removidos consta de `docs/ARQUIVOS_0.6.0.md`. A árvore integral consta de `docs/ARVORE_DIRETORIOS.md`. A verificação do ZIP limpo consta de `docs/INSPECAO_ZIP_FINAL_0.6.0.md`.
