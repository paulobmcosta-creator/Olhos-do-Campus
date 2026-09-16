# Firebase Emulator Suite — versão 0.6.0

## Dependências

É necessário Java/JRE compatível com o Firebase CLI, além de Node/npm compatíveis com o lockfile.

## Iniciar

```bash
npm run emulators
```

## Suítes obrigatórias

```bash
npm run test:rules
npm run test:firebase
npm run test:storage
```

`test:rules` comprova Firestore/Storage deny-all para clientes. `test:firebase` cobre integração Auth/Firestore/Storage. `test:storage` cobre ciclo específico de Storage.

## Seeds e migração no emulator

```bash
npm run firebase:seed-reference-data
npm run firebase:seed-campus-spaces -- --dry-run
npm run firebase:seed-campus-spaces -- --apply
npm run firebase:migrate-0.6 -- --dry-run
npm run firebase:migrate-0.6 -- --apply
```

Dry-run deve anteceder qualquer aplicação. Fora do Emulator Suite, os scripts de 0.6.0 possuem confirmações adicionais para evitar execução acidental.

## Limitação do ambiente de geração

Consulte `docs/TESTES_0.6.0.md`: a execução do Emulator Suite só deve ser declarada aprovada quando Java, Firebase CLI e todas as dependências npm estiverem efetivamente disponíveis.
