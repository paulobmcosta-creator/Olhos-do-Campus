# Inspeção do ZIP final — versão 0.7.2

Artefato: `olhos-do-campus-0.7.2.zip`.

## Procedimento

A versão foi preparada a partir da árvore extraída do ZIP 0.7.1, sem reutilização de versões anteriores. Antes do empacotamento definitivo foram executadas validações estruturais, comparação por conteúdo com a 0.7.1 para os arquivos deliberadamente fora do escopo, parse dos arquivos de configuração, transpilação sintática auxiliar e varredura de credenciais.

Depois da geração, o ZIP final foi reaberto como arquivo e seu conteúdo foi inspecionado a partir do próprio ZIP, sem presumir que a árvore de trabalho e o artefato compactado eram idênticos.

## Validações pré-empacotamento

- [x] `package.json`, `package-lock.json`, pacote/lockfile do Worker, metadata, blueprint e constante ativa coerentes com 0.7.2;
- [x] baseline Node preservada em `>=22.22.2 <23`;
- [x] zero alterações de versão de dependências em relação à 0.7.1;
- [x] `infra/artifact-registry-cleanup-policy.json`, `server/repositories/r2PhotoRepository.ts`, `cloudbuild.yaml`, `Dockerfile` e `firestore.rules` permanecem byte a byte iguais à 0.7.1;
- [x] três índices compostos de `notificationWebhookEvents` correspondentes às queries reais foram adicionados;
- [x] 212 arquivos TS/TSX transpilaram sem diagnóstico sintático no validador auxiliar;
- [x] `git diff --no-index --check` não reportou erro de whitespace;
- [x] nenhuma pasta `node_modules`, `dist`, `.git`, `work` ou `outputs` permaneceu na árvore final;
- [x] nenhum `.env` real permaneceu na árvore final;
- [x] varredura forte de padrões Resend, webhook secret, `sk_`, Google API key e blocos de private key: zero correspondências de credencial real.

## Resultado da reabertura do ZIP

A inspeção pós-empacotamento confirma:

- [x] ZIP reaberto sem erro;
- [x] raiz única `olhos-do-campus-0.7.2/`;
- [x] 356 arquivos no projeto integral;
- [x] `package.json` presente e versão 0.7.2;
- [x] `package-lock.json` raiz e lockfile isolado do Maintenance Worker presentes;
- [x] documentos obrigatórios 0.7.2 presentes;
- [x] JSONs críticos parseáveis;
- [x] ausência de `node_modules`, `dist`, `.git`, `work`, `outputs`, caches e temporários proibidos;
- [x] ausência de `.env` real;
- [x] ausência de credenciais pelos padrões fortes de inspeção;
- [x] nenhum artefato compilado foi incluído.

## SHA-256

O SHA-256 exato do ZIP fechado é calculado **depois** desta documentação ser incorporada ao arquivo e é apresentado na devolutiva de entrega junto ao link do artefato. O hash não é gravado dentro do próprio ZIP porque inserir o hash no conteúdo alteraria o próprio hash de forma autorreferente.

## Limitação de homologação

A limpeza e integridade estrutural do ZIP foram confirmadas. A aprovação funcional pré-implantação continua pendente porque o runtime disponível nesta execução é Node 22.16.0, inferior à baseline `>=22.22.2 <23`, e `npm ci` não pôde materializar a árvore de dependências. Os comandos oficiais bloqueados estão registrados em `TESTES_0.7.2.md`.

**Código corrigido; validação pré-implantação ainda pendente em ambiente compatível.**
