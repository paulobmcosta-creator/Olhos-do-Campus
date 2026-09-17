# Inspeção do ZIP final — versão 0.7.1

Artefato: `olhos-do-campus-0.7.1.zip`.

## Procedimento

O projeto foi copiado para uma árvore de staging limpa, sem `.git`, `node_modules`, `dist` ou arquivos de ambiente reais. O ZIP foi gerado com uma única raiz `olhos-do-campus-0.7.1/`, reaberto como arquivo e inspecionado a partir do conteúdo comprimido, sem presumir equivalência com o diretório de trabalho.

Depois da primeira reabertura, este relatório foi consolidado, o ZIP foi regenerado e **reaberto novamente** para confirmar que o próprio relatório final também estava contido no artefato inspecionado.

## Resultado

- [x] ZIP reaberto sem erro;
- [x] raiz única `olhos-do-campus-0.7.1/`;
- [x] 348 arquivos no projeto integral;
- [x] `package.json` presente e versão `0.7.1`;
- [x] `package-lock.json` raiz presente;
- [x] `infra/cloudflare/maintenance-worker/package-lock.json` presente;
- [x] Worker sem dependência local `file:../../..`/`olhos-do-campus`;
- [x] `src/config/version.ts`, `metadata.json`, `firebase-blueprint.json` e Worker coerentes com 0.7.1;
- [x] `cloudbuild.yaml` usa `us-west1` e valida `_REGION`;
- [x] Dockerfile usa Node `22.22.2-bookworm-slim`;
- [x] package raiz e Worker exigem Node `>=22.22.2 <23`;
- [x] documentos obrigatórios 0.7.1 presentes;
- [x] testes novos 0.7.1 presentes;
- [x] ausência de `node_modules`, `dist`, `.git`, `work`, `outputs`, `coverage`, logs e temporários;
- [x] ausência de `.env` real; somente `.env.example`;
- [x] JSONs críticos do ZIP parseáveis;
- [x] nenhum padrão compatível com API key Resend (`re_...`), webhook secret (`whsec_...`), chave `sk_...`, Google API key ou PEM de private key;
- [x] ocorrências textuais de `R2_SECRET`, `secret`, `token`, `password` e termos semelhantes foram revisadas como nomes de variável, placeholders, testes ou documentação, não credenciais reais;
- [x] regras Firestore/Storage deny-all preservadas;
- [x] nenhum artefato compilado foi incluído.

## Observação sobre testes

A limpeza do ZIP não deve ser confundida com aprovação da bateria de build. O ambiente desta execução não conseguiu materializar `node_modules` por incompatibilidade do Node local (22.16.0 abaixo do baseline 22.22.2) e, principalmente, por falha de resolução do registry npm (`EAI_AGAIN`). Typecheck, lint, Vitest, build, audits e Firebase CLI foram invocados e estão documentados como **BLOQUEADO PELO AMBIENTE** em `TESTES_0.7.1.md`.

O ZIP contém código-fonte e lockfiles completos para reprodução posterior em ambiente compatível.

## Registro da primeira passagem

A primeira reabertura confirmou 348 arquivos, raiz única, versão 0.7.1, 13 JSONs parseáveis, ausência de paths proibidos/`.env` real/credenciais e presença de todos os documentos e testes 0.7.1 esperados. Após registrar esse resultado, o staging foi reconstruído a partir da árvore final e o ZIP foi gerado novamente para a segunda inspeção conclusiva.
