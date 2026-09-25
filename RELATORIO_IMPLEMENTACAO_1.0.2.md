# Relatório de Implementação — Versão 1.0.2

## Sistema Institucional de Manutenção da Infraestrutura Física
**Data:** 25 de setembro de 2026  
**Repositório:** `paulobmcosta-creator/Olhos-do-Campus`  
**Branch de implementação:** `release/1.0.2-status-livre`  
**Pull request:** #2

## 1. Objetivo

Remover a matriz restritiva de transições de situação e retirar `Duplicada` das situações operacionais selecionáveis, preservando compatibilidade com registros históricos.

## 2. Situações ativas e compatibilidade legada

O contrato de domínio passou a separar:
- `OCCURRENCE_STATUSES`: situações ativas e selecionáveis;
- `LEGACY_OCCURRENCE_STATUSES`: valores históricos mantidos apenas para compatibilidade;
- `OCCURRENCE_STATUS_VALUES`: união utilizada na leitura de dados persistidos e respostas.

`Duplicada` permanece apenas como valor legado. Novas atualizações não aceitam esse valor.

## 3. Transições livres

A máquina de estados deixou de impor sequência operacional. Qualquer situação de origem pode avançar diretamente para qualquer situação ativa, independentemente do papel administrativo.

A autorização continua ocorrendo fora da matriz de situação. O perfil Atendente continua restrito às ocorrências sob sua responsabilidade direta e não recebe permissões adicionais de prioridade, equipe, responsável, categoria, local, classificação TEST ou apensamento.

## 4. Reabertura e SLA

A definição de reabertura foi generalizada: qualquer saída de situação final para situação não final é tratada como reabertura.

O processamento de SLA foi reorganizado para garantir que:
- reabertura remova o estado de conclusão;
- tempo transcorrido enquanto a ocorrência ficou finalizada seja contabilizado como pausa;
- reabertura direta para situação de espera deixe o SLA efetivamente pausado;
- transições entre situações não finais continuem pausando/retomando o SLA conforme a situação de destino.

## 5. Duplicidade e apensamento

O mecanismo legado de criação de vínculo por `duplicateOfProtocol` foi retirado do contrato de atualização e da interface.

O apensamento operacional da 1.0.1 passa a ser o mecanismo canônico para ocorrências duplicadas ou similares.

Campos `duplicateOf*` permanecem somente para leitura de registros históricos. Ao sair de `Duplicada`, o vínculo legado é removido automaticamente e registrado no histórico.

## 6. Interface

O seletor de situação exibe todas as situações ativas para Gestor, Administrador e Atendente. `Duplicada` não aparece em registros normais.

Quando um registro histórico já está em `Duplicada`, a interface pode apresentar o valor atual como opção legada desabilitada até que uma nova situação ativa seja selecionada.

## 7. Implantação

O wrapper `scripts/deployCloudRun.sh` passou a separar o nome do serviço (`olhos-do-campus`) do nome da imagem (`olhos-do-campus-api`), corrigindo a divergência observada durante a implantação da 1.0.1.

Não há migração de Firestore.

## 8. Validação técnica

O run funcional #26 do workflow `Validate pull request`, no commit `afd6eabb99b8a2b0ed3df333f76b13d2d7f0310f`, foi aprovado integralmente:

- `npm ci`: PASS;
- TypeScript strict: PASS;
- ESLint com zero warnings: PASS;
- suíte principal: 72 arquivos aprovados, 2 ignorados; 577 testes aprovados, 3 ignorados;
- build de produção: PASS;
- verificação formal da release: `RELEASE_IDENTITY_TEST=PASS`;
- Scale Guard: `MAX_SCALE_1_SECURITY_INVARIANT=YES`;
- typecheck do Maintenance Worker: PASS;
- testes do Maintenance Worker: 7/7 PASS;
- geração e upload do ZIP integral pelo pipeline: PASS.

As suítes de Firebase Emulator e integrações reais opt-in EWS/R2/Resend não foram executadas pelo workflow e não são declaradas como concluídas.
