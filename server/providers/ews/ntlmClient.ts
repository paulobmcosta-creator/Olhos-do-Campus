import { randomBytes } from 'node:crypto';
import https from 'node:https';
import type http from 'node:http';
import { URL } from 'node:url';
import {
  buildNtlmv2Blob,
  computeLmv2Response,
  computeNtlmv2Hash,
  computeNtProofStr,
  unicode,
} from './ntlmCrypto';

export function createType1Message(domain?: string, workstation?: string): string {
  const domainBuf = domain !== undefined && domain !== '' ? Buffer.from(domain.toUpperCase(), 'ascii') : Buffer.alloc(0);
  const workBuf = workstation !== undefined && workstation !== '' ? Buffer.from(workstation.toUpperCase(), 'ascii') : Buffer.alloc(0);

  const flags =
    0x00000001 | // NEGOTIATE_UNICODE
    0x00000002 | // NEGOTIATE_OEM
    0x00000004 | // REQUEST_TARGET
    0x00000200 | // NEGOTIATE_NTLM
    0x00008000 | // NEGOTIATE_ALWAYS_SIGN
    0x00080000 | // NEGOTIATE_EXTENDED_SESSIONSECURITY
    0x20000000 | // NEGOTIATE_128
    0x80000000;  // NEGOTIATE_56

  const headerLen = 32;
  const buf = Buffer.alloc(headerLen + domainBuf.length + workBuf.length);

  buf.write('NTLMSSP\0', 0, 'ascii');
  buf.writeUInt32LE(1, 8); // Type 1
  buf.writeUInt32LE(flags >>> 0, 12);

  // Domain security buffer
  buf.writeUInt16LE(domainBuf.length, 16);
  buf.writeUInt16LE(domainBuf.length, 18);
  buf.writeUInt32LE(headerLen + workBuf.length, 20);

  // Workstation security buffer
  buf.writeUInt16LE(workBuf.length, 24);
  buf.writeUInt16LE(workBuf.length, 26);
  buf.writeUInt32LE(headerLen, 28);

  workBuf.copy(buf, headerLen);
  domainBuf.copy(buf, headerLen + workBuf.length);

  return buf.toString('base64');
}

export interface Type2MessageInfo {
  flags: number;
  serverChallenge: Buffer;
  targetName?: string;
  targetInfo?: Buffer;
}

export function parseType2Message(raw: string): Type2MessageInfo {
  const buf = Buffer.from(raw, 'base64');
  if (buf.length < 32 || buf.toString('ascii', 0, 8) !== 'NTLMSSP\0' || buf.readUInt32LE(8) !== 2) {
    throw new Error('Mensagem NTLM Type 2 inválida.');
  }

  const flags = buf.readUInt32LE(20);
  const serverChallenge = buf.subarray(24, 32);

  let targetName: string | undefined;
  const targetNameLen = buf.readUInt16LE(12);
  const targetNameOffset = buf.readUInt32LE(16);
  if (targetNameLen > 0 && targetNameOffset + targetNameLen <= buf.length) {
    const isUnicode = (flags & 0x00000001) !== 0;
    targetName = buf.toString(isUnicode ? 'utf16le' : 'ascii', targetNameOffset, targetNameOffset + targetNameLen);
  }

  let targetInfo: Buffer | undefined;
  if (buf.length >= 48) {
    const targetInfoLen = buf.readUInt16LE(40);
    const targetInfoOffset = buf.readUInt32LE(44);
    if (targetInfoLen > 0 && targetInfoOffset + targetInfoLen <= buf.length) {
      targetInfo = buf.subarray(targetInfoOffset, targetInfoOffset + targetInfoLen);
    }
  }

  return { flags, serverChallenge: Buffer.from(serverChallenge), targetName, targetInfo };
}

export function createType3Message(
  type2: Type2MessageInfo,
  username: string,
  password: string,
  domain = 'UPD1',
  workstation = 'WORKSTATION',
  clientNonceOverride?: Buffer,
  timestampOverride?: bigint,
): string {
  const domainBuf = unicode(domain);
  const userBuf = unicode(username);
  const workBuf = unicode(workstation);

  // NTLMv2-Hash (NTOWFv2): HMAC-MD5(NT-Hash, utf16le(Uppercase(USER) + Domain)) conforme MS-NLMP §3.3.2
  const ntlmv2Hash = computeNtlmv2Hash(username, domain, password);

  // Client Nonce (8 bytes)
  const clientNonce = clientNonceOverride ?? randomBytes(8);

  // Timestamp: 100-nanosecond intervals since Jan 1, 1601 UTC
  const nowMs = BigInt(Date.now());
  const filetime = timestampOverride ?? (nowMs + 11644473600000n) * 10000n;

  // Blob (Target Info ou Terminação)
  const blob = buildNtlmv2Blob(filetime, clientNonce, type2.targetInfo);

  // NT-Proof-Str: HMAC-MD5(ntlmv2Hash, ServerChallenge + Blob)
  const ntProofStr = computeNtProofStr(ntlmv2Hash, type2.serverChallenge, blob);
  const ntChallengeResponse = Buffer.concat([ntProofStr, blob]);

  // LMv2 Response: HMAC-MD5(ntlmv2Hash, ServerChallenge + ClientNonce) + ClientNonce
  const lmChallengeResponse = computeLmv2Response(ntlmv2Hash, type2.serverChallenge, clientNonce);

  const flags =
    0x00000001 | // NEGOTIATE_UNICODE
    0x00000200 | // NEGOTIATE_NTLM
    0x00008000 | // NEGOTIATE_ALWAYS_SIGN
    0x00080000 | // NEGOTIATE_EXTENDED_SESSIONSECURITY
    0x20000000 | // NEGOTIATE_128
    0x80000000;  // NEGOTIATE_56

  const headerLen = 72;
  const lmOffset = headerLen;
  const ntOffset = lmOffset + lmChallengeResponse.length;
  const domainOffset = ntOffset + ntChallengeResponse.length;
  const userOffset = domainOffset + domainBuf.length;
  const workOffset = userOffset + userBuf.length;
  const totalLen = workOffset + workBuf.length;

  const buf = Buffer.alloc(totalLen);
  buf.write('NTLMSSP\0', 0, 'ascii');
  buf.writeUInt32LE(3, 8); // Type 3

  // LM Response Security Buffer
  buf.writeUInt16LE(lmChallengeResponse.length, 12);
  buf.writeUInt16LE(lmChallengeResponse.length, 14);
  buf.writeUInt32LE(lmOffset, 16);

  // NT Response Security Buffer
  buf.writeUInt16LE(ntChallengeResponse.length, 20);
  buf.writeUInt16LE(ntChallengeResponse.length, 22);
  buf.writeUInt32LE(ntOffset, 24);

  // Domain Security Buffer
  buf.writeUInt16LE(domainBuf.length, 28);
  buf.writeUInt16LE(domainBuf.length, 30);
  buf.writeUInt32LE(domainOffset, 32);

  // User Security Buffer
  buf.writeUInt16LE(userBuf.length, 36);
  buf.writeUInt16LE(userBuf.length, 38);
  buf.writeUInt32LE(userOffset, 40);

  // Workstation Security Buffer
  buf.writeUInt16LE(workBuf.length, 44);
  buf.writeUInt16LE(workBuf.length, 46);
  buf.writeUInt32LE(workOffset, 48);

  // Session Key (0 length)
  buf.writeUInt16LE(0, 52);
  buf.writeUInt16LE(0, 54);
  buf.writeUInt32LE(totalLen, 56);

  // Flags
  buf.writeUInt32LE(flags >>> 0, 60);

  // Copy Data
  lmChallengeResponse.copy(buf, lmOffset);
  ntChallengeResponse.copy(buf, ntOffset);
  domainBuf.copy(buf, domainOffset);
  userBuf.copy(buf, userOffset);
  workBuf.copy(buf, workOffset);

  return buf.toString('base64');
}

export interface NtlmRequestOptions {
  url: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  body?: string | Buffer;
  username: string;
  password: string;
  domain: string;
  workstation?: string;
  timeoutMs?: number;
}

export interface NtlmResponse {
  statusCode: number;
  statusMessage: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function omitHeaderCaseInsensitive(headers: Record<string, string>, headerName: string): Record<string, string> {
  const normalizedName = headerName.toLowerCase();
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== normalizedName),
  );
}

export function buildAuthenticatedRequestHeaders(
  baseHeaders: Record<string, string> | undefined,
  authorization: string,
  body: string | Buffer | undefined,
): Record<string, string> {
  const withoutTransferEncoding = omitHeaderCaseInsensitive(baseHeaders ?? {}, 'transfer-encoding');
  const sanitizedHeaders = omitHeaderCaseInsensitive(withoutTransferEncoding, 'content-length');
  const contentLength = body === undefined ? undefined : Buffer.byteLength(body);

  return {
    ...sanitizedHeaders,
    ...(contentLength === undefined ? {} : { 'Content-Length': String(contentLength) }),
    Authorization: authorization,
    Connection: 'close',
  };
}

export async function executeNtlmRequest(options: NtlmRequestOptions): Promise<NtlmResponse> {
  const targetUrl = new URL(options.url);
  if (targetUrl.protocol !== 'https:') {
    throw new Error('NTLM_SECURITY_VIOLATION: Apenas o protocolo HTTPS é permitido para requisições NTLM.');
  }
  if (targetUrl.username !== '' || targetUrl.password !== '') {
    throw new Error('NTLM_SECURITY_VIOLATION: A URL do EWS não pode conter credenciais embutidas.');
  }
  const transport = https;
  const agent = new https.Agent({ keepAlive: true, maxSockets: 1, rejectUnauthorized: true });
  const timeout = options.timeoutMs ?? 30_000;

  try {
    // Step 1: Enviar requisição com Type 1 Negotiate na conexão persistente
    const type1Header = `NTLM ${createType1Message(options.domain, options.workstation)}`;
    const step1Headers: Record<string, string> = {
      ...options.headers,
      Authorization: type1Header,
      Connection: 'keep-alive',
    };

    const type2Response = await new Promise<{
      statusCode: number;
      headers: http.IncomingHttpHeaders;
      authHeader?: string;
    }>((resolve, reject) => {
      const req = transport.request(
        targetUrl,
        {
          method: options.method ?? 'POST',
          headers: step1Headers,
          agent,
          timeout,
        },
        (res) => {
          res.resume(); // Consumir stream para permitir reuso do socket no keep-alive
          const rawAuthHeaders = res.headers['www-authenticate'];
          let authHeader: string | undefined;
          if (Array.isArray(rawAuthHeaders)) {
            const list: string[] = rawAuthHeaders;
            authHeader = list.find((h) => /^NTLM\s+/iu.test(h));
          } else if (typeof rawAuthHeaders === 'string' && /^NTLM\s+/iu.test(rawAuthHeaders)) {
            authHeader = rawAuthHeaders;
          }
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            authHeader,
          });
        },
      );
      req.on('timeout', () => {
        req.destroy(new Error('ETIMEDOUT'));
      });
      req.on('error', reject);
      req.end();
    });

    // Se o servidor respondeu algo diferente de 401 ou não ofereceu challenge NTLM:
    if (type2Response.statusCode !== 401 || type2Response.authHeader === undefined) {
      if (type2Response.statusCode >= 200 && type2Response.statusCode < 300) {
        return {
          statusCode: type2Response.statusCode,
          statusMessage: 'OK',
          headers: type2Response.headers,
          body: '',
        };
      }
      throw new Error(`NTLM_HANDSHAKE_FAILED: Servidor respondeu ${type2Response.statusCode} sem challenge NTLM válido.`);
    }

    const type2Raw = type2Response.authHeader.replace(/^NTLM\s+/iu, '').trim();
    const type2Parsed = parseType2Message(type2Raw);

    // Step 2: Enviar requisição autenticada com Type 3 Authenticate e corpo completo
    const type3Header = `NTLM ${createType3Message(
      type2Parsed,
      options.username,
      options.password,
      options.domain,
      options.workstation,
    )}`;

    const step2Headers = buildAuthenticatedRequestHeaders(options.headers, type3Header, options.body);

    const finalResponse = await new Promise<NtlmResponse>((resolve, reject) => {
      const req = transport.request(
        targetUrl,
        {
          method: options.method ?? 'POST',
          headers: step2Headers,
          agent,
          timeout,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve({
              statusCode: res.statusCode ?? 0,
              statusMessage: res.statusMessage ?? '',
              headers: res.headers,
              body,
            });
          });
        },
      );
      req.on('timeout', () => {
        req.destroy(new Error('ETIMEDOUT'));
      });
      req.on('error', reject);

      if (options.body !== undefined) {
        req.write(options.body);
      }
      req.end();
    });

    return finalResponse;
  } finally {
    agent.destroy();
  }
}
