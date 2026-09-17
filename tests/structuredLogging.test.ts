// tests/structuredLogging.test.ts
// G09B-F012 — Testes de logging estruturado
// G09G6R-F003 — Sanitização recursiva contra vazamento de dados sensíveis

import { describe, expect, it } from 'vitest';
import { logger, redactSensitive } from '../server/utils/logger';
import type { LogEntry } from '../server/utils/logger';

// Captura stdout para inspecionar saída JSON
function captureNextEntry(fn: () => void): LogEntry {
  let captured = '';
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    captured += chunk.toString();
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  const line = captured.trim().split('\n')[0] ?? '';
  return JSON.parse(line) as LogEntry;
}

// Campos que NUNCA devem aparecer sem redação nos logs (regra institucional)
const FORBIDDEN_FIELDS = [
  'Authorization',
  'trackingKey',
  'email',
  'description',
  'ip',
  'token',
  'note',
  'internalNote',
];

describe('G09B-F012 — Logging estruturado', () => {
  it('emite JSON válido para logger.info', () => {
    const entry = captureNextEntry(() => logger.info('test.event'));
    expect(() => JSON.stringify(entry)).not.toThrow();
    expect(entry.severity).toBe('INFO');
    expect(entry.event).toBe('test.event');
  });

  it('emite JSON válido para logger.error', () => {
    const entry = captureNextEntry(() => logger.error('test.error.event'));
    expect(entry.severity).toBe('ERROR');
    expect(entry.event).toBe('test.error.event');
  });

  it('mapeia severity corretamente para cada nível', () => {
    const cases: Array<[() => void, string]> = [
      [() => logger.debug('ev'), 'DEBUG'],
      [() => logger.info('ev'), 'INFO'],
      [() => logger.warn('ev'), 'WARNING'],
      [() => logger.error('ev'), 'ERROR'],
      [() => logger.critical('ev'), 'CRITICAL'],
    ];
    for (const [fn, expectedSeverity] of cases) {
      const entry = captureNextEntry(fn);
      expect(entry.severity).toBe(expectedSeverity);
    }
  });

  it('inclui requestId quando fornecido', () => {
    const entry = captureNextEntry(() =>
      logger.info('http.request.received', { requestId: 'req-abc-123' }),
    );
    expect(entry.requestId).toBe('req-abc-123');
  });

  it('inclui campos extras opcionais corretamente', () => {
    const entry = captureNextEntry(() =>
      logger.error('http.error.unhandled', {
        requestId: 'req-xyz',
        errorCode: 'INTERNAL_ERROR',
        status: 500,
      }),
    );
    expect(entry.requestId).toBe('req-xyz');
    expect(entry.errorCode).toBe('INTERNAL_ERROR');
    expect(entry.status).toBe(500);
  });

  it('não contém campos proibidos quando nenhum extra é passado', () => {
    const entry = captureNextEntry(() => logger.info('simple.event')) as unknown as Record<string, unknown>;
    for (const field of FORBIDDEN_FIELDS) {
      expect(entry).not.toHaveProperty(field);
    }
  });

  it('não contém campos proibidos mesmo quando extras são passados', () => {
    const entry = captureNextEntry(() =>
      logger.error('http.error.firebase_unavailable', {
        requestId: 'req-safe',
        errorCode: 'FIREBASE_UNAVAILABLE',
        status: 503,
      }),
    ) as unknown as Record<string, unknown>;
    for (const field of FORBIDDEN_FIELDS) {
      expect(entry).not.toHaveProperty(field);
    }
  });

  it('sempre contém severity e event', () => {
    const entry = captureNextEntry(() => logger.warn('infra.check', { operation: 'startup' }));
    expect(entry).toHaveProperty('severity');
    expect(entry).toHaveProperty('event');
    expect(typeof entry.severity).toBe('string');
    expect(typeof entry.event).toBe('string');
  });

  it('severity WARNING corresponde a logger.warn', () => {
    const entry = captureNextEntry(() => logger.warn('warn.event'));
    expect(entry.severity).toBe('WARNING');
  });

  it('severity CRITICAL corresponde a logger.critical', () => {
    const entry = captureNextEntry(() => logger.critical('critical.event'));
    expect(entry.severity).toBe('CRITICAL');
  });
});

describe('G09G6R-F003 — Sanitização recursiva e proteção contra vazamentos', () => {
  it('redige todas as chaves sensíveis em estruturas planas e aninhadas', () => {
    const raw = {
      safeField: 'ok',
      authorization: 'Bearer secret-token-123',
      token: 'jwt-xyz-890',
      trackingKey: 'TK-2026-0001',
      email: 'usuario@ifes.edu.br',
      description: 'Descrição detalhada com relato',
      internalNote: 'Nota interna confidencial',
      note: 'Observação confidencial',
      ip: '192.168.1.100',
      cookie: 'session_id=abcdef',
      'set-cookie': 'session_id=abcdef; Secure; HttpOnly',
      nested: {
        deeperSafe: 42,
        email: 'nested@ifes.edu.br',
        authorization: 'Basic dXNlcjpwYXNz',
      },
    };

    const redacted = redactSensitive(raw) as typeof raw;
    expect(redacted.safeField).toBe('ok');
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.trackingKey).toBe('[REDACTED]');
    expect(redacted.email).toBe('[REDACTED]');
    expect(redacted.description).toBe('[REDACTED]');
    expect(redacted.internalNote).toBe('[REDACTED]');
    expect(redacted.note).toBe('[REDACTED]');
    expect(redacted.ip).toBe('[REDACTED]');
    expect(redacted.cookie).toBe('[REDACTED]');
    expect(redacted['set-cookie']).toBe('[REDACTED]');
    expect(redacted.nested.deeperSafe).toBe(42);
    expect(redacted.nested.email).toBe('[REDACTED]');
    expect(redacted.nested.authorization).toBe('[REDACTED]');
  });

  it('trata chaves sensíveis de forma insensível a maiúsculas/minúsculas', () => {
    const raw = {
      Authorization: 'Bearer xyz',
      TRACKINGKEY: 'TK-999',
      Email: 'teste@ifes.edu.br',
      InternalNote: 'segredo',
      'Set-Cookie': 'auth=val',
      COOKIE: 'val',
    };

    const redacted = redactSensitive(raw) as Record<string, string>;
    expect(redacted.Authorization).toBe('[REDACTED]');
    expect(redacted.TRACKINGKEY).toBe('[REDACTED]');
    expect(redacted.Email).toBe('[REDACTED]');
    expect(redacted.InternalNote).toBe('[REDACTED]');
    expect(redacted['Set-Cookie']).toBe('[REDACTED]');
    expect(redacted.COOKIE).toBe('[REDACTED]');
  });

  it('redige chaves sensíveis dentro de arrays de objetos', () => {
    const raw = {
      users: [
        { id: '1', email: 'u1@ifes.edu.br', token: 'tok1' },
        { id: '2', email: 'u2@ifes.edu.br', token: 'tok2' },
      ],
    };

    const redacted = redactSensitive(raw) as typeof raw;
    expect(redacted.users[0]?.id).toBe('1');
    expect(redacted.users[0]?.email).toBe('[REDACTED]');
    expect(redacted.users[0]?.token).toBe('[REDACTED]');
    expect(redacted.users[1]?.id).toBe('2');
    expect(redacted.users[1]?.email).toBe('[REDACTED]');
    expect(redacted.users[1]?.token).toBe('[REDACTED]');
  });

  it('protege contra referências circulares sem lançar exceção', () => {
    interface CircularNode {
      name: string;
      self?: CircularNode;
      token?: string;
    }
    const node: CircularNode = { name: 'circular-root', token: 'secret' };
    node.self = node;

    expect(() => redactSensitive(node)).not.toThrow();
    const redacted = redactSensitive(node) as Record<string, unknown>;
    expect(redacted.name).toBe('circular-root');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.self).toBe('[CIRCULAR]');
  });

  it('limita profundidade excessiva de aninhamento com [MAX_DEPTH]', () => {
    let deep: Record<string, unknown> = { level: 12 };
    for (let i = 11; i >= 0; i--) {
      deep = { level: i, child: deep };
    }

    const redacted = redactSensitive(deep) as Record<string, unknown>;
    expect(() => JSON.stringify(redacted)).not.toThrow();

    // Navega até o 11º nível para verificar o marcador [MAX_DEPTH]
    let current = redacted;
    for (let i = 0; i < 10; i++) {
      current = current.child as Record<string, unknown>;
    }
    expect(current.child).toBe('[MAX_DEPTH]');
  });

  it('sanitiza instâncias de Error com campos extras', () => {
    const errorWithData = new Error('Falha de conexão');
    (errorWithData as unknown as Record<string, unknown>).token = 'secret-in-error';
    (errorWithData as unknown as Record<string, unknown>).details = {
      email: 'admin@ifes.edu.br',
    };

    const redacted = redactSensitive(errorWithData) as Record<string, unknown>;
    expect(redacted.name).toBe('Error');
    expect(redacted.message).toBe('Falha de conexão');
    expect(redacted.token).toBe('[REDACTED]');
    expect((redacted.details as Record<string, unknown>).email).toBe('[REDACTED]');
  });

  it('logger emite saída sanitizada para stdout via JSON mesmo com chaves sensíveis e circularidade', () => {
    const cyclicObj: Record<string, unknown> = { data: 'ok', token: 'super-secret' };
    cyclicObj.loop = cyclicObj;

    const entry = captureNextEntry(() =>
      logger.error('system.failure', {
        context: {
          userEmail: 'safe@test.com',
          email: 'exposed@test.com',
          authorization: 'Bearer leaked',
          loopRef: cyclicObj,
        },
      }),
    );

    expect(entry.severity).toBe('ERROR');
    expect(entry.event).toBe('system.failure');
    const ctx = entry.context as Record<string, unknown>;
    expect(ctx.email).toBe('[REDACTED]');
    expect(ctx.authorization).toBe('[REDACTED]');
    const loop = ctx.loopRef as Record<string, unknown>;
    expect(loop.token).toBe('[REDACTED]');
    expect(loop.loop).toBe('[CIRCULAR]');
  });
});
