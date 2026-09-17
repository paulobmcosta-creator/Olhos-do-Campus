import crypto from 'node:crypto';

/**
 * Funções auxiliares e constantes para implementação pura do MD4 (RFC 1320)
 * em aritmética de inteiros unsigned de 32 bits.
 */
function rol(n: number, c: number): number {
  return ((n << c) | (n >>> (32 - c))) >>> 0;
}

function f(x: number, y: number, z: number): number {
  return ((x & y) | (~x & z)) >>> 0;
}

function g(x: number, y: number, z: number): number {
  return ((x & y) | (x & z) | (y & z)) >>> 0;
}

function h(x: number, y: number, z: number): number {
  return (x ^ y ^ z) >>> 0;
}

/**
 * Implementação pura do MD4 conforme RFC 1320 (Message Digest Algorithm).
 * Não depende de OpenSSL nem de providers legados do Node.
 */
export function md4(message: Buffer): Buffer {
  const len = message.length;
  const numBlocks = ((len + 8) >>> 6) + 1;
  const totalBytes = numBlocks << 6;
  const padded = Buffer.alloc(totalBytes, 0);

  message.copy(padded, 0);
  padded[len] = 0x80;
  padded.writeUInt32LE((len * 8) >>> 0, totalBytes - 8);
  padded.writeUInt32LE(Math.floor((len * 8) / 0x100000000), totalBytes - 4);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let i = 0; i < totalBytes; i += 64) {
    const x: number[] = [];
    for (let j = 0; j < 16; j += 1) {
      x.push(padded.readUInt32LE(i + j * 4));
    }

    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    // Round 1
    a = rol((a + f(b, c, d) + x[0]!) >>> 0, 3);
    d = rol((d + f(a, b, c) + x[1]!) >>> 0, 7);
    c = rol((c + f(d, a, b) + x[2]!) >>> 0, 11);
    b = rol((b + f(c, d, a) + x[3]!) >>> 0, 19);
    a = rol((a + f(b, c, d) + x[4]!) >>> 0, 3);
    d = rol((d + f(a, b, c) + x[5]!) >>> 0, 7);
    c = rol((c + f(d, a, b) + x[6]!) >>> 0, 11);
    b = rol((b + f(c, d, a) + x[7]!) >>> 0, 19);
    a = rol((a + f(b, c, d) + x[8]!) >>> 0, 3);
    d = rol((d + f(a, b, c) + x[9]!) >>> 0, 7);
    c = rol((c + f(d, a, b) + x[10]!) >>> 0, 11);
    b = rol((b + f(c, d, a) + x[11]!) >>> 0, 19);
    a = rol((a + f(b, c, d) + x[12]!) >>> 0, 3);
    d = rol((d + f(a, b, c) + x[13]!) >>> 0, 7);
    c = rol((c + f(d, a, b) + x[14]!) >>> 0, 11);
    b = rol((b + f(c, d, a) + x[15]!) >>> 0, 19);

    // Round 2
    a = rol((a + g(b, c, d) + x[0]! + 0x5a827999) >>> 0, 3);
    d = rol((d + g(a, b, c) + x[4]! + 0x5a827999) >>> 0, 5);
    c = rol((c + g(d, a, b) + x[8]! + 0x5a827999) >>> 0, 9);
    b = rol((b + g(c, d, a) + x[12]! + 0x5a827999) >>> 0, 13);
    a = rol((a + g(b, c, d) + x[1]! + 0x5a827999) >>> 0, 3);
    d = rol((d + g(a, b, c) + x[5]! + 0x5a827999) >>> 0, 5);
    c = rol((c + g(d, a, b) + x[9]! + 0x5a827999) >>> 0, 9);
    b = rol((b + g(c, d, a) + x[13]! + 0x5a827999) >>> 0, 13);
    a = rol((a + g(b, c, d) + x[2]! + 0x5a827999) >>> 0, 3);
    d = rol((d + g(a, b, c) + x[6]! + 0x5a827999) >>> 0, 5);
    c = rol((c + g(d, a, b) + x[10]! + 0x5a827999) >>> 0, 9);
    b = rol((b + g(c, d, a) + x[14]! + 0x5a827999) >>> 0, 13);
    a = rol((a + g(b, c, d) + x[3]! + 0x5a827999) >>> 0, 3);
    d = rol((d + g(a, b, c) + x[7]! + 0x5a827999) >>> 0, 5);
    c = rol((c + g(d, a, b) + x[11]! + 0x5a827999) >>> 0, 9);
    b = rol((b + g(c, d, a) + x[15]! + 0x5a827999) >>> 0, 13);

    // Round 3
    a = rol((a + h(b, c, d) + x[0]! + 0x6ed9eba1) >>> 0, 3);
    d = rol((d + h(a, b, c) + x[8]! + 0x6ed9eba1) >>> 0, 9);
    c = rol((c + h(d, a, b) + x[4]! + 0x6ed9eba1) >>> 0, 11);
    b = rol((b + h(c, d, a) + x[12]! + 0x6ed9eba1) >>> 0, 15);
    a = rol((a + h(b, c, d) + x[2]! + 0x6ed9eba1) >>> 0, 3);
    d = rol((d + h(a, b, c) + x[10]! + 0x6ed9eba1) >>> 0, 9);
    c = rol((c + h(d, a, b) + x[6]! + 0x6ed9eba1) >>> 0, 11);
    b = rol((b + h(c, d, a) + x[14]! + 0x6ed9eba1) >>> 0, 15);
    a = rol((a + h(b, c, d) + x[1]! + 0x6ed9eba1) >>> 0, 3);
    d = rol((d + h(a, b, c) + x[9]! + 0x6ed9eba1) >>> 0, 9);
    c = rol((c + h(d, a, b) + x[5]! + 0x6ed9eba1) >>> 0, 11);
    b = rol((b + h(c, d, a) + x[13]! + 0x6ed9eba1) >>> 0, 15);
    a = rol((a + h(b, c, d) + x[3]! + 0x6ed9eba1) >>> 0, 3);
    d = rol((d + h(a, b, c) + x[11]! + 0x6ed9eba1) >>> 0, 9);
    c = rol((c + h(d, a, b) + x[7]! + 0x6ed9eba1) >>> 0, 11);
    b = rol((b + h(c, d, a) + x[15]! + 0x6ed9eba1) >>> 0, 15);

    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }

  const out = Buffer.alloc(16);
  out.writeUInt32LE(a, 0);
  out.writeUInt32LE(b, 4);
  out.writeUInt32LE(c, 8);
  out.writeUInt32LE(d, 12);
  return out;
}

export function hmacMd5(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac('md5', key).update(data).digest();
}

export function unicode(s: string): Buffer {
  return Buffer.from(s, 'utf16le');
}

/**
 * Calcula NT-Hash = MD4(UTF-16LE(Password)) conforme MS-NLMP §3.3.1
 */
export function computeNtHash(password: string): Buffer {
  return md4(unicode(password));
}

/**
 * Calcula NTLMv2-Hash = HMAC-MD5(NT-Hash, UTF-16LE(UPPER(User) + Domain)) conforme MS-NLMP §3.3.2
 */
export function computeNtlmv2Hash(user: string, domain: string, password: string): Buffer {
  const ntHash = computeNtHash(password);
  const userDomain = unicode(user.toUpperCase() + domain);
  return hmacMd5(ntHash, userDomain);
}

/**
 * Calcula LMv2 Response = HMAC-MD5(NTLMv2-Hash, ServerChallenge + ClientNonce) + ClientNonce (24 bytes)
 */
export function computeLmv2Response(ntlmv2Hash: Buffer, serverChallenge: Buffer, clientNonce: Buffer): Buffer {
  const challenge = Buffer.concat([serverChallenge, clientNonce]);
  const hmac = hmacMd5(ntlmv2Hash, challenge);
  return Buffer.concat([hmac, clientNonce]);
}

/**
 * Monta o NTLMv2 Blob (NTLMv2 CLIENT_CHALLENGE) conforme MS-NLMP §2.2.2.7
 */
export function buildNtlmv2Blob(
  timestamp: bigint,
  clientNonce: Buffer,
  targetInfo?: Buffer,
): Buffer {
  const tInfo = targetInfo ?? Buffer.alloc(0);
  const blob = Buffer.alloc(28 + tInfo.length + 4);

  blob.writeUInt32LE(0x00000101, 0); // Header signature
  blob.writeUInt32LE(0, 4); // Reserved
  blob.writeBigUInt64LE(timestamp, 8); // Timestamp
  clientNonce.copy(blob, 16); // 8-byte Client Nonce
  blob.writeUInt32LE(0, 24); // Reserved
  tInfo.copy(blob, 28); // TargetInfo (AvPair list)
  blob.writeUInt32LE(0, 28 + tInfo.length); // 4-byte zero trailer

  return blob;
}

/**
 * Calcula NTProofStr = HMAC-MD5(NTLMv2-Hash, ServerChallenge + Blob) conforme MS-NLMP §3.3.2
 */
export function computeNtProofStr(ntlmv2Hash: Buffer, serverChallenge: Buffer, blob: Buffer): Buffer {
  return hmacMd5(ntlmv2Hash, Buffer.concat([serverChallenge, blob]));
}
