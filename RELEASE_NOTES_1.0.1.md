# Release Notes — Olhos do Campus 1.0.1

**Sistema Institucional de Manutenção da Infraestrutura Física**  
**Data:** 24 de setembro de 2026

## Escopo

A versão 1.0.1 introduz dois recursos de gestão operacional:

1. classificação de ocorrências como `REAL` ou `TEST`, disponível aos perfis **Gestor** e **Administrador**;
2. apensamento não destrutivo de ocorrências duplicadas ou similares, com tratamento operacional conjunto.

## Registros TEST

- o registro continua íntegro, rastreável e consultável no painel;
- Gestor e Administrador podem alternar `REAL ↔ TEST`;
- a alteração gera evento no histórico e registro de auditoria;
- registros `TEST` ficam fora, por padrão, do dashboard, dos indicadores analíticos e dos relatórios operacionais;
- a listagem administrativa continua permitindo localizar e filtrar esses registros;
- a exclusão física de `TEST` permanece restrita ao Administrador e é bloqueada enquanto o registro integrar um agrupamento de apensamento.

## Apensamento operacional

O apensamento admite duas relações:
- `DUPLICATE`: mesmo problema físico;
- `SIMILAR`: registros relacionados cujo tratamento deve ocorrer em conjunto.

São sincronizados no agrupamento:
- situação;
- prioridade;
- equipe responsável;
- responsável individual;
- snapshot e estado do SLA;
- datas operacionais de resolução/encerramento;
- reabertura;
- natureza `REAL/TEST`.

Permanecem individualizados:
- protocolo e chave de acompanhamento;
- descrição original;
- categoria e localização próprias/reportadas;
- fotografias;
- observações administrativas;
- mensagens públicas, salvo quando o gestor selecionar explicitamente a publicação para todo o grupo.

O sistema impede agrupamentos mistos `REAL + TEST`, ciclos, combinação com a situação legada `Duplicada` e apensamento de uma ocorrência principal que ainda possua ocorrências filhas.

## Compatibilidade

Não há migração obrigatória de dados. Os novos campos são opcionais e ocorrências preexistentes continuam válidas. O mecanismo legado de encerramento pela situação `Duplicada` foi preservado para compatibilidade, mas não pode coexistir com o novo apensamento no mesmo registro.
