import { describe, expect, it } from 'vitest';
import { EwsEmailProvider } from '../server/providers/ewsEmailProvider';

export function validateEwsIntegrationConfig(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  domain: string;
  username: string;
  password: string;
  from: string;
  to: string;
} {
  const url = env.EWS_URL || 'https://webmail.ifes.edu.br/EWS/Exchange.asmx';
  const domain = env.EWS_DOMAIN || 'UPD1';
  const username = env.EWS_USERNAME;
  const password = env.EWS_PASSWORD;
  const from = env.EWS_FROM;
  const to = env.EWS_TEST_RECIPIENT;

  if (!username || !password || !from || !to) {
    throw new Error('EWS_USERNAME, EWS_PASSWORD, EWS_FROM e EWS_TEST_RECIPIENT são necessários para o teste de integração real.');
  }

  return { url, domain, username, password, from, to };
}

const runIntegration = process.env.RUN_EWS_INTEGRATION === 'true';

describe('EWS Real Integration (Opt-In)', () => {
  it('exige EWS_TEST_RECIPIENT explicitamente sem fallback silencioso para EWS_FROM', () => {
    expect(() =>
      validateEwsIntegrationConfig({
        EWS_USERNAME: 'test-user',
        EWS_PASSWORD: 'test-password',
        EWS_FROM: 'remetente@ifes.edu.br',
        // EWS_TEST_RECIPIENT ausente propositalmente
      }),
    ).toThrow('EWS_USERNAME, EWS_PASSWORD, EWS_FROM e EWS_TEST_RECIPIENT são necessários para o teste de integração real.');
  });

  const testFn = runIntegration ? it : it.skip;

  testFn('estabelece handshake NTLM e despacha CreateItem SOAP com SendAndSaveCopy para o Exchange real', async () => {
    const { url, domain, username, password, from, to } = validateEwsIntegrationConfig();

    const provider = new EwsEmailProvider({
      url,
      domain,
      username,
      password,
      timeoutMs: 45_000,
    });

    const now = new Date();
    const result = await provider.send({
      message: {
        to,
        from,
        subject: `[TESTE EWS] Verificação de integração 0.7.7 - ${now.toISOString()}`,
        text: 'Este é um teste automatizado de integração EWS com autenticação NTLM para o Sistema Institucional de Manutenção da Infraestrutura Física.',
        html: '<h2>Teste Automatizado EWS</h2><p>Handshake NTLM e envio SOAP <strong>SendAndSaveCopy</strong> concluídos com sucesso.</p>',
      },
      idempotencyKey: `ews-integration-test/${now.getTime()}`,
      notificationId: '0000000000000000000000000000000000000000000000000000000000000000',
      attemptId: '0000000000000000000000000000000000000000000000000000000000000001',
    });

    expect(result).toBeDefined();
  });
});

