# Relatório de testes — versão 0.3.0

## 1. Ambiente

- Data: 5 de agosto de 2026.
- Sistema: ambiente Linux do executor.
- Node.js: `v22.16.0` — código 0.
- npm: `10.9.2` — código 0.
- Java: OpenJDK `21.0.10` — código 0.
- Firebase CLI: indisponível — código 127.

## 2. Resultados dos comandos obrigatórios

| Comando | Código | Resultado |
|---|---:|---|
| `npm ci` | 1 | Falhou: `E404` para `@firebase/rules-unit-testing@5.0.1` no registro npm do ambiente. |
| `npm run typecheck` | 2 | Não executou a verificação integral: tipos de Node, Vite e Testing Library não instalados. |
| `npm run lint` | 127 | `eslint` não instalado. |
| `npm run test` | 127 | `vitest` não instalado. |
| `npm run build` | 127 | `vite` não instalado. |
| `npm audit --omit=dev` | 1 | Endpoint de auditoria do registro retornou HTTP 404. |
| `npm run validate` | 2 | Interrompido no typecheck pela ausência das dependências. |
| `npm run test:rules` | 127 | Firebase CLI não instalada. |
| `npm run test:firebase` | 127 | Firebase CLI não instalada. |

## 3. Causa e consequência

O registro configurado pelo ambiente é um espelho interno que não disponibiliza `firebase`, `firebase-admin`, `firebase-tools` e `@firebase/rules-unit-testing`. A rede do executor não permite resolução direta do registro npm oficial. Portanto, não foi possível instalar dependências nem iniciar emuladores.

A entrega **não pode ser considerada integralmente validada por execução**. Em especial, não se afirma:

- conclusão do TypeScript estrito;
- lint sem erros;
- testes Vitest aprovados;
- build de produção aprovado;
- regras aprovadas em emulador;
- Google Sign-In aprovado em emulador ou nuvem;
- App Check real aprovado;
- bootstrap aprovado contra Firestore Emulator.

## 4. Verificações complementares concluídas

| Verificação | Código | Resultado |
|---|---:|---|
| análise sintática TypeScript/TSX com TypeScript 5.8.3 | 0 | 110 arquivos analisados, zero erro sintático. |
| auditoria estática de estrutura e segurança | 0 | 139 arquivos textuais, zero erro. |

A auditoria estática verificou:

- JSONs parseáveis;
- versão 0.3.0 coerente na raiz do lock, package e metadata;
- presença dos arquivos Firebase obrigatórios;
- ausência de `bun.lock`, `.env` real e service account;
- hashes das marcas;
- resolução de imports locais;
- ausência de endpoints e tokens demonstrativos em código ativo;
- ausência de armazenamento manual de sessão;
- ausência da marca anterior em código ativo;
- TypeScript estrito;
- regras com negação por padrão;
- padrões comuns de private key e token.

Essas verificações não substituem `npm run validate` nem os testes de emulador.

## 5. Procedimento obrigatório em ambiente com acesso ao npm

Como o lockfile não pôde ter o grafo Firebase regenerado, execute inicialmente:

```bash
npm install --package-lock-only
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm audit --omit=dev
npm run validate
npm run test:rules
npm run test:firebase
```

Registre códigos de saída e atualize este relatório antes de considerar a versão apta para implantação.

## 6. Cobertura planejada da suíte

A suíte criada cobre autenticação anônima, separação de instâncias, ausência de UID público, Google e autorização administrativa, domínios, e-mail verificado, UID, três papéis, gestão de usuários, proteção do último Administrador, App Check, regras do Firestore, negação do Storage, bootstrap, identidade e ausência de autenticação demonstrativa.
