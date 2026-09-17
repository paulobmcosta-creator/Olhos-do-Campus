# Política de Scale-Out — Olhos do Campus 0.9.0

## Invariante de Segurança

```
MAX_SCALE_1_SECURITY_INVARIANT=YES
SCALE_OUT_ALLOWED=NO
SCALE_OUT_PREREQUISITE=DISTRIBUTED_OR_EDGE_RATE_LIMIT
```

## Razão

O rate limiting atual usa `RATE_LIMIT_SCOPE=INSTANCE_LOCAL` (G.1 homologado).
Escalonar para `max-instances > 1` sem rate limiting distribuído/edge constituiria
regressão de segurança: cada instância teria quota separada, multiplicando o
limite efetivo por N instâncias.

### Exemplo concreto

| Configuração         | Limite efetivo por operação (global) |
|----------------------|--------------------------------------|
| max-instances=1      | 120 req/min (conforme homologado)    |
| max-instances=3 (*)  | 360 req/min por operação — **regressão** |

(*) Sem rate limiting distribuído, cada instância aplica seu próprio bucket independente.

## Topologia atual (0.9.0)

```
CURRENT_PRODUCTION_MAXSCALE=1
RATE_LIMIT_SCOPE=INSTANCE_LOCAL
RATE_LIMIT_LAYERS=UID_BUCKET + GLOBAL_OPERATION_BUCKET
SAFE_FOR_CURRENT_TOPOLOGY=YES
```

## Pré-requisito para Scale-Out

Antes de permitir `max-instances > 1`, é **obrigatório**:

1. Implementar rate limiting distribuído (Redis/Memorystore) **OU** rate limiting na borda (Cloud Armor)
2. Obter aprovação de segurança independente documentada
3. Atualizar o guard `checkScaleConfig.mjs` para reconhecer a nova estratégia
4. Re-homologar o comportamento de rate limiting em topologia multi-instância

## Como verificar

```bash
npm run check:scale
```

Saída esperada (topologia segura):

```
MAX_SCALE_1_SECURITY_INVARIANT=YES
SCALE_OUT_ALLOWED=NO
SCALE_OUT_PREREQUISITE=DISTRIBUTED_OR_EDGE_RATE_LIMIT
STATUS: PASS (max-instances=1 — topologia segura para INSTANCE_LOCAL)
```

## Referência

- **Gate**: G09B-F003 / G09G6R-F002 — `MITIGATED_AWAITING_INDEPENDENT_REVIEW`
- **Gate J** decidirá capacidade para go-live
- Consulte: [`server/middleware/rateLimit.ts`](../server/middleware/rateLimit.ts) — seção DECISÃO ARQUITETURAL & MULTI-INSTANCE
- Consulte: [`scripts/checkScaleConfig.mjs`](../scripts/checkScaleConfig.mjs) — guard automatizado
- Consulte: [`scripts/deployCloudRun.sh`](../scripts/deployCloudRun.sh) — wrapper canônico de deploy com `--max-instances=1` explícito
