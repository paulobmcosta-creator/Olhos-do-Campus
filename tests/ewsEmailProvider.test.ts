import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EwsEmailProvider } from '../server/providers/ewsEmailProvider';
import { EmailProviderError } from '../server/providers/emailProvider';
import * as ntlmClient from '../server/providers/ews/ntlmClient';

vi.mock('../server/providers/ews/ntlmClient', () => ({
  executeNtlmRequest: vi.fn(),
}));

const sampleRequest = {
  message: {
    to: 'destinatario@ifes.edu.br',
    from: 'sistema@ifes.edu.br',
    subject: 'Nova ocorrência 2026.0001',
    text: 'Texto de teste',
    html: '<p>HTML de teste</p>',
  },
  idempotencyKey: 'occurrence-created/abc123',
  notificationId: 'notif-1',
  attemptId: 'att-1',
};

describe('EwsEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exige estritamente protocolo HTTPS e rejeita HTTP e URLs inválidas', () => {
    // HTTP simples deve ser rejeitado
    expect(() => new EwsEmailProvider({ url: 'http://webmail.ifes.edu.br/EWS/Exchange.asmx', domain: 'UPD1', username: 'user', password: 'pwd' })).toThrowError(/HTTPS/iu);
    // Protocolo desconhecido/FTP deve ser rejeitado
    expect(() => new EwsEmailProvider({ url: 'ftp://webmail.ifes.edu.br/EWS/Exchange.asmx', domain: 'UPD1', username: 'user', password: 'pwd' })).toThrowError(/HTTPS/iu);
    // String inválida
    expect(() => new EwsEmailProvider({ url: 'not-a-url', domain: 'UPD1', username: 'user', password: 'pwd' })).toThrow(EmailProviderError);
    // Vazio
    expect(() => new EwsEmailProvider({ url: '', domain: 'UPD1', username: 'user', password: 'pwd' })).toThrow(EmailProviderError);
    // HTTPS válido é aceito
    expect(() => new EwsEmailProvider({ url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx', domain: 'UPD1', username: 'user', password: 'pwd' })).not.toThrow();
  });

  it('valida usuário e senha obrigatórios', () => {
    expect(() => new EwsEmailProvider({ url: 'https://webmail.ifes.edu.br', domain: 'UPD1', username: '', password: 'pwd' })).toThrow(EmailProviderError);
    expect(() => new EwsEmailProvider({ url: 'https://webmail.ifes.edu.br', domain: 'UPD1', username: 'user', password: '' })).toThrow(EmailProviderError);
  });

  it('envia e-mail com sucesso retornando resultado sem providerMessageId quando servidor não emitir ItemId', async () => {
    const successXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Success">
          <m:ResponseCode>NoError</m:ResponseCode>
          <m:Items/>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    vi.mocked(ntlmClient.executeNtlmRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: successXml,
      statusMessage: 'OK',
    });

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    const result = await provider.send(sampleRequest);
    expect(result.providerMessageId).toBeUndefined();
    expect(ntlmClient.executeNtlmRequest).toHaveBeenCalledTimes(1);
  });

  it('retorna providerMessageId quando o Exchange retornar ItemId no envelope', async () => {
    const successXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Success">
          <m:ResponseCode>NoError</m:ResponseCode>
          <m:Items>
            <t:Message><t:ItemId Id="EWS_ITEM_123" ChangeKey="CK_1"/></t:Message>
          </m:Items>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    vi.mocked(ntlmClient.executeNtlmRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: successXml,
      statusMessage: 'OK',
    });

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    const result = await provider.send(sampleRequest);
    expect(result.providerMessageId).toBe('EWS_ITEM_123');
  });

  it('classifica HTTP 401 final como erro de CONFIGURATION', async () => {
    vi.mocked(ntlmClient.executeNtlmRequest).mockResolvedValueOnce({
      statusCode: 401,
      headers: {},
      body: 'Unauthorized',
      statusMessage: 'Unauthorized',
    });

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toMatchObject({
      category: 'CONFIGURATION',
      code: 'ews_auth_rejected',
    });
  });

  it('classifica erro de DNS (ENOTFOUND) como TRANSIENT com retry SAME_ATTEMPT e PROVIDER_REJECTED', async () => {
    const dnsError = new Error('getaddrinfo ENOTFOUND webmail.ifes.edu.br');
    (dnsError as { code?: string }).code = 'ENOTFOUND';
    vi.mocked(ntlmClient.executeNtlmRequest).mockRejectedValueOnce(dnsError);

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toMatchObject({
      category: 'TRANSIENT',
      code: 'ews_dns_error',
      retryMode: 'SAME_ATTEMPT',
      retrySafety: 'PROVIDER_REJECTED',
    });
  });

  it('classifica erro de conexão recusada (ECONNREFUSED) como TRANSIENT com retry SAME_ATTEMPT', async () => {
    const connError = new Error('connect ECONNREFUSED 10.0.0.1:443');
    (connError as { code?: string }).code = 'ECONNREFUSED';
    vi.mocked(ntlmClient.executeNtlmRequest).mockRejectedValueOnce(connError);

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toMatchObject({
      category: 'TRANSIENT',
      code: 'ews_connection_refused',
      retryMode: 'SAME_ATTEMPT',
      retrySafety: 'PROVIDER_REJECTED',
    });
  });

  it('classifica falha de certificado TLS como erro de CONFIGURATION', async () => {
    const tlsError = new Error('CERT_HAS_EXPIRED: certificate has expired');
    (tlsError as { code?: string }).code = 'CERT_HAS_EXPIRED';
    vi.mocked(ntlmClient.executeNtlmRequest).mockRejectedValueOnce(tlsError);

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toMatchObject({
      category: 'CONFIGURATION',
      code: 'ews_tls_validation_failed',
    });
  });

  it('lança erro genérico (UNCERTAIN) em caso de timeout de socket após transmissão', async () => {
    const timeoutError = new Error('ESOCKETTIMEDOUT: Socket timed out');
    (timeoutError as { code?: string }).code = 'ESOCKETTIMEDOUT';
    vi.mocked(ntlmClient.executeNtlmRequest).mockRejectedValueOnce(timeoutError);

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    // Deve lançar Error não-EmailProviderError para classificação como UNCERTAIN
    await expect(provider.send(sampleRequest)).rejects.toThrow(/EWS_TRANSPORT_UNCERTAIN/u);
  });

  it('lança erro genérico (UNCERTAIN) em caso de conexão encerrada/resetada após envio', async () => {
    const resetError = new Error('ECONNRESET: Connection reset by peer');
    (resetError as { code?: string }).code = 'ECONNRESET';
    vi.mocked(ntlmClient.executeNtlmRequest).mockRejectedValueOnce(resetError);

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toThrow(/EWS_TRANSPORT_UNCERTAIN/u);
  });

  it('classifica HTTP 500 sem prova de rejeição como UNCERTAIN', async () => {
    vi.mocked(ntlmClient.executeNtlmRequest).mockResolvedValueOnce({
      statusCode: 500,
      headers: {},
      body: '<html><body>Internal Server Error</body></html>',
      statusMessage: 'Internal Server Error',
    });

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toThrow(/EWS_SERVER_5XX_UNCERTAIN/u);
  });

  it('classifica ResponseCode ErrorInvalidRecipients como INVALID_RECIPIENT', async () => {
    const errorXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Error">
          <m:MessageText>The recipient address is invalid.</m:MessageText>
          <m:ResponseCode>ErrorInvalidRecipients</m:ResponseCode>
          <m:Items/>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    vi.mocked(ntlmClient.executeNtlmRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: errorXml,
      statusMessage: 'OK',
    });

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toMatchObject({
      category: 'INVALID_RECIPIENT',
      code: 'ErrorInvalidRecipients',
    });
  });

  it('classifica ResponseCode ErrorServerBusy como TRANSIENT com SAME_ATTEMPT e PROVIDER_REJECTED', async () => {
    const busyXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Error">
          <m:MessageText>The server is busy.</m:MessageText>
          <m:ResponseCode>ErrorServerBusy</m:ResponseCode>
          <m:Items/>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    vi.mocked(ntlmClient.executeNtlmRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: busyXml,
      statusMessage: 'OK',
    });

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toMatchObject({
      category: 'TRANSIENT',
      code: 'ErrorServerBusy',
      retryMode: 'SAME_ATTEMPT',
      retrySafety: 'PROVIDER_REJECTED',
    });
  });

  it('classifica ResponseCode ErrorQuotaExceeded como QUOTA com SAME_ATTEMPT e PROVIDER_REJECTED', async () => {
    const quotaXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Error">
          <m:MessageText>Mailbox quota exceeded.</m:MessageText>
          <m:ResponseCode>ErrorQuotaExceeded</m:ResponseCode>
          <m:Items/>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    vi.mocked(ntlmClient.executeNtlmRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: quotaXml,
      statusMessage: 'OK',
    });

    const provider = new EwsEmailProvider({
      url: 'https://webmail.ifes.edu.br/EWS/Exchange.asmx',
      domain: 'UPD1',
      username: 'infra.sistema',
      password: 'secretPassword',
    });

    await expect(provider.send(sampleRequest)).rejects.toMatchObject({
      category: 'QUOTA',
      code: 'ErrorQuotaExceeded',
      retryMode: 'SAME_ATTEMPT',
      retrySafety: 'PROVIDER_REJECTED',
    });
  });
});
