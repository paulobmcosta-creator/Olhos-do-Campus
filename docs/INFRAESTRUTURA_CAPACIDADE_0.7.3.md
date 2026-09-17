# Infraestrutura e capacidade — métricas de notificações 0.7.3

A 0.7.3 não altera R2, Artifact Registry cleanup, Cloudflare Pages, Cloud Run, região ou referências operacionais. A única mudança no painel de capacidade é a semântica de notificações.

## Resend

As referências diária e mensal continuam sendo referências operacionais, não faturamento. O numerador passa a representar **tentativas aceitas pelo provider**. Cada DeliveryAttempt com `providerAcceptedAt` conta uma unidade; a confirmação posterior de entrega não incrementa novamente.

O painel distingue:

- tentativas iniciadas;
- tentativas aceitas pelo provedor;
- entregas confirmadas;
- falhas de tentativa;
- bounces;
- complaints;
- tentativas incertas;
- retries;
- pendências lógicas;
- webhooks não correlacionados.

Aceites legados 0.7.2 sem subcoleção de attempts permanecem contabilizados como mínimo histórico durante a compatibilidade lazy. A contagem detalhada de tentativas iniciadas é integral a partir do modelo 0.7.3; não se inventa histórico de tentativas que a 0.7.2 não preservou individualmente.

## Artifact Registry

A terminologia corrigida na 0.7.2 permanece inalterada: o indicador é uma estimativa/soma lógica aproximada das imagens observadas e não corresponde necessariamente ao armazenamento faturado, pois camadas podem ser compartilhadas.
