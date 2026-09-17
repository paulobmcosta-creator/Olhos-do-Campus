# Inspeção do ZIP final — versão 0.7.4

Artefato: `olhos-do-campus-0.7.4.zip`.

## Primeira passagem de fechamento

O ZIP foi gerado a partir de staging limpo e reaberto com `ZipFile.testzip()`. A primeira passagem, usada para validar a estrutura antes do fechamento definitivo, apresentou SHA-256 `fbe55baf26188ac2b0f14fe9036a1d41631c5cbcefa81f101546c5946456ce7c` e 371 arquivos.

Após registrar esta inspeção dentro do projeto, o ZIP é regenerado uma última vez e reaberto novamente. O SHA-256 **definitivo** do contêiner final é calculado externamente após esse fechamento e registrado na devolutiva e no arquivo sidecar `olhos-do-campus-0.7.4.zip.sha256`. Ele não é inserido dentro do próprio ZIP porque modificar o conteúdo para incluir seu próprio hash alteraria o hash por auto-referência.

## Resultado estrutural

- [x] arquivo ZIP reaberto sem erro (`testzip()` sem entrada corrompida);
- [x] raiz única `olhos-do-campus-0.7.4/`;
- [x] 371 arquivos na primeira passagem, sem diretórios de build/dependências;
- [x] `package.json` em versão `0.7.4`;
- [x] `package-lock.json` raiz presente e versão `0.7.4`;
- [x] package/lock do Maintenance Worker presentes e versão `0.7.4`;
- [x] documentação obrigatória 0.7.4 presente;
- [x] `node_modules`, `dist`, `.git`, `work`, `outputs` e logs ausentes;
- [x] `.env` real ausente; somente `.env.example` presente;
- [x] 13 JSONs parseáveis a partir da árvore validada;
- [x] zero padrões fortes compatíveis com API key Resend, webhook secret, `sk_`, Google API key ou private key;
- [x] baseline Node preservada em `>=22.22.2 <23`;
- [x] nenhuma dependência ou versão de dependência alterada em relação à 0.7.3.

## Escopo preservado

Comparações SHA-256 confirmaram identidade byte a byte com a 0.7.3 para R2, fallback Firebase Storage, migração/reconciliação, cleanup Storage, Artifact Registry policy/scripts, `cloudbuild.yaml`, `Dockerfile`, arquivos Pages, `firestore.indexes.json`, `firestore.rules` e lógica HMAC/cron do Worker.

## Validação de código

A inspeção estrutural do ZIP não substitui a bateria de build/testes. A validação oficial da 0.7.4 permanece bloqueada pelo ambiente, conforme `TESTES_0.7.4.md`.
