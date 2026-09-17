// server/utils/logger.ts
// G09B-F012 — Logging estruturado para Cloud Run / Cloud Logging
// G09G6R-F003 — Sanitização recursiva contra vazamento de dados sensíveis

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  severity: LogSeverity;
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  operation?: string;
  errorCode?: string;
  releaseVersion?: string;
  message?: string;
  [key: string]: unknown;
}

// CAMPOS PROIBIDOS: authorization, token, trackingKey, email, description, internalNote, note, ip, cookie, set-cookie
// Regra institucional: não armazenar dados sensíveis nos logs
export const SENSITIVE_KEY_REGEX =
  /^(authorization|token|trackingkey|email|description|internalnote|note|ip|cookie|set-cookie)$/i;

const MAX_REDACTION_DEPTH = 10;

/**
 * Sanitiza recursivamente valores para log, redigindo chaves sensíveis
 * em objetos simples, aninhados, arrays e instâncias de Error, prevenindo
 * loops por referência circular e estouro de pilha.
 */
export function redactSensitive(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (depth > MAX_REDACTION_DEPTH) {
    return '[MAX_DEPTH]';
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen, depth + 1));
  }

  if (value instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        errorObj[k] = '[REDACTED]';
      } else {
        errorObj[k] = redactSensitive(v, seen, depth + 1);
      }
    }
    return errorObj;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactSensitive(v, seen, depth + 1);
    }
  }
  return out;
}

function emit(entry: LogEntry): void {
  // Cloud Run/Cloud Logging consome JSON em stdout com campo "severity"
  const sanitized = redactSensitive(entry) as Record<string, unknown>;
  process.stdout.write(JSON.stringify(sanitized) + '\n');
}

export const logger = {
  debug: (event: string, extra?: Partial<Omit<LogEntry, 'severity' | 'event'>> | Record<string, unknown>) =>
    emit({ severity: 'DEBUG', event, ...extra }),
  info: (event: string, extra?: Partial<Omit<LogEntry, 'severity' | 'event'>> | Record<string, unknown>) =>
    emit({ severity: 'INFO', event, ...extra }),
  warn: (event: string, extra?: Partial<Omit<LogEntry, 'severity' | 'event'>> | Record<string, unknown>) =>
    emit({ severity: 'WARNING', event, ...extra }),
  error: (event: string, extra?: Partial<Omit<LogEntry, 'severity' | 'event'>> | Record<string, unknown>) =>
    emit({ severity: 'ERROR', event, ...extra }),
  critical: (event: string, extra?: Partial<Omit<LogEntry, 'severity' | 'event'>> | Record<string, unknown>) =>
    emit({ severity: 'CRITICAL', event, ...extra }),
};
