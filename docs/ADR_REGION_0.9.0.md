# ADR — Decisão de Região — Olhos do Campus 0.9.0

## Status

`ACCEPTED` — Gate G.6C — 2026-09-14

## Dados Objetivos

```
CURRENT_REGION=us-west1
CURRENT_FIRESTORE_REGION=TO_BE_CONFIRMED
CURRENT_R2_CONTEXT=Cloudflare_R2_Global_Edge_No_Region_Lock
USER_BASE=Brasil
```

### Notas de levantamento

| Serviço                  | Região / Localização                                          |
|--------------------------|---------------------------------------------------------------|
| Cloud Run (API)          | `us-west1` (Oregon)                                          |
| Firestore (Produção)     | `TO_BE_CONFIRMED` — banco Enterprise `ai-studio-olhosdocampus-...` |
| Cloudflare R2 (Fotos)    | Edge global Cloudflare — sem região fixa configurada         |
| Firebase Auth            | Projeto GCP `gen-lang-client-0120954905` — co-localizado     |

### Fonte

- `cloudbuild.yaml`: `_REGION: us-west1`
- `docs/FIRESTORE_ENTERPRISE_0.7.5.md`: banco Enterprise, configuração de projeto
- `docs/CLOUDFLARE_R2_0.7.0.md`: bucket R2 privado, sem domínio público, credenciais via Cloud Run

---

## Análise Qualitativa

### Latência

A região `us-west1` (Oregon, EUA) implica maior distância geográfica em relação ao Brasil,
o que tende a aumentar a latência de tráfego intercontinental para os usuários finais.
Para o ciclo 0.9.0, esta condição é subótima mas funcionalmente estável para os fluxos
institucionais atendidos.

A migração arquitetural para `southamerica-east1` (São Paulo) aproximará o processamento
da base de usuários, reduzindo a latência de rede e a variabilidade de tráfego intercontinental.

### Egress

Transferências de dados entre `us-west1` e usuários brasileiros incorrem em custos de
tráfego de rede cross-continental. Com volume moderado na fase atual, o impacto orçamentário
é baixo, mas tende a crescer proporcionalmente ao tráfego de fotografias e dados.

O Cloudflare R2 não cobra taxa de transferência (egress) para clientes, aplicando-se o
custo GCP somente às requisições trafegadas pelo serviço Cloud Run.

### Imutabilidade de Localização do Firestore

A localização de uma instância Cloud Firestore já provisionada é imutável e **não pode ser
alterada in-place**.

Portanto, uma futura regionalização do banco de dados não consiste em uma simples reconfiguração
de parâmetro do banco existente, exigindo conceitualmente o seguinte procedimento:
1. **Provisionar destino compatível**: criação de novo banco nomeado ou projeto Firebase na região `southamerica-east1`.
2. **Backup / Export / Cópia controlada**: extração consistente dos dados via `gcloud firestore export`.
3. **Validação**: restauração em ambiente de homologação e conferência de integridade dos dados, índices e regras.
4. **Reapontamento da aplicação**: atualização de variáveis de ambiente, credenciais e endpoints no Cloud Run.
5. **Cutover**: virada definitiva de tráfego durante janela de manutenção autorizada.
6. **Rollback planejado**: procedimento documentado para retorno ao banco de origem caso ocorram anomalias.

### Dependências Existentes

O banco Firestore está provisionado como banco nomeado Enterprise.
A cadeia de dependências associada à migração para `southamerica-east1` envolve:
- Provisionamento de novo destino compatível em `southamerica-east1`
- Exportação completa e importação controlada do Firestore
- Atualização das credenciais de serviço e variáveis de ambiente no Cloud Run
- Revalidação e construção de índices Firestore Enterprise
- Atualização das regras de segurança e dados de referência

Esta cadeia de dependências é substancial e constitui risco operacional elevado para o ciclo 0.9.0.

### Complexidade de Migração

Passos necessários para migrar para `southamerica-east1`:

1. Provisionar novo projeto Firebase ou banco Firestore nomeado em `southamerica-east1`
2. Exportar coleções: `operationalTeams`, `adminUsers`, `occurrences`, `notificationOutbox`, etc.
3. Importar dados no projeto de destino e validar integridade e índices
4. Atualizar `cloudbuild.yaml` (`_REGION: southamerica-east1`)
5. Redeployar Cloud Run na nova região com todas as variáveis de ambiente
6. Atualizar DNS / Cloudflare para apontar para o novo endpoint
7. Janela de manutenção com rollback preparado
8. Período de observação pós-migração

### Risco Operacional

A migração de região em produção é uma operação de alto risco:
- Exige janela de manutenção e parada temporária de escrita
- Risco de inconsistência em escritas concorrentes caso o cutover não seja atômico
- Índices Firestore Enterprise precisam ser reconstruídos e aguardar estado `READY`
- Necessidade de plano de rollback testado mantendo o ambiente antigo acessível durante observação

### Residência de Dados

Não há requisito legal identificado que exija residência de dados no território
brasileiro para este sistema institucional. A **LGPD** (Lei nº 13.709/2018) exige tratamento
adequado e seguro dos dados pessoais, mas não proíbe transferências internacionais
para países com nível de proteção adequado via mecanismos contratuais estabelecidos.

Dados pessoais processados limitam-se a e-mails de servidores e atendentes, não
classificados como dados sensíveis (LGPD, Art. 5º, II).

---

## Decisão

```
REGION_DECISION=MIGRATION_RECOMMENDED_POST_1_0
```

**Justificativa:** a latência decorrente de `us-west1` é subótima para usuários
brasileiros, mas a migração de região envolve alto risco operacional (downtime,
reprovisionamento de Firestore imutável, export/import e recriação de índices) e está
fora do escopo estrito do ciclo 0.9.0. A decisão de migração para `southamerica-east1` (São Paulo)
é recomendada como parte do roadmap pós-1.0, com planejamento de janela de manutenção dedicada
e aprovação institucional.

**Nenhuma mudança cloud ocorre neste gate.**

---

## Alternativas Consideradas

| Alternativa                               | Descartada por                                          |
|-------------------------------------------|---------------------------------------------------------|
| Migrar agora para `southamerica-east1`    | Alto risco operacional, fora do escopo 0.9.0            |
| Manter `us-west1` permanentemente         | Subótimo — recomenda-se revisão pós-1.0                 |
| Multi-região (`us-west1` + `southamerica-east1`) | Custo elevado, complexidade operacional desproporcional |

---

## Próximas Ações (Pós-1.0)

- [ ] Planejar janela de manutenção dedicada para migração para `southamerica-east1`
- [ ] Criar checklist de migração Firestore Enterprise (provisionamento destino → export → import → validação de índices)
- [ ] Avaliar uso de Cloud Run Traffic Split durante transição
- [ ] Documentar plano de rollback de região com RTO definido

## Referência

- G09B-F013 — ADR de Região
- `docs/FIRESTORE_ENTERPRISE_0.7.5.md`
- `docs/CLOUDFLARE_R2_0.7.0.md`
- `cloudbuild.yaml`