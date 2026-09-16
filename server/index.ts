import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const [{ createApp }, { SERVER_ENV }] = await Promise.all([
  import('./app'),
  import('./config/env'),
]);

const app = createApp({ environment: SERVER_ENV });
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

if (SERVER_ENV.isProduction) {
  const clientDirectory = path.resolve(currentDirectory, '../client');
  app.use(express.static(clientDirectory, { index: false }));
  app.get('*', (_request, response) => response.sendFile(path.join(clientDirectory, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(SERVER_ENV.port, '0.0.0.0', () => {
  console.log(`Olhos do Campus disponível na porta ${SERVER_ENV.port}.`);
  console.log(`Persistência de ocorrências: Cloud Firestore (${SERVER_ENV.firebaseProjectId}/${SERVER_ENV.firestoreDatabaseId}).`);
  console.log(`Origem da configuração Firebase: ${SERVER_ENV.firebaseConfigurationSource}.`);
  console.log('Persistência de fotografias: Cloud Storage for Firebase via Firebase Admin SDK.');
  console.log(`Firebase Emulator Suite: ${SERVER_ENV.emulatorMode ? 'habilitada' : 'desabilitada'}.`);
  console.log(`App Check obrigatório: ${SERVER_ENV.appCheckEnforcement ? 'sim' : 'não'}.`);
});
