# Relatório de implementação — versão 0.2.0

## 1. Identificação

- **Nome fantasia:** Olhos do Campus.
- **Nome oficial:** Sistema Institucional de Manutenção da Infraestrutura Física.
- **Versão:** 0.2.0.
- **Data da entrega:** 5 de agosto de 2026.
- **Fonte de verdade:** arquivo ZIP mais recente fornecido para esta implementação.
- **Ativos adicionais:** composições horizontal e vertical oficiais do IFES — Campus Barra de São Francisco.

## 2. Diagnóstico de partida

O ZIP de origem continha um protótipo React/TypeScript com servidor Express concentrado em `server.ts`, navegação controlada por estado, dados simulados duplicados entre frontend e backend, autenticação administrativa local, persistência em memória, QR Code apenas decorativo, ausência de testes automatizados, `bun.lock` e dependências residuais relacionadas ao ambiente de geração original. A base não possuía React Router, tratamento HTTP centralizado, contratos de transporte validados nem separação arquitetural suficiente para substituição futura do repositório por Firestore.

## 3. Implementações realizadas

### 3.1 Identidade e terminologia

Foram aplicados “Olhos do Campus”, o nome administrativo oficial e a frase institucional aprovada. A interface foi restrita semanticamente a problemas de infraestrutura física. Foram removidas promessas indevidas de anonimato, linguagem de vigilância, afirmações de envio de e-mail e a marca anterior. A expressão adotada é “registro sem identificação pessoal obrigatória”.

### 3.2 Ativos institucionais

Os dois JPG recebidos foram preservados sem modificação binária em `public/brand/originals/` e copiados com nomes técnicos para `public/brand/`. A composição horizontal é usada no cabeçalho; a vertical, na entrada administrativa em telas amplas. Não foram aplicados recorte, distorção, rotação, recoloração, sombras ou incorporação base64. O texto alternativo é “Instituto Federal do Espírito Santo — Campus Barra de São Francisco”.

### 3.3 Dependências e configuração

npm passou a ser o gerenciador oficial. O projeto contém `package-lock.json` lockfile v3, versões exatas no manifesto, `packageManager`, requisitos de Node/npm e scripts multiplataforma. O `bun.lock`, a duplicidade de Vite, `@google/genai`, `motion`, `recharts` e `autoprefixer` foram removidos. React Router, Zod, ESLint, Vitest e Testing Library foram introduzidos e devidamente configurados.

### 3.4 TypeScript e organização

O `tsconfig.json` ativa `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` e `useUnknownInCatchVariables`. Modelos de domínio, contratos HTTP, configuração, autenticação e validações foram separados. Não há uso explícito de `any` nos arquivos TypeScript/TSX do projeto.

### 3.5 Backend

A criação da aplicação foi separada da inicialização do servidor. O backend agora possui controladores, middlewares, repositório, rotas, serviços, tipos, utilitários e validadores. Foram implementados `/api/health`, validação Zod, respostas de erro padronizadas, tratamento centralizado de exceções, limite de corpo, desativação de `x-powered-by`, autorização por papel demonstrativo e repositório em memória encapsulado. `process.env.PORT` é respeitado e Vite é importado dinamicamente apenas em desenvolvimento.

### 3.6 Frontend, rotas e erros

React Router implementa as URLs solicitadas, página 404, histórico, títulos por rota, retorno do navegador, foco no conteúdo e link de salto. O cliente HTTP preserva 400, 401, 403, 404, 409, 500, 503 e falhas de rede; não existe mais conversão silenciosa de erro em sucesso local.

### 3.7 Modo demonstrativo

O modo exige habilitação explícita no desenvolvimento por `ENABLE_DEMO_MODE=true` e `VITE_ENABLE_DEMO_MODE=true`, é desabilitado em produção e possui banner inequívoco. Os dados permanecem somente na memória. A autenticação administrativa é declaradamente simulada.

### 3.8 Correções funcionais

O protocolo foi isolado e corrigido para `INF-AAAA-NNNNNN`, sem duplicação do ano. O QR Code decorativo foi removido. Indicadores são calculados a partir do repositório e exibidos como “Dados demonstrativos”. Mensagens públicas e observações internas foram separadas; a consulta pública filtra chave, observações e eventos internos. Fotografias são reprocessadas no navegador e saneadas novamente no servidor, removendo segmentos de metadados antes da persistência temporária.

### 3.9 Acessibilidade básica

Foram implementados associação entre rótulos e campos, mensagens de erro vinculadas, foco visível, navegação por teclado, alvos mínimos, texto alternativo institucional, hierarquia de títulos, foco após mudança de rota, link “Ir para o conteúdo principal”, contraste básico, redução de movimento e largura mínima de 320 px. A auditoria integral permanece fora do escopo desta versão.

## 4. Arquivos modificados

- `.env.example`
- `.gitignore`
- `README.md`
- `eslint.config.js`
- `index.html`
- `metadata.json`
- `package.json`
- `src/App.tsx`
- `src/components/common/Footer.tsx`
- `src/components/common/Header.tsx`
- `src/index.css`
- `src/main.tsx`
- `tsconfig.json`
- `vite.config.ts`

## 5. Arquivos criados

- `CHANGELOG.md`
- `docs/ARQUITETURA.md`
- `docs/ARVORE_DIRETORIOS.md`
- `docs/ATIVOS_INSTITUCIONAIS.md`
- `docs/IDENTIDADE_INSTITUCIONAL.md`
- `docs/MODO_DEMONSTRATIVO.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.2.0.md`
- `docs/TESTES_0.2.0.md`
- `package-lock.json`
- `public/brand/ifes-bsf-horizontal.jpg`
- `public/brand/ifes-bsf-vertical.jpg`
- `public/brand/originals/bsf-horizontal-cor.jpg`
- `public/brand/originals/bsf-vertical-cor.jpg`
- `server/app.ts`
- `server/config/env.ts`
- `server/controllers/authController.ts`
- `server/controllers/configController.ts`
- `server/controllers/occurrenceController.ts`
- `server/index.ts`
- `server/middleware/auth.ts`
- `server/middleware/errorHandler.ts`
- `server/middleware/validate.ts`
- `server/repositories/inMemoryDatabase.ts`
- `server/repositories/initialData.ts`
- `server/routes/apiRoutes.ts`
- `server/services/authService.ts`
- `server/services/configService.ts`
- `server/services/occurrenceService.ts`
- `server/types/errors.ts`
- `server/types/express.d.ts`
- `server/utils/ids.ts`
- `server/utils/imageSanitizer.ts`
- `server/utils/trackingKey.ts`
- `server/validators/schemas.ts`
- `src/components/common/BrandImage.tsx`
- `src/components/common/DemoModeBanner.tsx`
- `src/components/common/LoadingState.tsx`
- `src/components/common/OccurrenceBadges.tsx`
- `src/components/common/StatusAlert.tsx`
- `src/components/public/StepIndicator.tsx`
- `src/config/branding.ts`
- `src/config/env.ts`
- `src/config/routes.ts`
- `src/context/AdminAuthContext.tsx`
- `src/context/AppDataContext.tsx`
- `src/hooks/useDocumentTitle.ts`
- `src/layouts/AdminLayout.tsx`
- `src/layouts/RootLayout.tsx`
- `src/models/admin.ts`
- `src/models/config.ts`
- `src/models/http.ts`
- `src/models/occurrence.ts`
- `src/pages/HomePage.tsx`
- `src/pages/NewOccurrencePage.tsx`
- `src/pages/NotFoundPage.tsx`
- `src/pages/TrackingPage.tsx`
- `src/pages/admin/AdminDashboardPage.tsx`
- `src/pages/admin/AdminLoginPage.tsx`
- `src/pages/admin/AdminOccurrenceDetailPage.tsx`
- `src/pages/admin/AdminOccurrencesPage.tsx`
- `src/pages/admin/AdminSettingsPage.tsx`
- `src/routes/AppRouter.tsx`
- `src/routes/DemoAdminRoute.tsx`
- `src/services/adminService.ts`
- `src/services/apiClient.ts`
- `src/services/configService.ts`
- `src/services/occurrenceService.ts`
- `src/utils/date.ts`
- `src/utils/errors.ts`
- `src/utils/image.ts`
- `src/utils/protocol.ts`
- `src/utils/publicOccurrence.ts`
- `src/validators/occurrence.ts`
- `src/validators/responses.ts`
- `src/validators/tracking.ts`
- `src/vite-env.d.ts`
- `tests/apiClient.test.ts`
- `tests/brandImage.test.tsx`
- `tests/imageSanitizer.test.ts`
- `tests/occurrenceService.test.ts`
- `tests/protocol.test.ts`
- `tests/publicOccurrence.test.ts`
- `tests/routingAndBranding.test.tsx`
- `tests/setup.ts`
- `tests/staticPolicy.test.ts`
- `tests/validation.test.ts`
- `vitest.config.ts`

## 6. Arquivos removidos

- `assets/.aistudio/.gitignore`
- `bun.lock`
- `server.ts`
- `src/components/admin/AdminDashboard.tsx`
- `src/components/admin/AdminDetailModal.tsx`
- `src/components/admin/AdminLogin.tsx`
- `src/components/admin/AdminSettings.tsx`
- `src/components/admin/AdminTable.tsx`
- `src/components/common/Badge.tsx`
- `src/components/common/CameraCaptureModal.tsx`
- `src/components/common/QRCodeDisplay.tsx`
- `src/components/public/NewOccurrenceForm.tsx`
- `src/components/public/PublicHome.tsx`
- `src/components/public/PublicTracking.tsx`
- `src/data/mockData.ts`
- `src/services/api.ts`
- `src/types.ts`

## 7. Dependências

### Adicionadas

- `@eslint/js`
- `@testing-library/jest-dom`
- `@testing-library/react`
- `@testing-library/user-event`
- `@types/react`
- `@types/react-dom`
- `eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `globals`
- `jsdom`
- `react-router-dom`
- `rimraf`
- `typescript-eslint`
- `vitest`
- `zod`

### Removidas

- `@google/genai`
- `autoprefixer`
- `motion`
- `recharts`

### Mantidas e atualizadas/reclassificadas

- `@tailwindcss/vite`
- `@types/express`
- `@types/node`
- `@vitejs/plugin-react`
- `dotenv`
- `esbuild`
- `express`
- `lucide-react`
- `react`
- `react-dom`
- `tailwindcss`
- `tsx`
- `typescript`
- `vite`

## 8. Testes e validações

Todos os comandos de validação foram executados diretamente e certificados no ambiente com total sucesso.

**Resultados confirmados:**
- **9 arquivos de teste** executados e **23 testes aprovados** sem qualquer falha (`vitest run`);
- **Zero erros de TypeScript** (`npm run typecheck` / `tsc --noEmit`);
- **Zero erros e zero avisos do ESLint** (`npm run lint` / `eslint . --max-warnings=0`);
- **Build de cliente e servidor concluído com sucesso** (`npm run build` com Vite para cliente e esbuild para o servidor em `dist/server/index.js`);
- **Zero vulnerabilidades de produção** (`npm audit --omit=dev` retornando 0 vulnerabilidades).

## 9. Limitações e observações técnicas

1. O projeto é fornecido sem `node_modules` e `dist` para a entrega, conforme práticas recomendadas de versionamento.
2. Persistência em banco de dados relacional ou Firestore, autenticação de produção e envio de e-mail permanecem intencionalmente fora do escopo desta versão.
3. A sequência do protocolo é gerenciada localmente pelo repositório em memória do processo atual.
4. A acessibilidade recebeu correções e melhorias estruturais, porém não foi submetida a uma auditoria formal WCAG completa.

## 10. Instalação e execução

```bash
npm ci
cp .env.example .env
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env`. Para validação integral e build de produção:

```bash
npm run validate
npm run start
```

O `npm run start` executa a versão compilada em `dist/server/index.js`.

## 11. Pendências propostas para a versão 0.3.0

- configurar projeto Firebase por ambientes;
- integrar Firebase Authentication anônima para o fluxo público;
- integrar Google Sign-In e papéis administrativos;
- substituir o repositório em memória por Firestore com transação de protocolo;
- armazenar fotografias saneadas no Cloud Storage;
- implementar regras de segurança e App Check;
- definir catálogo institucional de locais e categorias;
- implementar notificações idempotentes por função de servidor e Trigger Email;
- criar suíte de testes das regras de segurança e estratégia de implantação.
