# Relatório de Inspeção do Pacote — Versão 0.7.7

## Critérios de empacotamento

O pacote final deve possuir:

- raiz única `olhos-do-campus-0.7.7/`;
- ausência de `node_modules/`, `.git/`, `dist/`, `.env` e ZIP aninhado;
- presença de `.env.example` apenas como modelo sem credenciais;
- documentação 0.7.7 e histórico anterior preservado;
- sidecar SHA-256 externo gerado após o ZIP.

O SHA-256 definitivo não é gravado dentro deste arquivo para evitar circularidade. Ele deve constar no sidecar externo `olhos-do-campus-0.7.7.zip.sha256` e na devolutiva da versão.

## Componentes críticos esperados

- `server/providers/ews/ntlmClient.ts`
- `tests/ntlmHttpFraming077.test.ts`
- `tests/ewsIntegration.optIn.test.ts`
- `RELATORIO_IMPLEMENTACAO_0.7.7.md`
- `TESTES_0.7.7.md`
- `docs/IMPLANTACAO_0.7.7.md`
- `docs/EWS_CONFIGURACAO_0.7.7.md`

## Estado de validação antes do empacotamento final

A árvore 0.7.7 foi validada em Node `v22.22.2` com typecheck, lint, suíte principal, Maintenance Worker, build local, `GetFolder` EWS real somente leitura, teste EWS real opt-in e confirmação humana de recebimento. Os detalhes constam em `TESTES_0.7.7.md`.

Cloud Build, digest imutável e revisão Cloud Run `ews077` permanecem para o gate de release subsequente.

## Métricas do empacotamento final

Na inspeção final antes da geração do sidecar foram confirmados:

- raiz única `olhos-do-campus-0.7.7/`;
- 453 entradas no pacote;
- `unzip -t`: sem erros;
- `node_modules/`: ausente;
- `.git/`: ausente;
- `dist/`: ausente;
- `.env`: ausente;
- ZIP aninhado: ausente;
- `.env.example`: preservado como modelo sem credenciais.

O digest SHA-256 definitivo é mantido exclusivamente no sidecar externo para não introduzir circularidade no artefato.
