import type { EmailProvider, EmailSendRequest, EmailSendResult } from './emailProvider';
import { EmailProviderError } from './emailProvider';
import { buildCreateItemSoapRequest, parseEwsResponse } from './ews/ewsSoap';
import { executeNtlmRequest } from './ews/ntlmClient';

export interface EwsEmailProviderConfig {
  url: string;
  domain: string;
  username: string;
  password: string;
  timeoutMs?: number;
}

function safeSummary(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[endereço omitido]')
    .replace(/\b(?:password|senha|secret|auth|bearer|ntlm)\s*[:=]\s*[^\s]+/giu, '[credencial omitida]')
    .slice(0, 300);
}

export class EwsEmailProvider implements EmailProvider {
  public readonly name = 'ews' as const;

  public constructor(private readonly config: EwsEmailProviderConfig) {
    if (!config.url || typeof config.url !== 'string') {
      throw new EmailProviderError('CONFIGURATION', 'invalid_ews_url', 'A URL do EWS deve ser informada.');
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(config.url);
    } catch {
      throw new EmailProviderError('CONFIGURATION', 'invalid_ews_url', 'A URL do EWS informada é inválida.');
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new EmailProviderError('CONFIGURATION', 'invalid_ews_protocol', 'A URL do EWS deve utilizar estritamente o protocolo HTTPS.');
    }
    if (!parsedUrl.hostname || parsedUrl.hostname.trim() === '') {
      throw new EmailProviderError('CONFIGURATION', 'invalid_ews_hostname', 'A URL do EWS deve conter um hostname válido.');
    }
    if (parsedUrl.username !== '' || parsedUrl.password !== '') {
      throw new EmailProviderError('CONFIGURATION', 'invalid_ews_credentials_in_url', 'A URL do EWS não pode conter usuário ou senha embutidos. Use as variáveis secretas dedicadas.');
    }
    if (!config.username || config.username.trim() === '') {
      throw new EmailProviderError('CONFIGURATION', 'missing_ews_username', 'O usuário do EWS não está configurado.');
    }
    if (!config.password || config.password.trim() === '') {
      throw new EmailProviderError('CONFIGURATION', 'missing_ews_password', 'A senha do EWS não está configurada.');
    }
  }

  public async send(request: EmailSendRequest): Promise<EmailSendResult> {
    if (!request.message.to || !request.message.from || !request.message.subject) {
      throw new EmailProviderError('PERMANENT', 'invalid_email_message', 'Destinatário, remetente e assunto são obrigatórios.');
    }

    const soapBody = buildCreateItemSoapRequest({
      to: request.message.to,
      from: request.message.from,
      subject: request.message.subject,
      htmlBody: request.message.html || request.message.text,
    });

    let rawResponse: Awaited<ReturnType<typeof executeNtlmRequest>>;
    try {
      rawResponse = await executeNtlmRequest({
        url: this.config.url,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'http://schemas.microsoft.com/exchange/services/2006/messages/CreateItem',
        },
        body: soapBody,
        username: this.config.username,
        password: this.config.password,
        domain: this.config.domain || 'UPD1',
        timeoutMs: this.config.timeoutMs ?? 30_000,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string })?.code ?? '';

      // Erros de DNS ou conexão recusada comprovadamente prévios ao aceite:
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /ENOTFOUND|getaddrinfo/iu.test(message)) {
        throw new EmailProviderError('TRANSIENT', 'ews_dns_error', 'Falha de resolução DNS com o servidor EWS.', 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
      }
      if (code === 'ECONNREFUSED' || /ECONNREFUSED/iu.test(message)) {
        throw new EmailProviderError('TRANSIENT', 'ews_connection_refused', 'Conexão recusada pelo servidor EWS.', 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
      }
      if (/TLS|CERT|DEPTH_ZERO|UNABLE_TO_VERIFY/iu.test(message) || code.startsWith('CERT_')) {
        throw new EmailProviderError('CONFIGURATION', 'ews_tls_validation_failed', 'Falha na validação TLS do servidor EWS.');
      }
      if (/NTLM_HANDSHAKE_FAILED/iu.test(message)) {
        throw new EmailProviderError('CONFIGURATION', 'ews_authentication_failed', 'Falha de negociação NTLM com o servidor EWS.');
      }

      // Timeout, conexão resetada ou erro ambíguo de transporte após possível transmissão:
      // Deixar propagar erro não-EmailProviderError para classificação como UNCERTAIN pela outbox
      throw new Error(`EWS_TRANSPORT_UNCERTAIN: ${safeSummary(message)}`);
    }

    // Status HTTP de autenticação/autorização
    if (rawResponse.statusCode === 401 || rawResponse.statusCode === 403) {
      throw new EmailProviderError('CONFIGURATION', 'ews_auth_rejected', 'Autenticação NTLM rejeitada pelo servidor EWS.');
    }

    // Status HTTP 5xx sem garantia de rejeição
    if (rawResponse.statusCode >= 500) {
      try {
        const faultCheck = parseEwsResponse(rawResponse.body);
        if (faultCheck.isFault && faultCheck.faultCode) {
          const faultText = safeSummary(faultCheck.faultString ?? 'SOAP Fault');
          if (/ErrorInvalidSecurityToken|AccessDenied|AccountDisabled/iu.test(faultCheck.faultCode)) {
            throw new EmailProviderError('CONFIGURATION', 'ews_soap_fault_auth', faultText);
          }
          if (/ServerTooBusy/iu.test(faultCheck.faultCode)) {
            throw new EmailProviderError('TRANSIENT', 'ews_server_busy', faultText, 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
          }
          if (/QuotaExceeded/iu.test(faultCheck.faultCode)) {
            throw new EmailProviderError('QUOTA', 'ews_quota_exceeded', faultText, 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
          }
        }
      } catch (inner) {
        if (inner instanceof EmailProviderError) throw inner;
      }
      // Se não for possível provar que a mensagem não foi aceita: UNCERTAIN
      throw new Error(`EWS_SERVER_5XX_UNCERTAIN: Servidor EWS respondeu HTTP ${rawResponse.statusCode} sem prova inequívoca de não aceite.`);
    }

    // Parsing da resposta SOAP
    let parsed: ReturnType<typeof parseEwsResponse>;
    try {
      parsed = parseEwsResponse(rawResponse.body);
    } catch (parseError: unknown) {
      // Resposta inválida ou truncada após transmissão: UNCERTAIN
      throw new Error(`EWS_MALFORMED_RESPONSE_UNCERTAIN: ${safeSummary(parseError instanceof Error ? parseError.message : 'XML truncado')}`);
    }

    // Tratamento de SOAP Fault no HTTP 200
    if (parsed.isFault) {
      const faultText = safeSummary(parsed.faultString ?? 'SOAP Fault');
      const faultCode = parsed.faultCode ?? 'soap_fault';
      if (/ErrorInvalidSecurityToken|AccessDenied|AccountDisabled/iu.test(faultCode)) {
        throw new EmailProviderError('CONFIGURATION', 'ews_soap_fault_auth', faultText);
      }
      if (/ServerTooBusy/iu.test(faultCode)) {
        throw new EmailProviderError('TRANSIENT', 'ews_server_busy', faultText, 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
      }
      if (/QuotaExceeded/iu.test(faultCode)) {
        throw new EmailProviderError('QUOTA', 'ews_quota_exceeded', faultText, 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
      }
      throw new Error(`EWS_FAULT_UNCERTAIN: ${faultText}`);
    }

    // Sucesso confirmado
    if (parsed.responseClass === 'Success' && parsed.responseCode === 'NoError') {
      return {
        ...(parsed.itemId !== undefined && parsed.itemId !== '' ? { providerMessageId: parsed.itemId } : {}),
      };
    }

    // ResponseCodes de erro do Exchange
    const responseCode = parsed.responseCode ?? 'ErrorUnknown';
    const summary = safeSummary(parsed.messageText ?? `Erro ${responseCode} reportado pelo Exchange.`);

    if (/ErrorInvalidRecipients|ErrorNonExistentMailbox|ErrorInvalidInternetHeaderChildNodes|ErrorNameResolutionNoResults/iu.test(responseCode)) {
      throw new EmailProviderError('INVALID_RECIPIENT', responseCode, summary);
    }
    if (/ErrorAccountDisabled|ErrorAccessDenied|ErrorInvalidServerVersion|ErrorCrossSiteRequest/iu.test(responseCode)) {
      throw new EmailProviderError('CONFIGURATION', responseCode, summary);
    }
    if (/ErrorServerBusy|ErrorMailboxStoreUnavailable|ErrorMailboxMoveInProgress/iu.test(responseCode)) {
      throw new EmailProviderError('TRANSIENT', responseCode, summary, 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
    }
    if (/ErrorQuotaExceeded|ErrorExceededMaxConcurrency|ErrorSubmissionQuotaExceeded/iu.test(responseCode)) {
      throw new EmailProviderError('QUOTA', responseCode, summary, 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
    }
    if (/ErrorItemNotFound|ErrorCannotDeleteObject|ErrorIrresolvableConflict/iu.test(responseCode)) {
      throw new EmailProviderError('PERMANENT', responseCode, summary);
    }

    throw new EmailProviderError('PERMANENT', responseCode, summary);
  }
}
