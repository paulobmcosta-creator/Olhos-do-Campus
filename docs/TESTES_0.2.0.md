# Relatório de testes — versão 0.2.0

## Ambiente

- Data: 5 de agosto de 2026.
- Node.js: `v22.23.1`.
- npm: `10.9.2`.
- Diretório testado: raiz do projeto da versão 0.2.0.
- Registro npm disponível no ambiente: gateway funcional da plataforma.

## Comandos obrigatórios e resultados de validação

| Comando | Código de saída | Resultado | Mensagem determinante / Resumo | Consequência |
|---|---:|---|---|---|
| `npm ci` | 0 | Sucesso | `audited 471 packages` | Instalação limpa e reprodutível concluída a partir de `package-lock.json`. |
| `npm run typecheck` | 0 | Sucesso | `tsc --noEmit` sem erros | Zero erros de tipo em TypeScript. |
| `npm run lint` | 0 | Sucesso | `eslint . --max-warnings=0` sem avisos nem erros | Zero erros e zero avisos do ESLint. |
| `npm run test` | 0 | Sucesso | 9 arquivos de teste, 23 testes aprovados | 100% dos testes unitários e de integração aprovados. |
| `npm run build` | 0 | Sucesso | Build de cliente e servidor concluído (`dist/client` e `dist/server/index.js`) | Artefatos de produção do cliente e servidor gerados com sucesso. |
| `npm audit --omit=dev` | 0 | Sucesso | `found 0 vulnerabilities` | Zero vulnerabilidades de segurança em dependências de produção. |
| `npm run validate` | 0 | Sucesso | Execução encadeada de `typecheck`, `lint`, `test` e `build` | Validação completa do projeto concluída com êxito. |
| `npm run clean` | 0 | Sucesso | Artefatos de build e temporários removidos | Limpeza de diretórios de compilação realizada com sucesso. |

## Resumo da suíte de testes (Vitest)

- **Arquivos de teste:** 9 arquivos
- **Testes executados:** 23 testes
- **Testes aprovados:** 23 testes (100%)
- **Testes com falha:** 0

### Cobertura da suíte de testes

Os 9 arquivos de teste cobrem:
1. `tests/protocol.test.ts`: Formatação do protocolo (`INF-AAAA-NNNNNN`), garantia de não duplicação do ano e normalização de prefixo.
2. `tests/publicOccurrence.test.ts`: Saneamento e filtragem de ocorrências públicas, garantindo a não exposição de chaves de acompanhamento e observações internas.
3. `tests/occurrenceService.test.ts`: Regras de negócio e ciclo de vida do serviço de ocorrências em memória.
4. `tests/imageSanitizer.test.ts`: Saneamento de fotografias anexadas e remoção de metadados EXIF/JPEG.
5. `tests/validation.test.ts`: Schemas Zod de validação para criação de ocorrências e consulta de acompanhamento.
6. `tests/apiClient.test.ts`: Cliente de API com tratamento adequado de erros HTTP (400, 401, 403, 404, 500) e falhas de rede.
7. `tests/routingAndBranding.test.tsx`: Navegação, roteamento de páginas, exibição da marca e tratamento de rota 404.
8. `tests/brandImage.test.tsx`: Renderização das marcas institucionais e conformidade dos atributos de acessibilidade (`alt`).
9. `tests/staticPolicy.test.ts`: Políticas estáticas de código, verificação de terminologia e ausência de expressões não permitidas.

## Certificação de Qualidade

A esteira de integração e validação automatizada foi executada com sucesso total:
- **9 arquivos de teste** executados e **23 testes aprovados**;
- **Zero erros de TypeScript** (`npm run typecheck`);
- **Zero erros e zero avisos do ESLint** (`npm run lint`);
- **Build de cliente e servidor concluído** (`npm run build`);
- **Zero vulnerabilidades de produção** (`npm audit --omit=dev`).
