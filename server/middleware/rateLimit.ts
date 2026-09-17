/**
 * G09B-F001 / G09G1R-F002 — Rate Limiting com Dupla Camada (UID + Global por Operação)
 *
 * Proteção contra abuso em endpoints públicos sensíveis (scrypt, upload, criação).
 *
 * ─── ESTRATÉGIA DE PROTEÇÃO (GATE 0.9-G.1C2) ──────────────────────────────────
 * A proteção atua em DUAS CAMADAS INDEPENDENTES:
 *   1. CAMADA 1: Quota por Firebase Anonymous UID (sessão criptograficamente verificada)
 *   2. CAMADA 2: Quota GLOBAL por operação na instância (backstop volumétrico local)
 *
 * Uma requisição só prossegue se:
 *   UID_BUCKET=ALLOW AND GLOBAL_OPERATION_BUCKET=ALLOW
 *
 * A camada global NÃO depende de qualquer informação fornecida pelo cliente e portanto
 * NÃO pode ser contornada por:
 *   - rotação ou spoofing de UIDs anônimos;
 *   - manipulação de X-Forwarded-For ou outros cabeçalhos;
 *   - alteração de User-Agent;
 *   - rotação de protocolo.
 *
 * ─── REMOÇÃO DE RATE LIMITING BASEADO EM X-FORWARDED-FOR / IP ─────────────────
 * Em conformidade com as diretivas do Gate 0.9-G.1C2:
 *   IP_USED_FOR_RATE_LIMIT=NO
 *   X_FORWARDED_FOR_USED_FOR_RATE_LIMIT=NO
 *   CLIENT_IP_PERSISTED=NO
 *   CLIENT_IP_LOGGED_BY_APPLICATION=NO
 *
 * Todo código de extração de endereço de rede (resolveClientAddress), hashing HMAC
 * de endereço e particionamento por IP/rede foi completamente retirado.
 * Nenhum endereço IP é lido, utilizado para decisão de segurança, logado ou persistido.
 *
 * ─── DECISÃO ARQUITETURAL & MULTI-INSTANCE ───────────────────────────────────
 * RATE_LIMIT_SCOPE=INSTANCE_LOCAL
 * RATE_LIMIT_GLOBAL_SCOPE=INSTANCE_LOCAL
 * CURRENT_PRODUCTION_MAXSCALE=1
 * SAFE_FOR_CURRENT_TOPOLOGY=YES
 * REQUIRES_DISTRIBUTED_OR_EDGE_LIMIT_BEFORE_SCALE_OUT=YES
 *
 * Os contadores são in-memory e locais à instância Cloud Run. Isso é totalmente
 * seguro sob a topologia atual (maxScale=1). Antes de qualquer expansão horizontal
 * futura (G09B-F003), será mandatória a migração para solução distribuída
 * (ex.: Redis/Memorystore) ou proteção na borda (Cloud Armor).
 *
 * ─── PROTEÇÃO POR PROTOCOLO (SEÇÃO 10) ───────────────────────────────────────
 * TRACK_PROTOCOL_BUCKET=NOT_IMPLEMENTED_WITH_JUSTIFICATION
 *
 * Justificativa arquitetural: O middleware trackRateLimiter é posicionado na rota
 * ANTES de validateBody(trackingBodySchema). Essa posição é mandatória para
 * proteger a API contra processamento desnecessário antes da validação de cota.
 * Extrair o protocolo nessa etapa exigiria:
 *   (a) duplicar a validação regex do schema Zod dentro do rate limiter;
 *   (b) reordenar middlewares, permitindo que payloads inválidos executem
 *       validadores antes do rate limiter; ou
 *   (c) aceitar strings não validadas arbitrárias em Maps in-memory, criando
 *       vulnerabilidade de DoS por consumo excessivo de memória.
 * Conforme instrução expressa da Seção 10, a terceira camada não foi forçada,
 * mantendo as duas camadas robustas e canônicas (UID + Global).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { RequestHandler } from 'express';
import { HttpError } from '../types/errors';

export interface RateLimitOptions {
  /** Número máximo de requisições na janela por UID Firebase. */
  readonly maxRequests: number;
  /** Número máximo de requisições na janela global da instância para esta operação. */
  readonly maxGlobalRequests: number;
  /** Duração da janela em milissegundos. */
  readonly windowMs: number;
  /** Código de operação para identificação nos logs operacionais. */
  readonly operation: string;
}

export interface BucketEntry {
  count: number;
  windowStart: number;
}

/**
 * Cria um middleware de rate limiting com dupla camada (UID + Global por Operação).
 *
 * Ambas as camadas devem ter espaço para a requisição ser aceita.
 */
export function createRateLimiter(options: RateLimitOptions): {
  middleware: RequestHandler;
  /** Limpa todos os contadores (UID e Global) — usado em testes para isolar estado. */
  reset(): void;
  /** Acesso ao mapa de buckets por UID — exposto para testes. */
  readonly uidBuckets: Map<string, BucketEntry>;
  /** Acesso ao estado do bucket global — exposto para testes. */
  getGlobalBucket(): Readonly<BucketEntry>;
} {
  const { maxRequests, maxGlobalRequests, windowMs, operation } = options;
  const uidBuckets = new Map<string, BucketEntry>();
  let globalBucket: BucketEntry = { count: 0, windowStart: 0 };

  // Limpeza periódica para evitar crescimento ilimitado da memória.
  // Entradas expiradas de UID são removidas a cada 5× a janela.
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of uidBuckets) {
      if (now - entry.windowStart >= windowMs) uidBuckets.delete(key);
    }
  }, windowMs * 5);

  // Permite que o processo encerre sem bloquear o event loop.
  if (cleanupInterval.unref) cleanupInterval.unref();

  function reset(): void {
    uidBuckets.clear();
    globalBucket = { count: 0, windowStart: 0 };
  }

  function wouldAllow(entry: BucketEntry | undefined, max: number, now: number): boolean {
    if (entry === undefined || now - entry.windowStart >= windowMs) {
      return true;
    }
    return entry.count < max;
  }

  const middleware: RequestHandler = (request, response, next) => {
    // O UID Firebase é estabelecido pelo requireFirebaseUser antes deste middleware.
    const uid = request.firebaseUser?.uid;
    if (uid === undefined) {
      // Sem UID verificado este middleware não pode agir; deixa prosseguir.
      next();
      return;
    }

    const now = Date.now();
    const uidEntry = uidBuckets.get(uid);

    const uidAllowed = wouldAllow(uidEntry, maxRequests, now);
    const globalAllowed = wouldAllow(globalBucket, maxGlobalRequests, now);

    if (uidAllowed && globalAllowed) {
      // Atualiza Camada 1 (UID)
      if (uidEntry === undefined || now - uidEntry.windowStart >= windowMs) {
        uidBuckets.set(uid, { count: 1, windowStart: now });
      } else {
        uidEntry.count += 1;
      }

      // Atualiza Camada 2 (Global da Instância por Operação)
      if (now - globalBucket.windowStart >= windowMs) {
        globalBucket = { count: 1, windowStart: now };
      } else {
        globalBucket.count += 1;
      }

      next();
      return;
    }

    // Limite excedido: calcula Retry-After baseado na janela do bucket bloqueador
    let retryAfterMs = 0;
    if (!uidAllowed && uidEntry !== undefined) {
      retryAfterMs = Math.max(retryAfterMs, windowMs - (now - uidEntry.windowStart));
    }
    if (!globalAllowed) {
      retryAfterMs = Math.max(retryAfterMs, windowMs - (now - globalBucket.windowStart));
    }
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    // Log operacional sem qualquer exposição ou referência a endereços IP
    const blockedLayer = !uidAllowed ? `uid=${uid}` : 'global';
    console.warn(
      `[rate-limit] operação=${operation} ${blockedLayer} rejeitado. Retry-After=${retryAfterSeconds}s.`,
    );

    response.setHeader('Retry-After', String(retryAfterSeconds));
    next(
      new HttpError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Muitas requisições. Aguarde antes de tentar novamente.',
      ),
    );
  };

  return {
    middleware,
    reset,
    uidBuckets,
    getGlobalBucket: () => ({ ...globalBucket }),
  };
}

/**
 * Limiter para endpoints de custo elevado: track, criação e upload público.
 *
 * Limites canônicos (G09B-F001 / G09G1R-F002 — Gate 0.9-G.1C2):
 *   - track:       20 req/min por UID | 120 req/min global da instância
 *   - create:       5 req/min por UID |  30 req/min global da instância
 *   - publicPhoto: 30 req/min por UID | 120 req/min global da instância
 */
export const trackRateLimiter = createRateLimiter({
  maxRequests: 20,
  maxGlobalRequests: 120,
  windowMs: 60_000,
  operation: 'occurrences/track',
});

export const createOccurrenceRateLimiter = createRateLimiter({
  maxRequests: 5,
  maxGlobalRequests: 30,
  windowMs: 60_000,
  operation: 'occurrences/create',
});

export const publicPhotoRateLimiter = createRateLimiter({
  maxRequests: 30,
  maxGlobalRequests: 120,
  windowMs: 60_000,
  operation: 'occurrences/public-photo',
});
