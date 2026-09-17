import express from 'express';
import https from 'node:https';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ORIGIN = 'https://olhos-do-campus-hnwfymhsqq-uw.a.run.app';
const API_TARGET = new URL(API_ORIGIN);
const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
const HOST = '0.0.0.0';

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`PORT inválida: ${process.env.PORT ?? '8080'}`);
}

const rootDir = dirname(fileURLToPath(import.meta.url));
const clientDir = join(rootDir, 'dist', 'client');
const indexFile = join(clientDir, 'index.html');

if (!existsSync(indexFile)) {
  throw new Error('Frontend compilado não encontrado em dist/client/index.html. Execute npm run build antes de iniciar.');
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function isSameOriginRequest(request) {
  const origin = request.header('origin');
  if (origin === undefined) return true;

  const forwardedProto = request.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || request.protocol || 'https';
  const host = request.header('host');
  if (!host) return false;

  return origin === `${protocol}://${host}`;
}

function buildUpstreamHeaders(request) {
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    const lowerName = name.toLowerCase();
    if (value === undefined || HOP_BY_HOP_HEADERS.has(lowerName) || lowerName === 'origin' || lowerName === 'host') {
      continue;
    }
    headers[name] = value;
  }

  headers.host = API_TARGET.host;
  return headers;
}

function copyUpstreamResponseHeaders(upstreamResponse, response) {
  for (const [name, value] of Object.entries(upstreamResponse.headers)) {
    if (value === undefined || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    response.setHeader(name, value);
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use('/api', (request, response) => {
  if (!isSameOriginRequest(request)) {
    response.status(403).json({ error: 'Origem da solicitação não autorizada.' });
    return;
  }

  const upstreamUrl = new URL(request.originalUrl, API_TARGET);
  const upstreamRequest = https.request(
    {
      protocol: API_TARGET.protocol,
      hostname: API_TARGET.hostname,
      port: API_TARGET.port || 443,
      method: request.method,
      path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
      headers: buildUpstreamHeaders(request),
    },
    (upstreamResponse) => {
      response.status(upstreamResponse.statusCode ?? 502);
      copyUpstreamResponseHeaders(upstreamResponse, response);
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.on('error', (error) => {
    console.error('Falha no proxy para o backend canônico:', error);
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    response.status(502).json({ error: 'Falha ao acessar o backend canônico.' });
  });

  request.on('aborted', () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);
});

app.get('/__frontend_health', (_request, response) => {
  response.status(200).json({ status: 'ok', role: 'frontend', backend: API_ORIGIN });
});

app.use(express.static(clientDir, { index: 'index.html', fallthrough: true }));

app.get('*', (_request, response) => {
  response.sendFile(indexFile);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Frontend Olhos do Campus disponível em http://${HOST}:${PORT}.`);
  console.log(`Proxy /api direcionado para ${API_ORIGIN}.`);
});

function shutdown(signal) {
  console.log(`${signal} recebido; encerrando frontend.`);
  server.close((error) => {
    if (error) {
      console.error('Erro ao encerrar frontend:', error);
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
