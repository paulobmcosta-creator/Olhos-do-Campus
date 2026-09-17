export function escapeXml(value: string): string {
  return value
    .replace(/[^\t\n\r\x20-\uD7FF\uE000-\uFFFD]/gu, '') // Remove caracteres de controle inválidos em XML 1.0
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export interface BuildCreateItemOptions {
  to: string;
  from: string;
  subject: string;
  htmlBody: string;
}

export function buildCreateItemSoapRequest(options: BuildCreateItemOptions): string {
  const escapedTo = escapeXml(options.to);
  const escapedFrom = escapeXml(options.from);
  const escapedSubject = escapeXml(options.subject);
  const escapedHtml = escapeXml(options.htmlBody);

  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" ' +
    'xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" ' +
    'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soap:Header>' +
    '<t:RequestServerVersion Version="Exchange2013"/>' +
    '</soap:Header>' +
    '<soap:Body>' +
    '<m:CreateItem MessageDisposition="SendAndSaveCopy">' +
    '<m:SavedItemFolderId>' +
    '<t:DistinguishedFolderId Id="sentitems"/>' +
    '</m:SavedItemFolderId>' +
    '<m:Items>' +
    '<t:Message>' +
    '<t:ItemClass>IPM.Note</t:ItemClass>' +
    `<t:Subject>${escapedSubject}</t:Subject>` +
    `<t:Body BodyType="HTML">${escapedHtml}</t:Body>` +
    '<t:ToRecipients>' +
    '<t:Mailbox>' +
    `<t:EmailAddress>${escapedTo}</t:EmailAddress>` +
    '</t:Mailbox>' +
    '</t:ToRecipients>' +
    '<t:From>' +
    '<t:Mailbox>' +
    `<t:EmailAddress>${escapedFrom}</t:EmailAddress>` +
    '</t:Mailbox>' +
    '</t:From>' +
    '</t:Message>' +
    '</m:Items>' +
    '</m:CreateItem>' +
    '</soap:Body>' +
    '</soap:Envelope>'
  );
}

export interface EwsParsedResponse {
  isFault: boolean;
  faultCode?: string;
  faultString?: string;
  responseClass?: 'Success' | 'Warning' | 'Error';
  responseCode?: string;
  messageText?: string;
  itemId?: string;
}

export function parseEwsResponse(xml: string): EwsParsedResponse {
  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error('EWS_EMPTY_RESPONSE: A resposta SOAP recebida está vazia.');
  }

  // Prevenção contra XXE: rejeitar DTD ou entidades externas
  if (/<!DOCTYPE/iu.test(xml) || /<!ENTITY/iu.test(xml)) {
    throw new Error('EWS_SECURITY_VIOLATION: DTD ou declarações de entidades não são permitidas no envelope SOAP.');
  }

  // Verificar SOAP Fault
  if (/<(?:\w+:)?Fault\b/iu.test(xml)) {
    const faultCodeMatch = /<(?:\w+:)?faultcode\b[^>]*>([\s\S]*?)<\/(?:\w+:)?faultcode>/iu.exec(xml);
    const faultStringMatch = /<(?:\w+:)?faultstring\b[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/iu.exec(xml);
    return {
      isFault: true,
      faultCode: faultCodeMatch?.[1]?.trim(),
      faultString: faultStringMatch?.[1]?.trim() ?? 'SOAP Fault retornado pelo servidor Exchange.',
    };
  }

  // Verificar CreateItemResponseMessage
  const messageMatch = /<(?:\w+:)?CreateItemResponseMessage\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?CreateItemResponseMessage>/iu.exec(xml);
  if (messageMatch === null) {
    throw new Error('EWS_INVALID_RESPONSE: Resposta SOAP não contém elemento CreateItemResponseMessage reconhecível.');
  }

  const attributes = messageMatch[1] ?? '';
  const innerContent = messageMatch[2] ?? '';

  const responseClassMatch = /ResponseClass\s*=\s*"([^"]+)"/iu.exec(attributes);
  const rawClass = responseClassMatch?.[1]?.trim();
  const responseClass = (rawClass === 'Success' || rawClass === 'Warning' || rawClass === 'Error')
    ? rawClass
    : undefined;

  const responseCodeMatch = /<(?:\w+:)?ResponseCode>([\s\S]*?)<\/(?:\w+:)?ResponseCode>/iu.exec(innerContent);
  const responseCode = responseCodeMatch?.[1]?.trim();

  const messageTextMatch = /<(?:\w+:)?MessageText>([\s\S]*?)<\/(?:\w+:)?MessageText>/iu.exec(innerContent);
  const messageText = messageTextMatch?.[1]?.trim();

  const itemIdMatch = /<(?:\w+:)?ItemId\b[^>]*\bId\s*=\s*"([^"]+)"/iu.exec(innerContent);
  const itemId = itemIdMatch?.[1]?.trim();

  return {
    isFault: false,
    responseClass,
    responseCode,
    messageText,
    itemId,
  };
}
