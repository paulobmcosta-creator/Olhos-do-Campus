import { describe, expect, it } from 'vitest';
import {
  createType1Message,
  parseType2Message,
  createType3Message,
} from '../server/providers/ews/ntlmClient';
import {
  md4,
  computeNtHash,
  computeNtlmv2Hash,
  computeLmv2Response,
  buildNtlmv2Blob,
  computeNtProofStr,
} from '../server/providers/ews/ntlmCrypto';

/**
 * DOCUMENTAÇÃO DE REFERÊNCIA DOS VETORES DE TESTE:
 *
 * 1. RFC 1320 (The MD4 Message-Digest Algorithm — Seção A.5 "Test suite"):
 *    - Vetores oficiais de digest MD4 para 7 entradas de teste de referência.
 *    - Constantes transcritas literalmente da especificação IETF RFC 1320.
 *
 * 2. MS-NLMP (NT LAN Manager (NTLM) Authentication Protocol Specification):
 *    - Seção 3.3.1: NT-Hash = MD4(UNICODE(Passwd))
 *    - Seção 3.3.2 / 4.2.4.1.1: NTOWFv2(Passwd, User, UserDom) = HMAC_MD5(NT-Hash, UNICODE(Uppercase(User) + UserDom))
 *      IMPORTANTE: Apenas o nome de usuário (User) é convertido para maiúsculas. O domínio (UserDom) preserva sua capitalização original.
 *    - Seção 4.2.4: Exemplo completo de autenticação NTLMv2:
 *      * User = "User", UserDom = "Domain", Password = "Password"
 *      * ServerChallenge = 01 23 45 67 89 ab cd ef
 *      * ClientChallenge = aa aa aa aa aa aa aa aa
 *      * Time = 00 00 00 00 00 00 00 00 (FILETIME 0)
 *      * TargetInfo (AvPairs) = 02 00 0c 00 44 00 6f 00 6d 00 61 00 69 00 6e 00 01 00 0c 00 53 00 65 00 72 00 76 00 65 00 72 00 00 00 00 00
 *    - Valores oficiais literais de MS-NLMP §4.2.4:
 *      * NT-Hash ("Password") = a4f49c406510bdcab6824ee7c30fd852 (§3.3.1)
 *      * NTLMv2-Hash / NTOWFv2 = 0c868a403bfd7a93a3001ef22ef02e3f (§4.2.4.1.1)
 *      * LMv2 Response = 86c35097ac9cec102554764a57cccc19aaaaaaaaaaaaaaaa (§4.2.4.2.1)
 *      * NTLMv2 Blob (temp) = 01010000000000000000000000000000aaaaaaaaaaaaaaaa0000000002000c0044006f006d00610069006e0001000c005300650072007600650072000000000000000000 (§4.2.4.2.2)
 *      * NTProofStr = 68cd0ab851e51c96aabc927bebef6a1c (§4.2.4.2.2)
 *      * NTLMv2 Response = 68cd0ab851e51c96aabc927bebef6a1c01010000000000000000000000000000aaaaaaaaaaaaaaaa0000000002000c0044006f006d00610069006e0001000c005300650072007600650072000000000000000000 (§4.2.4.2.2)
 *
 * Todos os testes utilizam constantes literais fixas e independentes, sem derivação circular pela própria implementação em teste.
 */

describe('NTLM Reference Test Vectors and Security (0.7.6)', () => {
  describe('1. Vetores Criptográficos Oficiais RFC 1320 (MD4 Message Digest Algorithm — Seção A.5)', () => {
    const rfc1320Vectors: Array<{ input: string; expectedHex: string }> = [
      { input: '', expectedHex: '31d6cfe0d16ae931b73c59d7e0c089c0' },
      { input: 'a', expectedHex: 'bde52cb31de33e46245e05fbdbd6fb24' },
      { input: 'abc', expectedHex: 'a448017aaf21d8525fc10ae87aa6729d' },
      { input: 'message digest', expectedHex: 'd9130a8164549fe818874806e1c7014b' },
      { input: 'abcdefghijklmnopqrstuvwxyz', expectedHex: 'd79e1c308aa5bbcdeea8ed63df412da9' },
      { input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', expectedHex: '043f8582f241db351ce627e153e7f0e4' },
      { input: '12345678901234567890123456789012345678901234567890123456789012345678901234567890', expectedHex: 'e33b4ddc9c38f2199c3e7b164fcc0536' },
    ];

    for (const { input, expectedHex } of rfc1320Vectors) {
      it(`calcula digest MD4 byte a byte para "${input}"`, () => {
        const inputBuf = Buffer.from(input, 'ascii');
        const digest = md4(inputBuf);
        expect(digest.toString('hex')).toBe(expectedHex);
      });
    }
  });

  describe('2. Vetores de Referência Oficiais MS-NLMP §4.2.4 (NT LAN Manager Authentication Protocol)', () => {
    // Parâmetros de entrada oficiais conforme MS-NLMP §4.2.4:
    const user = 'User';
    const domain = 'Domain'; // Capitalização original preservada
    const password = 'Password';
    const serverChallenge = Buffer.from('0123456789abcdef', 'hex');
    const clientNonceOfficial = Buffer.from('aaaaaaaaaaaaaaaa', 'hex');
    const targetInfoOfficial = Buffer.from('02000c0044006f006d00610069006e0001000c0053006500720076006500720000000000', 'hex');
    const timestampZero = 0n;

    // Constantes literais independentes oficiais de MS-NLMP:
    const EXPECTED_NT_HASH = 'a4f49c406510bdcab6824ee7c30fd852';
    const EXPECTED_NT_HASH_SECRET = 'cd06ca7c7e10c99b1d33b7485a2ed808';
    const EXPECTED_NTLMV2_HASH = '0c868a403bfd7a93a3001ef22ef02e3f';
    const EXPECTED_LMV2_RESPONSE_OFFICIAL = '86c35097ac9cec102554764a57cccc19aaaaaaaaaaaaaaaa';
    const EXPECTED_NTLMV2_BLOB_OFFICIAL = '01010000000000000000000000000000aaaaaaaaaaaaaaaa0000000002000c0044006f006d00610069006e0001000c005300650072007600650072000000000000000000';
    const EXPECTED_NT_PROOF_STR_OFFICIAL = '68cd0ab851e51c96aabc927bebef6a1c';
    const EXPECTED_NTLMV2_RESPONSE_OFFICIAL = '68cd0ab851e51c96aabc927bebef6a1c01010000000000000000000000000000aaaaaaaaaaaaaaaa0000000002000c0044006f006d00610069006e0001000c005300650072007600650072000000000000000000';

    it('calcula NT-Hash determinístico conforme MS-NLMP §3.3.1', () => {
      const ntHashPassword = computeNtHash(password);
      expect(ntHashPassword.toString('hex')).toBe(EXPECTED_NT_HASH);

      const ntHashSecret = computeNtHash('SecREt01');
      expect(ntHashSecret.toString('hex')).toBe(EXPECTED_NT_HASH_SECRET);
    });

    it('calcula NTLMv2-Hash (NTOWFv2) com preservação de case de domínio conforme MS-NLMP §3.3.2 e §4.2.4.1.1', () => {
      // NTOWFv2 = HMAC-MD5(NT-Hash, UTF-16LE(Uppercase(User) + UserDom)) = HMAC-MD5(..., UTF-16LE("USERDomain"))
      const ntlmv2Hash = computeNtlmv2Hash(user, domain, password);
      expect(ntlmv2Hash.toString('hex')).toBe(EXPECTED_NTLMV2_HASH);
    });

    it('calcula LMv2 Response oficial completa byte a byte conforme MS-NLMP §4.2.4.2.1', () => {
      const ntlmv2Hash = computeNtlmv2Hash(user, domain, password);
      const lmv2Response = computeLmv2Response(ntlmv2Hash, serverChallenge, clientNonceOfficial);

      expect(lmv2Response.length).toBe(24);
      expect(lmv2Response.toString('hex')).toBe(EXPECTED_LMV2_RESPONSE_OFFICIAL);
      expect(lmv2Response.subarray(16, 24).toString('hex')).toBe('aaaaaaaaaaaaaaaa');
    });

    it('monta NTLMv2 Blob e calcula NTProofStr oficial byte a byte conforme MS-NLMP §2.2.2.7 e §4.2.4.2.2', () => {
      const ntlmv2Hash = computeNtlmv2Hash(user, domain, password);
      const blob = buildNtlmv2Blob(timestampZero, clientNonceOfficial, targetInfoOfficial);

      expect(blob.length).toBe(68);
      expect(blob.toString('hex')).toBe(EXPECTED_NTLMV2_BLOB_OFFICIAL);
      expect(blob.readUInt32LE(0)).toBe(0x00000101); // Header signature
      expect(blob.readBigUInt64LE(8)).toBe(0n); // Timestamp
      expect(blob.subarray(16, 24).toString('hex')).toBe('aaaaaaaaaaaaaaaa'); // Client nonce

      const ntProofStr = computeNtProofStr(ntlmv2Hash, serverChallenge, blob);
      expect(ntProofStr.length).toBe(16);
      expect(ntProofStr.toString('hex')).toBe(EXPECTED_NT_PROOF_STR_OFFICIAL);

      const ntv2Response = Buffer.concat([ntProofStr, blob]);
      expect(ntv2Response.length).toBe(84);
      expect(ntv2Response.toString('hex')).toBe(EXPECTED_NTLMV2_RESPONSE_OFFICIAL);
    });
  });

  describe('3. Vetores Secundários de NTLMv2 com Nonce e Timestamp Fixos', () => {
    const user = 'User';
    const domain = 'Domain';
    const password = 'Password';
    const serverChallenge = Buffer.from('0123456789abcdef', 'hex');
    const clientNonce = Buffer.from('ffffff0011223344', 'hex');
    const timestamp = 116444736000000000n; // FILETIME constante fixa de teste

    // Constantes literais independentes congeladas:
    const EXPECTED_LMV2_RESPONSE_NONCE = '683b04f879b28ebe848df8e4f9f2dc4cffffff0011223344';
    const EXPECTED_NTLMV2_BLOB_NONCE = '010100000000000000803ed5deb19d01ffffff00112233440000000000000000';
    const EXPECTED_NT_PROOF_STR_NONCE = 'd2a0da3625099a1e8b4e080d3df63ed0';
    const EXPECTED_NTLMV2_RESPONSE_NONCE = 'd2a0da3625099a1e8b4e080d3df63ed0010100000000000000803ed5deb19d01ffffff00112233440000000000000000';

    it('calcula LMv2 Response com nonce alternativo byte a byte', () => {
      const ntlmv2Hash = computeNtlmv2Hash(user, domain, password);
      const lmv2Response = computeLmv2Response(ntlmv2Hash, serverChallenge, clientNonce);

      expect(lmv2Response.length).toBe(24);
      expect(lmv2Response.toString('hex')).toBe(EXPECTED_LMV2_RESPONSE_NONCE);
    });

    it('monta NTLMv2 Blob (32 bytes sem TargetInfo) e calcula NTProofStr byte a byte', () => {
      const ntlmv2Hash = computeNtlmv2Hash(user, domain, password);
      const blob = buildNtlmv2Blob(timestamp, clientNonce, Buffer.alloc(0));

      expect(blob.length).toBe(32);
      expect(blob.toString('hex')).toBe(EXPECTED_NTLMV2_BLOB_NONCE);

      const ntProofStr = computeNtProofStr(ntlmv2Hash, serverChallenge, blob);
      expect(ntProofStr.length).toBe(16);
      expect(ntProofStr.toString('hex')).toBe(EXPECTED_NT_PROOF_STR_NONCE);

      const ntv2Response = Buffer.concat([ntProofStr, blob]);
      expect(ntv2Response.length).toBe(48);
      expect(ntv2Response.toString('hex')).toBe(EXPECTED_NTLMV2_RESPONSE_NONCE);
    });

    it('calcula NTLMv2 Response completa e integra no Type 3 com validação byte a byte', () => {
      const type2 = {
        flags: 0x00028205,
        serverChallenge,
        targetName: 'DOMAIN',
        targetInfo: Buffer.alloc(0),
      };

      const type3Base64 = createType3Message(
        type2,
        user,
        password,
        domain,
        'WORKSTATION',
        clientNonce,
        timestamp,
      );

      expect(type3Base64).toBeDefined();
      const type3Buf = Buffer.from(type3Base64, 'base64');

      // Cabeçalho e identificadores
      expect(type3Buf.subarray(0, 8).toString('ascii')).toBe('NTLMSSP\0');
      expect(type3Buf.readUInt32LE(8)).toBe(3); // Type 3 indicator

      // LM Response deve ter 24 bytes com o valor esperado exato
      const lmLen = type3Buf.readUInt16LE(12);
      const lmOffset = type3Buf.readUInt32LE(16);
      expect(lmLen).toBe(24);
      expect(type3Buf.subarray(lmOffset, lmOffset + lmLen).toString('hex')).toBe(EXPECTED_LMV2_RESPONSE_NONCE);

      // NT Response deve ter 48 bytes (16 bytes NTProofStr + 32 bytes Blob) com o valor esperado exato
      const ntLen = type3Buf.readUInt16LE(20);
      const ntOffset = type3Buf.readUInt32LE(24);
      expect(ntLen).toBe(48);
      expect(type3Buf.subarray(ntOffset, ntOffset + ntLen).toString('hex')).toBe(EXPECTED_NTLMV2_RESPONSE_NONCE);

      // Assinatura do Blob no NT Response (offset + 16) deve ser 0x00000101
      expect(type3Buf.readUInt32LE(ntOffset + 16)).toBe(0x00000101);

      // Timestamp gravado no blob
      expect(type3Buf.readBigUInt64LE(ntOffset + 24)).toBe(timestamp);

      // Client nonce gravado no blob
      expect(type3Buf.subarray(ntOffset + 32, ntOffset + 40).toString('hex')).toBe('ffffff0011223344');
    });
  });

  describe('4. Estruturação e Parsing de Handshake (Type 1 e Type 2)', () => {
    it('gera mensagem Type 1 (Negotiate) estruturada com flags corretas', () => {
      const type1 = createType1Message('UPD1', 'WORKSTATION');
      expect(type1).toBeDefined();
      const buffer = Buffer.from(type1, 'base64');
      expect(buffer.subarray(0, 8).toString('ascii')).toBe('NTLMSSP\0');
      expect(buffer.readUInt32LE(8)).toBe(1); // Type 1 indicator
      const flags = buffer.readUInt32LE(12);
      // NEGOTIATE_UNICODE | NEGOTIATE_NTLM | NEGOTIATE_ALWAYS_SIGN | NEGOTIATE_EXTENDED_SESSIONSECURITY
      expect((flags & 0x00000001) !== 0).toBe(true);
      expect((flags & 0x00000200) !== 0).toBe(true);
      expect((flags & 0x00080000) !== 0).toBe(true);
    });

    it('faz parsing correto de mensagem Type 2 (Challenge)', () => {
      const challengePayload = Buffer.alloc(48, 0);
      challengePayload.write('NTLMSSP\0', 0, 8, 'ascii');
      challengePayload.writeUInt32LE(2, 8); // Type 2 indicator
      // Target Name Security Buffer
      challengePayload.writeUInt16LE(8, 12);
      challengePayload.writeUInt16LE(8, 14);
      challengePayload.writeUInt32LE(40, 16);
      // Flags
      challengePayload.writeUInt32LE(0x00028205, 20);
      // Server Challenge (8 bytes)
      Buffer.from('0123456789abcdef', 'hex').copy(challengePayload, 24);
      // Target Name string "UPD1" em UTF-16LE
      Buffer.from('UPD1', 'utf16le').copy(challengePayload, 40);

      const base64 = challengePayload.toString('base64');
      const parsed = parseType2Message(base64);

      expect(parsed.targetName).toBe('UPD1');
      expect(parsed.serverChallenge.length).toBe(8);
      expect(parsed.serverChallenge.toString('hex')).toBe('0123456789abcdef');
      expect(parsed.flags).toBe(0x00028205);
    });
  });

  describe('5. Proteção contra Vazamento de Credenciais', () => {
    it('não vaza senha em texto claro na serialização de Type 3', () => {
      const sensitivePassword = 'SuperSecretNtlmPassword!#$';
      const type2 = {
        flags: 0x00028205,
        serverChallenge: Buffer.from('0123456789abcdef', 'hex'),
        targetName: 'UPD1',
      };

      const type3Base64 = createType3Message(type2, 'usuario', sensitivePassword, 'UPD1');
      const rawString = Buffer.from(type3Base64, 'base64').toString('latin1');

      // A senha em texto claro NUNCA pode aparecer na mensagem gerada (apenas NT-Hash/HMAC-MD5)
      expect(rawString).not.toContain(sensitivePassword);
    });
  });
});

