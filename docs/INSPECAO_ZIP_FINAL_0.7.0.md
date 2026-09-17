# Inspeção do ZIP final — versão 0.7.0

Artefato esperado: `olhos-do-campus-0.7.0.zip`.

## Procedimento

O ZIP final foi gerado a partir de uma árvore de staging limpa e reaberto como arquivo. A listagem interna e os arquivos críticos foram lidos a partir do próprio ZIP, não presumidos a partir do diretório de trabalho.

## Resultado

- [x] arquivo ZIP reaberto sem erro;
- [x] conteúdo listado e raiz única `olhos-do-campus-0.7.0/` confirmada;
- [x] `package.json` presente e versão `0.7.0` confirmada;
- [x] `package-lock.json` raiz e lockfile do Worker presentes;
- [x] ausência de `node_modules`, `dist`, `work`, `outputs`, `.git`, `.env` real, logs e temporários;
- [x] ausência de formatos prováveis de API key Resend, webhook secret, chave R2, HMAC, Google API key e private key;
- [x] placeholders e nomes de variáveis em `.env.example` diferenciados de credenciais reais;
- [x] documentos 0.7.0, runbooks, changelog, relatório, testes e homologação presentes;
- [x] scripts de migração, reconciliação, cleanup, Artifact e Worker presentes;
- [x] `public/_redirects`, `public/_headers`, Dockerfile e Cloud Build presentes;
- [x] JSONs críticos parseáveis e regras deny-all presentes.

O ZIP contém código-fonte completo e lockfiles, não artefatos compilados. O build foi validado separadamente e pode ser reproduzido com `npm ci` e as variáveis públicas de produção.
