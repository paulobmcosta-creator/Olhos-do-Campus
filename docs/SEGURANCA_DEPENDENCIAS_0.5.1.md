# Segurança de dependências — versão 0.5.1

## 1. Baseline

O `npm audit` executado sobre a 0.5.0 reportou:

```text
11 vulnerabilities (9 moderate, 2 high)
```

O `npm audit --omit=dev` reportou:

```text
7 vulnerabilities (6 moderate, 1 high)
```

Os grupos identificados foram `sharp`, `uuid`, `nanoid` e `@opentelemetry/core`/cadeia `firebase-tools` + Pub/Sub.

## 2. Remediações aplicadas

| Dependência | Situação de entrada | Situação fixada na 0.5.1 | Estratégia |
|---|---:|---:|---|
| `sharp` | 0.34.1 | 0.35.3 | atualização direta |
| `nanoid` | <3.3.18 | 3.3.18 | lockfile atualizado |
| `uuid` da cadeia `gaxios`/`teeny-request` | 9.0.1 | 11.1.1 | override restrito aos pais vulneráveis |
| `@opentelemetry/core` | <2.8.0 | 2.8.0 | override de raiz compatível com a estratégia atual do Firebase CLI |

Não foi usado `npm audit fix --force` e não foi feito downgrade do Firebase Admin ou do Firebase CLI.

## 3. Defesa adicional no processamento de imagens

Além da atualização do `sharp`, o servidor passou a executar preflight de assinatura binária antes da decodificação:

- JPEG: marcador inicial `FF D8 FF`;
- PNG: assinatura PNG completa de 8 bytes;
- WebP: `RIFF` + `WEBP` nos offsets esperados.

Somente esses três formatos seguem para o pipeline autoritativo. Também são bloqueados no Sharp os loaders para GIF nativo, TIFF e VIPS.

Essa camada não substitui a validação do `sharp`; ela reduz a superfície de decodificação de arquivos que já são incompatíveis com a política do sistema.

## 4. Lockfile

O `package-lock.json` da entrega contém as versões corrigidas e preserva `uuid 14.0.1` na cadeia independente que já estava acima da versão vulnerável. Não foi aplicado override global de `uuid`, evitando downgrade indevido dessa dependência.

## 5. Confirmação obrigatória

A ausência efetiva de advisories deve ser confirmada em ambiente com acesso ao npm:

```bash
npm ci
npm audit
npm audit --omit=dev
```

Resultado esperado:

```text
found 0 vulnerabilities
```

A geração desta entrega não afirma o resultado do audit pós-correção, porque o ambiente local não teve acesso ao registry npm.
