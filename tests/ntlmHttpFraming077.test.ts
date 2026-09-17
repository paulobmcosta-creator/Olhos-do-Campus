import { describe, expect, it } from 'vitest';
import { buildAuthenticatedRequestHeaders } from '../server/providers/ews/ntlmClient';

describe('NTLM HTTP framing regression (0.7.7)', () => {
  const authorization = 'NTLM TYPE3_TOKEN';

  it('define Content-Length pelo tamanho UTF-8 em bytes para corpo string', () => {
    const body = '<m:Subject>Ocorrência — manutenção</m:Subject>';

    const headers = buildAuthenticatedRequestHeaders(
      { 'Content-Type': 'text/xml; charset=utf-8' },
      authorization,
      body,
    );

    expect(headers['Content-Length']).toBe(String(Buffer.byteLength(body, 'utf8')));
    expect(headers.Authorization).toBe(authorization);
    expect(headers.Connection).toBe('close');
  });

  it('define Content-Length correto para corpo Buffer', () => {
    const body = Buffer.from([0x00, 0x01, 0x02, 0xff]);

    const headers = buildAuthenticatedRequestHeaders(undefined, authorization, body);

    expect(headers['Content-Length']).toBe(String(body.length));
  });

  it('sobrescreve Content-Length incorreto e remove Transfer-Encoding independentemente de caixa', () => {
    const body = '<soap>payload</soap>';

    const headers = buildAuthenticatedRequestHeaders(
      {
        'content-length': '999999',
        'Transfer-Encoding': 'chunked',
        Accept: 'text/xml',
      },
      authorization,
      body,
    );

    expect(headers).not.toHaveProperty('content-length');
    expect(headers).not.toHaveProperty('Transfer-Encoding');
    expect(headers['Content-Length']).toBe(String(Buffer.byteLength(body, 'utf8')));
    expect(headers.Accept).toBe('text/xml');
  });

  it('não inventa Content-Length quando a requisição autenticada não possui corpo', () => {
    const headers = buildAuthenticatedRequestHeaders(
      { Accept: 'text/xml' },
      authorization,
      undefined,
    );

    expect(headers).not.toHaveProperty('Content-Length');
    expect(headers.Accept).toBe('text/xml');
  });
});
