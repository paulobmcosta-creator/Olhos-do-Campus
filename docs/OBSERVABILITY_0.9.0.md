# Observabilidade — Logging Estruturado (0.9.0)

> **Recurso:** G09B-F012 — Logging Estruturado para Cloud Run / Cloud Logging  
> **Gate:** 0.9-G.6  
> **Vigência:** 0.9.0+

---

## 1. Estratégia de Logging

O servidor emite **JSON puro em `stdout`**, uma linha por entrada. O Cloud Run captura automaticamente esse fluxo e o encaminha ao **Cloud Logging**, onde o campo `severity` é reconhecido nativamente pelo agente de logging do GCP.

Não há biblioteca de terceiros (winston, pino, etc.). A abstração é deliberadamente mínima (`server/utils/logger.ts`) para reduzir superfície de ataque, dependências e tempo de inicialização a frio (Cold Start).

```
Cloud Run container (stdout)
  └─► Cloud Logging (agente GCP)
        └─► Log Explorer / Cloud Monitoring / Alertas
```

---

## 2. Campos Disponíveis

| Campo           | Tipo     | Obrigatório | Descrição                                                    |
|-----------------|----------|-------------|--------------------------------------------------------------|
| `severity`      | string   | ✅           | Nível do log: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `event`         | string   | ✅           | Identificador semântico do evento (e.g. `http.request.received`) |
| `requestId`     | string   | —           | Valor do header `X-Request-Id` / `correlationId`             |
| `route`         | string   | —           | Caminho da rota Express (`request.path`)                     |
| `method`        | string   | —           | Método HTTP (`GET`, `POST`, etc.)                            |
| `status`        | number   | —           | Código de status HTTP da resposta                            |
| `durationMs`    | number   | —           | Duração do request em milissegundos                          |
| `operation`     | string   | —           | Operação de negócio (e.g. `occurrence.create`)               |
| `errorCode`     | string   | —           | Código de erro interno (e.g. `INTERNAL_ERROR`)               |
| `releaseVersion`| string   | —           | Versão da aplicação (e.g. `0.9.0`)                           |
| `message`       | string   | —           | Mensagem humana adicional (sem dados sensíveis)              |

### Eventos padrão registrados

| Evento                             | Severity  | Emitido em                                |
|------------------------------------|-----------|-------------------------------------------|
| `http.request.received`            | `INFO`    | Middleware `assignCorrelationId`          |
| `http.error.unhandled`             | `ERROR`   | Middleware `errorHandler` (500)           |
| `http.error.firebase_unavailable`  | `ERROR`   | Middleware `errorHandler` (503)           |

---

## 3. Campos PROIBIDOS

> **Regra institucional:** Nenhum campo abaixo pode aparecer em entradas de log.  
> Razão: proteção de dados pessoais, conformidade com LGPD e política de segurança do Ifes.

| Campo           | Razão de proibição                                                  |
|-----------------|---------------------------------------------------------------------|
| `ip`            | Dado pessoal; LGPD proíbe registro de IP sem base legal explícita  |
| `trackingKey`   | Chave de acompanhamento público — pode ser usado como vetor de rastreio pessoal |
| `Authorization` | Token de autenticação — vazamento compromete sessões               |
| `token`         | Qualquer token de autenticação/autorização                         |
| `email`         | Dado pessoal direto                                                 |
| `description`   | Campo livre da ocorrência — pode conter PII do relator              |
| `note`          | Nota interna — pode conter dados sensíveis                          |
| `internalNote`  | Nota interna administrativa — idem                                  |

A interface TypeScript `LogEntry` não inclui esses campos, tornando a proibição verificável estaticamente.

---

## 4. Correlação por `requestId` / `X-Request-Id`

Cada request recebe um `correlationId` único gerado no middleware `assignCorrelationId`:

1. Se o client enviar `X-Request-Id` com valor seguro (`/^[A-Za-z0-9._-]{1,100}$/`), esse valor é reutilizado.
2. Caso contrário, um UUID v4 é gerado via `randomUUID()` do Node.js.
3. O valor é propagado de volta ao cliente via header `X-Request-Id` na resposta.
4. Todos os logs do request incluem `requestId` com esse valor.

Isso permite rastrear um request de ponta a ponta nos logs do Cloud Logging usando filtro por `requestId`.

---

## 5. Consultando Logs no Cloud Logging

### Filtrar todos os logs de um request específico

```
resource.type="cloud_run_revision"
resource.labels.service_name="olhos-do-campus"
jsonPayload.requestId="<UUID-DO-REQUEST>"
```

### Ver apenas erros HTTP

```
resource.type="cloud_run_revision"
resource.labels.service_name="olhos-do-campus"
jsonPayload.severity=("ERROR" OR "CRITICAL")
```

### Ver erros de Firebase indisponível

```
resource.type="cloud_run_revision"
jsonPayload.event="http.error.firebase_unavailable"
```

### Ver todos os requests recebidos nas últimas 1h

```
resource.type="cloud_run_revision"
jsonPayload.event="http.request.received"
timestamp>="2026-09-14T00:00:00Z"
```

### Ver erros internos (500)

```
resource.type="cloud_run_revision"
jsonPayload.event="http.error.unhandled"
jsonPayload.status=500
```

---

## 6. Alertas Sugeridos (sem criação de recursos cloud)

Os alertas abaixo são recomendados para configuração futura no Cloud Monitoring. **Não foram criados neste gate** — apenas documentados para referência da equipe de infra.

| Alerta                         | Condição                                            | Severidade sugerida |
|--------------------------------|-----------------------------------------------------|---------------------|
| Alta taxa de erro 500          | `event="http.error.unhandled"` > 5 em 5 min        | CRITICAL            |
| Firebase indisponível          | `event="http.error.firebase_unavailable"` > 3 em 2 min | ERROR            |
| Ausência de tráfego            | `event="http.request.received"` = 0 em 10 min (horário comercial) | WARNING |
| Erros de validação em massa    | `status=400` > 50 em 5 min                         | WARNING             |

---

## 7. Referências

- [Cloud Logging — Structured Logging](https://cloud.google.com/logging/docs/structured-logging)
- [Cloud Run — Logging](https://cloud.google.com/run/docs/logging)
- [`server/utils/logger.ts`](../server/utils/logger.ts) — implementação
- [`server/middleware/correlationId.ts`](../server/middleware/correlationId.ts) — geração do requestId
- [`server/middleware/errorHandler.ts`](../server/middleware/errorHandler.ts) — uso em erros HTTP
