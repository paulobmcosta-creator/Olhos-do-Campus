# Locais e correção de local

## Campus único

A 0.6.0 opera somente no **IFES — Campus Barra de São Francisco**. A hierarquia inicial é Bloco 01, Bloco 02, Bloco 03 e Externo. O documento institucional não informa pavimentos; por isso não são inventados pavimentos. O nó técnico `sem-pavimento` tem nome vazio.

## Carga inicial

- Bloco 01: 28 ambientes;
- Bloco 02: 26 ambientes;
- Bloco 03: 2 ambientes;
- Externo: 4 ambientes;
- total: 60.

O script `npm run firebase:seed-campus-spaces -- --dry-run` confere a contagem e não escreve. `--apply` realiza seed aditivo. Fora do Emulator Suite exige `ALLOW_NON_EMULATOR_CAMPUS_SPACES_SEED=CONFIRM_CAMPUS_SPACES_0_6`.

## Administração estrutural

Somente Administrador cria/renomeia/ordena/ativa/desativa Bloco/Área e Ambiente. Não há exclusão física de local histórico.

## Correção da ocorrência

`reportedLocation` é preservado; `location` representa o local atual. Administrador e Gestor podem corrigir o local da ocorrência com justificativa. O histórico registra `LOCATION_CHANGED`, a auditoria registra a correção e a consulta pública recebe somente o local atual mais aviso genérico.

## Idempotência do seed

Se um identificador institucional já existe, o seed não renomeia nem remove o valor administrado. Ambientes ausentes são adicionados. Locais adicionais criados pelo Administrador permanecem intactos.
