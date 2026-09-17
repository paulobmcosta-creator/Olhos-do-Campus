import 'dotenv/config';

const [{ createApp }, { SERVER_ENV }] = await Promise.all([
  import('./app'),
  import('./config/env'),
]);

const app = createApp({ environment: SERVER_ENV });
if (!SERVER_ENV.isProduction) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(SERVER_ENV.port, '0.0.0.0', () => {
  console.log(`API Olhos do Campus disponível na porta ${SERVER_ENV.port}.`);
  console.log(`Persistência de ocorrências: Cloud Firestore (${SERVER_ENV.firebaseProjectId}/${SERVER_ENV.firestoreDatabaseId}).`);
  console.log(`Origem da configuração Firebase: ${SERVER_ENV.firebaseConfigurationSource}.`);
  console.log(`Persistência principal de fotografias: ${SERVER_ENV.photoStorageProvider === 'r2' ? 'Cloudflare R2' : 'Firebase Storage Emulator/legado'}.`);
  console.log(`Frontend produtivo: Cloudflare Pages (não servido por este processo).`);
  console.log(`Firebase Emulator Suite: ${SERVER_ENV.emulatorMode ? 'habilitada' : 'desabilitada'}.`);
  console.log(`App Check obrigatório: ${SERVER_ENV.appCheckEnforcement ? 'sim' : 'não'}.`);
});
