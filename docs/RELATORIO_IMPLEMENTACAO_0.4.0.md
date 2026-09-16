# Relatório de implementação — versão 0.4.0

## 1. Identificação

- **Projeto:** Olhos do Campus.
- **Nome oficial:** Sistema Institucional de Manutenção da Infraestrutura Física.
- **Instituição:** Instituto Federal do Espírito Santo — Campus Barra de São Francisco.
- **Versão:** 0.4.0.
- **Data da entrega:** 10/08/2026.
- **Fonte de verdade:** ZIP mais recente fornecido para esta implementação; versões anteriores não foram reutilizadas como código.

## 2. Diagnóstico da base 0.3.0

A inspeção do ZIP confirmou que o runtime da 0.3.0 ainda utilizava `InMemoryDatabase` como fonte de verdade para ocorrências, protocolo, categorias, localizações e configuração operacional. O histórico e as mensagens eram arrays associados ao objeto em memória, fotografias eram Data URLs temporárias e o acompanhamento público utilizava chave em query string.

Também foram confirmados três defeitos herdados relevantes: `server/config/env.ts` fixava a porta 3000 apesar de `.env.example` declarar `PORT=3000`; a visão pública era formada por exclusão de campos e ainda podia transportar `assignedTo`; e indicadores operacionais eram derivados de dados em memória/demonstração.

A validação prévia da 0.3.0 foi tentada antes da implementação. A instalação não concluiu por indisponibilidade do registro npm no ambiente. Os comandos subsequentes falharam pela ausência das dependências. Essa limitação foi mantida separada da implementação 0.4.0 e é reproduzida no relatório de testes.

## 3. Arquitetura implementada

O fluxo de negócio permanece estritamente server-only:

```text
React/TypeScript
  -> API Express
  -> App Check + Firebase Authentication
  -> autorização administrativa quando aplicável
  -> validação Zod e regras de domínio
  -> serviços
  -> repositórios
  -> Cloud Firestore pelo Firebase Admin SDK
```

Nenhum componente React acessa diretamente Firestore ou Storage. `firestore.rules` e `storage.rules` permanecem com negação integral para clientes Web.

## 4. Persistência de ocorrências

Foi criado `FirestoreOccurrenceRepository`, responsável pelo estado materializado em `occurrences/{occurrenceId}`. O documento contém protocolo, derivação da chave, snapshots de categoria e localização, descrição, risco, estado, prioridade, atribuição estável, vínculo de duplicidade, timestamps e versão. Arrays crescentes, Data URLs e dados do comunicante não são persistidos.

A atualização administrativa usa `version` iniciado em 1. Cada `PATCH` exige `expectedVersion`; divergência resulta em HTTP 409 com orientação para recarregar os dados. A verificação final ocorre dentro da transação Firestore, evitando sobrescrita silenciosa.

## 5. Protocolo transacional

A sequência anual reside em `protocolCounters/{year}`. A criação executa uma transação que:

1. lê o contador anual;
2. calcula a próxima sequência;
3. normaliza o prefixo configurado;
4. forma `PREFIXO-AAAA-NNNNNN`;
5. verifica inexistência do protocolo;
6. atualiza o contador;
7. cria a ocorrência;
8. cria os eventos iniciais.

A estratégia é compatível com retries do Firestore, múltiplas instâncias e reinícios de processo. Foi preparado teste concorrente com 20 criações simultâneas no Emulator Suite.

## 6. Chave de acompanhamento

A chave é gerada exclusivamente no servidor com `crypto.randomInt`. A derivação usa salt aleatório por ocorrência e `scrypt`; a verificação usa `timingSafeEqual`. O Firestore armazena somente `trackingKeyHash` e `trackingKeySalt`.

A chave original não integra ocorrência persistida, histórico, auditoria ou logs. A criação retorna somente `protocol`, `trackingKey` e `createdAt`. O acompanhamento passou a utilizar `POST /api/occurrences/track`, com chave no corpo JSON. A chave não é colocada em URL nem `localStorage`; o encaminhamento imediato usa somente estado transitório do React Router.

## 7. Histórico funcional

O histórico foi transferido para `occurrences/{occurrenceId}/events/{eventId}`. Os eventos são append-only no fluxo ordinário e possuem visibilidade `PUBLIC` ou `INTERNAL`.

Tipos implementados:

- `OCCURRENCE_CREATED`;
- `STATUS_CHANGED`;
- `PRIORITY_CHANGED`;
- `ASSIGNMENT_CHANGED`;
- `PUBLIC_MESSAGE_ADDED`;
- `INTERNAL_NOTE_ADDED`;
- `DUPLICATE_LINKED`;
- `DUPLICATE_UNLINKED`;
- `OCCURRENCE_RESOLVED`;
- `OCCURRENCE_REOPENED`.

Mudanças de estado, prioridade, atribuição, duplicidade, mensagem pública e observação interna são gravadas juntamente com a alteração do estado quando a atomicidade de domínio é necessária.

## 8. Separação público/interno

A visão pública foi reconstruída por lista positiva. Ela não contém derivação da chave, IDs internos, atribuição, prioridade administrativa, versão, autor administrativo, observação interna ou dados técnicos do Firestore. Eventos internos são filtrados antes da serialização pública.

Mensagens públicas são apresentadas com identificação institucional genérica — “Equipe responsável” — enquanto o painel administrativo conserva o autor real do evento.

## 9. Máquina de estados

Foi criado módulo de domínio centralizado. Transições arbitrárias não são mais aceitas apenas por o valor pertencer ao enum. A matriz completa está em `docs/FLUXO_DE_SITUACOES.md`.

Estados finais são `Resolvida`, `Não procedente`, `Duplicada` e `Cancelada`. Reabertura somente é aceita para `Em análise` e apenas por Administrador ou Gestor. Reabrir uma resolução remove `resolvedAt` e produz `OCCURRENCE_REOPENED`.

## 10. Resolução e duplicidade

Entrada em `Resolvida` define `resolvedAt` no servidor e cria `OCCURRENCE_RESOLVED`. O cliente não controla o timestamp.

Duplicidade exige ocorrência principal existente, não aceita autorreferência, mantém snapshot do protocolo principal e valida a cadeia para impedir ciclos. A verificação é repetida dentro da transação de atualização. Vínculo de duplicidade somente pode existir com situação `Duplicada`.

## 11. Atribuição administrativa

`assignedTo` textual foi substituído por `assignedToAdminUserId` e `assignedToDisplayNameSnapshot`. O serviço consulta `adminUsers`, exige cadastro existente, ativo e com papel elegível, e nunca utiliza `displayName` ou e-mail como chave. Atendente somente lê ocorrências atribuídas ao seu `adminUserId`.

## 12. Categorias, localizações e configurações

Categorias foram modeladas em `categories/{categoryId}` com nome, descrição, estado ativo, ordenação e metadados. O formulário público recebe apenas categorias ativas. A ocorrência preserva `categoryNameSnapshot`.

Localizações foram modeladas em `locations/{locationId}` preservando hierarquia de campus, bloco/área, pavimento e sala/ambiente com identificadores estáveis. A ocorrência armazena snapshot textual completo.

Configurações operacionais residem em `systemSettings/operational`, incluindo `institutionDisplayName`, `protocolPrefix`, `notificationEmails`, `autoAssignRisk` e `serviceNotice`. Alterações exigem Administrador, são validadas no backend e auditadas. Nome fantasia, nome oficial e frase institucional permanecem protegidos em `src/config/branding.ts`.

## 13. Seeds

Não há popularização automática do Firestore na inicialização. Foram adicionados:

- `npm run firebase:seed-reference-data` — configuração padrão, categorias e localizações provisórias;
- `npm run firebase:seed-demo-data` — quatro ocorrências demonstrativas.

O seed de demonstração é proibido em produção. Fora do Emulator Suite exige confirmação explícita de desenvolvimento. Os locais provisórios são marcados como tais e não são apresentados como cadastro físico oficial.

## 14. Fotografias

Cloud Storage permanece fora do escopo. Foi criada a abstração `PhotoRepository`. A implementação `InMemoryPhotoRepository` é permitida somente em desenvolvimento/emulador quando `ENABLE_TEMPORARY_PHOTO_STORAGE=true`; em produção a configuração é rejeitada. Quando o recurso está desabilitado, a interface não aceita o arquivo.

Nenhum byte ou Data URL é gravado no Firestore. O saneamento de imagem existente foi preservado para o modo temporário.

## 15. Consultas e indicadores

Listagens operacionais são limitadas a 100 documentos. A consulta de Atendente aplica o filtro de atribuição no Firestore. Filtros secundários ainda são aplicados sobre o conjunto limitado e, quando há truncamento, API e interface informam explicitamente que o resultado não é exaustivo.

Indicadores apresentados como reais usam agregações Firestore. Métricas ainda sem cálculo institucionalmente correto (`averageFirstPublicResponseHours`, `averageResolutionHours`, `byCategory`, `byLocation`) retornam estado indisponível em vez de valores aproximados.

## 16. Segurança preservada

Foram preservados Firebase Authentication anônima, instâncias Firebase independentes, Google Sign-In, Firebase Admin SDK, App Check, `adminUsers`, proteção do último Administrador, `auditLogs`, Application Default Credentials e Emulator Suite. A autenticação anônima é tratada como proteção técnica da requisição; o serviço utiliza a expressão “registro sem identificação pessoal obrigatória”.

Não foi adicionada captura de endereço IP. Não há credenciais embutidas.

## 17. Correções herdadas

- `PORT` agora é lida de `process.env.PORT`, aceita somente inteiro de 1 a 65535 e usa 3000 como fallback;
- chave removida da URL;
- `assignedTo` removido da visão pública;
- indicadores deixaram de tratar amostra truncada como total;
- documentação de atribuição por UID/e-mail/nome removida.

## 18. Dependências

Nenhuma dependência foi adicionada ou removida. `package-lock.json` preserva o grafo existente e foi atualizado apenas para a versão raiz 0.4.0. Validação estática confirmou correspondência entre as dependências declaradas na raiz do lockfile e `package.json`.

## 19. Limitações verificadas

A instalação integral não pôde ser concluída porque o ambiente não resolveu/acessou `registry.npmjs.org`. Consequentemente TypeScript completo, lint, Vitest, build e Emulator Suite não puderam ser executados com suas dependências locais. Uma inspeção auxiliar com TypeScript global transpôs 128 arquivos TS/TSX sem erro sintático, mas isso não substitui `npm run typecheck`.

Por essa razão, **esta entrega não é declarada apta para produção**. Consulte `docs/TESTES_0.4.0.md`.

## 20. Próxima versão — 0.5.0

A próxima versão deverá implementar Cloud Storage, múltiplas fotografias, remoção comprovada de EXIF, redimensionamento, compressão, formato padronizado, miniaturas, fotografia da solução, regras específicas, controle de acesso, limpeza de órfãos e tratamento de falhas entre Firestore e Storage.
