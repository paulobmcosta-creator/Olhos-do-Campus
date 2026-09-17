# Infraestrutura e capacidade — correção 0.7.1

## Inventário R2 parcial

A captura R2 continua paginada em lotes e limitada a 50.000 objetos por execução para impedir uma requisição Cloud Run de duração indefinida. O limite é intencionalmente operacional, não uma estimativa do total.

Quando ainda existe cursor depois do limite:

```text
inventoryComplete = false
bytes = limite inferior observado
objectCount = quantidade observada nesta execução
```

A interface apresenta “Inventário parcial” e “Pelo menos X bytes observados”.

### Regras de interpretação

Se o inventário é incompleto:

- percentual integral: indisponível;
- projeção integral: indisponível;
- gráfico/crescimento R2: snapshots incompletos são excluídos desses cálculos;
- se `observedBytes < referência`: nível `Inventário incompleto`, nunca `Normal` por percentual parcial;
- se `observedBytes >= referência`: pode sinalizar `Crítico`, pois o limite inferior já alcançou a referência.

Se o inventário é integral, os thresholds Normal/Atenção/Alerta/Crítico continuam funcionando como na 0.7.0.

Os testes cobrem inventários abaixo e acima de 50.000 objetos, além de limites inferiores abaixo e acima da referência.
