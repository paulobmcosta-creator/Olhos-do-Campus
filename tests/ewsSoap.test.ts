import { describe, expect, it } from 'vitest';
import { buildCreateItemSoapRequest, escapeXml, parseEwsResponse } from '../server/providers/ews/ewsSoap';

describe('EWS SOAP - escapeXml', () => {
  it('escapa corretamente caracteres especiais de XML', () => {
    const raw = 'Teste & <tags> "aspas" \'simples\' \x00\x08';
    const escaped = escapeXml(raw);
    expect(escaped).toBe('Teste &amp; &lt;tags&gt; &quot;aspas&quot; &apos;simples&apos; ');
    expect(escaped).not.toContain('\x00');
    expect(escaped).not.toContain('\x08');
  });

  it('mantém quebras de linha e tabulações válidas', () => {
    const raw = 'Linha 1\nLinha 2\tTabulado\r\nFim';
    const escaped = escapeXml(raw);
    expect(escaped).toContain('\n');
    expect(escaped).toContain('\t');
    expect(escaped).toContain('\r\n');
  });
});

describe('EWS SOAP - buildCreateItemSoapRequest', () => {
  it('gera envelope SOAP 1.1 válido com MessageDisposition="SendAndSaveCopy"', () => {
    const xml = buildCreateItemSoapRequest({
      to: 'servidor@ifes.edu.br',
      from: 'sistema@ifes.edu.br',
      subject: 'Nova ocorrência 2026.0001',
      htmlBody: '<h1>Ocorrência Criada</h1><p>Detalhes & informações</p>',
    });

    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<soap:Envelope');
    expect(xml).toContain('<m:CreateItem MessageDisposition="SendAndSaveCopy">');
    expect(xml).toContain('<m:SavedItemFolderId>');
    expect(xml).toContain('<t:DistinguishedFolderId Id="sentitems"/>');
    expect(xml).toContain('<t:ItemClass>IPM.Note</t:ItemClass>');
    expect(xml).toContain('<t:Subject>Nova ocorrência 2026.0001</t:Subject>');
    expect(xml).toContain('<t:Body BodyType="HTML">&lt;h1&gt;Ocorrência Criada&lt;/h1&gt;&lt;p&gt;Detalhes &amp; informações&lt;/p&gt;</t:Body>');
    expect(xml).toContain('<t:EmailAddress>servidor@ifes.edu.br</t:EmailAddress>');
    expect(xml).toContain('<t:EmailAddress>sistema@ifes.edu.br</t:EmailAddress>');
  });
});

describe('EWS SOAP - parseEwsResponse', () => {
  it('faz parse com sucesso de resposta CreateItemResponseMessage com NoError e ItemId', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Success">
          <m:ResponseCode>NoError</m:ResponseCode>
          <m:Items>
            <t:Message>
              <t:ItemId Id="AAMkADExMjM=" ChangeKey="CQAAABY="/>
            </t:Message>
          </m:Items>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    const parsed = parseEwsResponse(xml);
    expect(parsed.isFault).toBe(false);
    expect(parsed.responseClass).toBe('Success');
    expect(parsed.responseCode).toBe('NoError');
    expect(parsed.itemId).toBe('AAMkADExMjM=');
  });

  it('faz parse de resposta CreateItemResponseMessage sem ItemId (SendAndSaveCopy padrão)', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Success">
          <m:ResponseCode>NoError</m:ResponseCode>
          <m:Items/>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    const parsed = parseEwsResponse(xml);
    expect(parsed.isFault).toBe(false);
    expect(parsed.responseClass).toBe('Success');
    expect(parsed.responseCode).toBe('NoError');
    expect(parsed.itemId).toBeUndefined();
  });

  it('faz parse de SOAP Fault estruturado', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <s:Fault>
      <faultcode xmlns:a="http://schemas.microsoft.com/exchange/services/2006/types">a:ErrorInvalidSecurityToken</faultcode>
      <faultstring>O token de segurança é inválido.</faultstring>
    </s:Fault>
  </s:Body>
</s:Envelope>`;

    const parsed = parseEwsResponse(xml);
    expect(parsed.isFault).toBe(true);
    expect(parsed.faultCode).toContain('ErrorInvalidSecurityToken');
    expect(parsed.faultString).toBe('O token de segurança é inválido.');
  });

  it('faz parse de erro ResponseClass="Error" com ResponseCode específico', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
      <m:ResponseMessages>
        <m:CreateItemResponseMessage ResponseClass="Error">
          <m:MessageText>The specified recipient is invalid.</m:MessageText>
          <m:ResponseCode>ErrorInvalidRecipients</m:ResponseCode>
          <m:DescriptiveLinkKey>0</m:DescriptiveLinkKey>
          <m:Items/>
        </m:CreateItemResponseMessage>
      </m:ResponseMessages>
    </m:CreateItemResponse>
  </s:Body>
</s:Envelope>`;

    const parsed = parseEwsResponse(xml);
    expect(parsed.isFault).toBe(false);
    expect(parsed.responseClass).toBe('Error');
    expect(parsed.responseCode).toBe('ErrorInvalidRecipients');
    expect(parsed.messageText).toBe('The specified recipient is invalid.');
  });

  it('rejeita tentativa de injeção XXE com DTD/DOCTYPE', () => {
    const xxeXml = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body><foo>&xxe;</foo></s:Body>
</s:Envelope>`;

    expect(() => parseEwsResponse(xxeXml)).toThrow(/EWS_SECURITY_VIOLATION/iu);
  });

  it('lança erro para resposta vazia ou malformada', () => {
    expect(() => parseEwsResponse('')).toThrow(/EWS_EMPTY_RESPONSE/iu);
    expect(() => parseEwsResponse('<s:Envelope>resposta truncada')).toThrow(/EWS_INVALID_RESPONSE/iu);
  });
});
