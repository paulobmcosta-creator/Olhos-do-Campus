# Relatório de Implementação — Versão 1.0.1

## Sistema Institucional de Manutenção da Infraestrutura Física
**Data:** 24 de setembro de 2026  
**Repositório:** `paulobmcosta-creator/Olhos-do-Campus`  
**Branch de implementação:** `release/1.0.1-testes-apensamento`  
**Pull request:** #1

## 1. Objetivo

Implementar, sem reescrever a arquitetura existente, a gestão de registros de teste e o apensamento operacional de ocorrências duplicadas ou similares.

## 2. Decisões de modelagem

A classificação `REAL | TEST` já existia no domínio e foi reaproveitada. A versão 1.0.1 adiciona permissão de alteração por Gestor e Administrador, histórico, auditoria e exclusão dos registros TEST das métricas operacionais padrão.

O apensamento foi modelado como relação entre registros, e não como nova situação. Cada ocorrência apensada aponta diretamente para uma ocorrência principal por `attachedToOccurrenceId`, eliminando cadeias de referência. A ocorrência principal é localizada como raiz do agrupamento e suas filhas são consultadas pelo mesmo identificador.

## 3. Sincronização operacional

As alterações compartilhadas são aplicadas em transação Firestore. O grupo sincroniza situação, prioridade, equipe, responsável, SLA, datas de resolução/encerramento, reabertura e classificação REAL/TEST. A versão de cada documento afetado é incrementada, preservando o bloqueio otimista.

Eventos de histórico correspondentes são gravados para os membros afetados. Se o próprio ato de apensar exigir mudança de situação para alinhar a ocorrência à principal, a mudança recebe evento `STATUS_CHANGED`, evitando alteração silenciosa de estado.

## 4. Integridade e privacidade

O apensamento não transfere protocolo, chave de acompanhamento, fotografias, descrição ou observações entre usuários. A consulta pública de um protocolo continua restrita à sua própria chave.

A mensagem pública pode ser propagada ao grupo somente por opção explícita. O evento público de apensamento utiliza texto genérico e não expõe o protocolo da ocorrência principal ao público.

Foram implementadas as seguintes proteções:
- bloqueio de `REAL ↔ TEST` no mesmo agrupamento;
- bloqueio de apensamento circular ou autorreferente;
- bloqueio de coexistência com a duplicidade legada;
- bloqueio de apensamento de uma ocorrência principal que ainda possua filhas;
- justificativa obrigatória no apensamento e desapensamento;
- exclusão definitiva de TEST bloqueada enquanto o registro estiver apensado.

## 5. Indicadores e relatórios

Dashboard, analytics e exportação operacional passam a utilizar `REAL` como classificação padrão. A listagem administrativa não oculta registros TEST, permitindo gestão e auditoria.

Ocorrências apensadas continuam sendo registros recebidos individualmente; a versão 1.0.1 não introduz métrica de “demanda física única”.

## 6. Compatibilidade e migração

A alteração é aditiva. Não há script de migração obrigatório: novos campos de apensamento são opcionais e documentos históricos sem esses campos continuam sendo desserializados normalmente.

## 7. Validação

No commit `b900513ceae712d490919b0545aebcfaad7b7093`, o GitHub Actions concluiu com sucesso:
- instalação por `npm ci`;
- TypeScript strict;
- ESLint com zero warnings;
- 72 arquivos de testes aprovados e 578 testes aprovados; 2 arquivos/3 testes ignorados conforme configuração;
- build de produção;
- verificação formal da identidade 1.0.1;
- Scale Guard;
- typecheck do Maintenance Worker;
- 7/7 testes do Maintenance Worker.

Os testes dependentes de Firebase Emulator e integrações externas opt-in não foram executados por esse workflow e não são declarados como concluídos.
