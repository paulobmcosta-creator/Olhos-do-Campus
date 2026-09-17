/**
 * G09B-F006 / G09B-F007 — Security Headers (CSP, HSTS e demais)
 *
 * Aplica cabeçalhos de segurança HTTP em todas as respostas da API.
 *
 * Content-Security-Policy:
 *   Esta é a política aplicada ao backend (respostas JSON da API).
 *   O frontend React/Vite é servido pelo Firebase Hosting / Cloudflare Pages,
 *   onde a CSP do HTML é controlada pelo firebase.json / _headers.
 *   A API não serve HTML; sua CSP é restritiva por design.
 *
 * HSTS:
 *   Emitido somente quando NODE_ENV=production, pois o ambiente de desenvolvimento
 *   usa HTTP local e HSTS causaria bloqueio no navegador.
 *
 * Permissions-Policy:
 *   Restringe acesso a APIs de hardware sensíveis. A API não as utiliza.
 *
 * frame-ancestors via CSP:
 *   Substitui X-Frame-Options de forma mais completa (CSP nível 2+).
 *   X-Frame-Options DENY é mantido para compatibilidade com browsers legados.
 */

import type { RequestHandler } from 'express';

/**
 * CSP para os endpoints de API (respostas JSON, não HTML).
 * Não serve conteúdo interativo; política é maximamente restritiva.
 */
const API_CSP =
  "default-src 'none'; frame-ancestors 'none'";

export function securityHeaders(isProduction: boolean): RequestHandler {
  return (_request, response, next) => {
    // G09B-F006 — Content-Security-Policy
    response.setHeader('Content-Security-Policy', API_CSP);

    // G09B-F007 — Strict-Transport-Security
    // Emitido somente em produção (HTTPS garantido); evita dano em localhost HTTP.
    if (isProduction) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    // G09B-F007 — X-Content-Type-Options
    response.setHeader('X-Content-Type-Options', 'nosniff');

    // G09B-F007 — Referrer-Policy
    response.setHeader('Referrer-Policy', 'no-referrer');

    // G09B-F007 — Permissions-Policy
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    );

    // G09B-F007 — X-Frame-Options (compatibilidade com browsers que não suportam CSP frame-ancestors)
    response.setHeader('X-Frame-Options', 'DENY');

    next();
  };
}
