# Release Notes — Olhos do Campus 1.0.2

**Sistema Institucional de Manutenção da Infraestrutura Física**  
**Data:** 25 de setembro de 2026

## Escopo

A versão 1.0.2 simplifica o fluxo operacional de situações sem alterar a arquitetura do sistema ou o modelo de persistência principal.

## Situações operacionais livres

As situações ativas passam a ser:

- Recebida;
- Em triagem;
- Em análise;
- Encaminhada ao setor responsável;
- Em atendimento;
- Aguardando material;
- Aguardando contratação ou serviço externo;
- Resolvida;
- Não procedente;
- Cancelada.

Não existe mais sequência obrigatória entre essas situações. Administrador, Gestor e Atendente podem alterar diretamente a situação de uma ocorrência que esteja dentro de seu escopo de autorização.

As permissões de acesso continuam sendo aplicadas normalmente. Em especial, o perfil Atendente permanece restrito às ocorrências atribuídas individualmente a ele.

## Reabertura e SLA

Ao sair de uma situação final para qualquer situação não final, o sistema registra reabertura, remove as datas de encerramento/resolução quando aplicável, incrementa o contador de reaberturas e retoma o SLA.

Quando a nova situação é uma situação de espera, a reabertura já deixa o SLA pausado de forma coerente. Alterações entre duas situações finais permanecem encerradas e preservam o instante original de fechamento/SLA, evitando distorção dos indicadores.

## Retirada de Duplicada

A situação `Duplicada` foi retirada das opções ativas e não pode mais ser escolhida em novas alterações.

Casos duplicados ou similares devem utilizar o apensamento operacional:
- `DUPLICATE`: mesmo problema;
- `SIMILAR`: tratamento conjunto.

Registros antigos já persistidos com situação `Duplicada` permanecem legíveis. Ao alterá-los para uma situação ativa, o vínculo legado `duplicateOfOccurrenceId/duplicateOfProtocol` é removido.

## Implantação

O wrapper de Cloud Run foi corrigido para utilizar por padrão a imagem `olhos-do-campus-api`, alinhada ao nome produzido pelo `cloudbuild.yaml`.

Não há migração obrigatória do Firestore.
