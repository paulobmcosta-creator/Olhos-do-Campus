# Política de fotografias — versão 0.6.0

## Finalidade e minimização

As fotografias servem exclusivamente como evidência operacional de problemas e soluções de infraestrutura. O canal público mantém **registro sem identificação pessoal obrigatória**.

Orientação ao comunicante: evitar fotografar rostos, documentos, placas de veículos, telas ou outras informações pessoais. Antes do armazenamento, as imagens passam pelo processamento já existente, com reencodificação e remoção de metadados EXIF. Isso não elimina dados pessoais que estejam visíveis nos próprios pixels.

## Quantidade, tipo e visibilidade

- Registro inicial: até 3 fotografias `INITIAL`, internas por padrão.
- Solução: até 3 fotografias `RESOLUTION`, internas por padrão.
- Administrador e Gestor podem adicionar e visualizar fotografias no exercício da gestão da ocorrência.
- A alteração de visibilidade permanece sujeita às regras operacionais do backend e ao tipo de fotografia.
- Nenhuma fotografia é acessada diretamente pelo cliente no Cloud Storage.

## Consulta pública

Uma fotografia de solução explicitamente pública continua protegida pelo fluxo de acompanhamento: App Check quando obrigatório, autenticação anônima, protocolo e chave de acompanhamento. O DTO público contém somente metadados mínimos; o caminho físico do Storage não é exposto.

## Exclusão operacional e expurgo TEST

A exclusão normal de fotografia segue o mecanismo de tombstone/cleanup já existente, com auditoria e tratamento de objeto órfão quando necessário.

A exclusão definitiva de uma ocorrência classificada como `TEST`, exclusiva do Administrador, também remove suas fotografias do Storage e metadados associados. Ocorrência `REAL` não possui ação comum de exclusão física.

## Retenção

**Prazo de retenção institucional permanece pendente de decisão específica.** A versão 0.6.0 não cria eliminação automática de fotografias de ocorrências reais resolvidas.
