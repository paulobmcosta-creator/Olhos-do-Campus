import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/config/version';

const projectRoot = process.cwd();
const activeRoots = ['src', 'server', 'scripts'];
const activeFiles = ['index.html', 'metadata.json', 'package.json', '.env.example', 'firebase.json', 'firebase-blueprint.json', 'firestore.rules', 'storage.rules'];

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

function activeSource(): string {
  const files = [
    ...activeRoots.flatMap((root) => collectFiles(join(projectRoot, root))),
    ...activeFiles.map((file) => join(projectRoot, file)),
  ];
  return files.map((file) => readFileSync(file, 'utf8')).join('\n');
}

function hash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('políticas institucionais, segurança e ambiente', () => {
  it('não contém a marca anterior nem promessa indevida de anonimato', () => {
    const source = activeSource();
    expect(source).not.toContain(['Infra', 'Report'].join(''));
    const lower = source.toLocaleLowerCase('pt-BR');
    for (const expression of [['100%', ' anônimo'].join(''), ['anonimato', ' absoluto'].join(''), ['denúncia', ' anônima'].join('')]) {
      expect(lower).not.toContain(expression);
    }
  });

  it('contém a terminologia institucional aprovada', () => {
    const source = activeSource();
    expect(source).toContain('Olhos do Campus');
    expect(source).toContain('Sistema Institucional de Manutenção da Infraestrutura Física');
    expect(source).toContain('registro sem identificação pessoal obrigatória');
  });

  it('não mantém endpoints, perfis ou tokens da autenticação demonstrativa', () => {
    const source = activeSource();
    for (const expression of ['/api/auth/demo-users', '/api/auth/login', 'INITIAL_ADMIN_USERS', 'DemoAdminRoute', "'demo-'", 'session.token']) {
      expect(source).not.toContain(expression);
    }
  });

  it('não armazena ID Token manualmente no navegador', () => {
    const frontend = collectFiles(join(projectRoot, 'src')).map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(frontend).not.toMatch(/(?:localStorage|sessionStorage)\.(?:setItem|getItem)\s*\(/u);
  });

  it('mantém npm como único gerenciador e não contém bun.lock', () => {
    expect(existsSync(join(projectRoot, 'package-lock.json'))).toBe(true);
    expect(existsSync(join(projectRoot, 'bun.lock'))).toBe(false);
    expect(existsSync(join(projectRoot, 'yarn.lock'))).toBe(false);
    expect(existsSync(join(projectRoot, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('mantém regras restritivas para Firestore e Storage', () => {
    const firestore = readFileSync(join(projectRoot, 'firestore.rules'), 'utf8');
    const storage = readFileSync(join(projectRoot, 'storage.rules'), 'utf8');
    expect(firestore).toContain('allow read, write: if false');
    expect(storage).toContain('allow read, write: if false');
    expect(firestore).not.toContain('if true');
    expect(storage).not.toContain('if true');
  });

  it('não contém segredo em .env.example nem arquivos reais de ambiente', () => {
    const example = readFileSync(join(projectRoot, '.env.example'), 'utf8');
    expect(example).not.toContain(['BEGIN', ' PRIVATE KEY'].join(''));
    expect(example).not.toMatch(/private_key\s*=/iu);
    expect(example).not.toMatch(/client_email\s*=/iu);
    for (const file of ['.env', '.env.local', 'service-account.json', 'firebase-admin.json']) {
      expect(existsSync(join(projectRoot, file))).toBe(false);
    }
  });

  it('preserva byte a byte os quatro arquivos de marca institucional', () => {
    const horizontal = 'b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731';
    const vertical = 'a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427';
    expect(hash(join(projectRoot, 'public/brand/originals/bsf-horizontal-cor.jpg'))).toBe(horizontal);
    expect(hash(join(projectRoot, 'public/brand/ifes-bsf-horizontal.jpg'))).toBe(horizontal);
    expect(hash(join(projectRoot, 'public/brand/originals/bsf-vertical-cor.jpg'))).toBe(vertical);
    expect(hash(join(projectRoot, 'public/brand/ifes-bsf-vertical.jpg'))).toBe(vertical);
  });

  it('mantém a versão ativa coerente nos metadados e no contrato de runtime', () => {
    expect(JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).version).toBe(APP_VERSION);
    expect(JSON.parse(readFileSync(join(projectRoot, 'metadata.json'), 'utf8')).version).toBe(APP_VERSION);
    expect(JSON.parse(readFileSync(join(projectRoot, 'firebase-blueprint.json'), 'utf8')).version).toBe(APP_VERSION);
    expect(readFileSync(join(projectRoot, 'src/config/version.ts'), 'utf8')).toContain(`'${APP_VERSION}'`);
  });

  it('mantém as remediações de dependências de segurança herdadas da 0.5.1 fixadas no lockfile', () => {
    const manifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; overrides?: Record<string, unknown> };
    const lock = JSON.parse(readFileSync(join(projectRoot, 'package-lock.json'), 'utf8')) as { packages?: Record<string, { version?: string }> };
    expect(manifest.dependencies?.sharp).toBe('0.35.4');
    expect(manifest.overrides).toMatchObject({
      '@opentelemetry/core': '2.8.0',
      gaxios: { uuid: '11.1.1' },
      'teeny-request': { uuid: '11.1.1' },
    });
    expect(lock.packages?.['node_modules/sharp']?.version).toBe('0.35.4');
    expect(lock.packages?.['node_modules/uuid']?.version).toBe('11.1.1');
    expect(lock.packages?.['node_modules/nanoid']?.version).toBe('3.3.18');
    expect(lock.packages?.['node_modules/@opentelemetry/core']?.version).toBe('2.8.0');
  });



  it('mantém a integração AI Studio sem dependência Gemini e com banco nomeado explícito', () => {
    const metadata = JSON.parse(readFileSync(join(projectRoot, 'metadata.json'), 'utf8')) as { majorCapabilities?: string[] };
    expect(metadata.majorCapabilities ?? []).not.toContain('MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API');
    const applet = JSON.parse(readFileSync(join(projectRoot, 'firebase-applet-config.json'), 'utf8')) as { projectId?: string; firestoreDatabaseId?: string };
    expect(applet.projectId).toBe('gen-lang-client-0120954905');
    expect(applet.firestoreDatabaseId).toBe('ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf');
    expect(existsSync(join(projectRoot, 'firebase.ai-studio.json'))).toBe(false);
    const runtime = readFileSync(join(projectRoot, 'server/config/firebaseRuntime.ts'), 'utf8');
    expect(runtime).toContain('firebase-applet-config.json');
    expect(runtime).toContain('somente pode ser utilizado com Firebase Emulator Suite');
  });

  it('mantém o blueprint alinhado ao domínio persistente e fotografias 0.5.x', () => {
    const blueprint = readFileSync(join(projectRoot, 'firebase-blueprint.json'), 'utf8');
    expect(blueprint).toContain('assignedToAdminUserId');
    expect(blueprint).toContain('lastSequence');
    expect(blueprint).toContain('/systemSettings/operational');
    expect(blueprint).not.toContain('"assignedTo"');
    expect(blueprint).not.toContain('"sequence"');
    expect(blueprint).not.toContain('REGISTRADA');
  });

  it('não mantém InMemoryDatabase, chave na URL nem Data URL no repositório Firestore', () => {
    const source = activeSource();
    expect(source).not.toContain('class InMemoryDatabase');
    expect(readFileSync(join(projectRoot, 'server/routes/apiRoutes.ts'), 'utf8')).not.toContain("router.get('/occurrences/:protocol'");
    expect(readFileSync(join(projectRoot, 'server/repositories/occurrenceRepository.ts'), 'utf8')).not.toContain('photoDataUrl');
    expect(readFileSync(join(projectRoot, 'server/repositories/occurrenceRepository.ts'), 'utf8')).not.toContain('solutionPhotoDataUrl');
    expect(readFileSync(join(projectRoot, 'server/config/env.ts'), 'utf8')).toContain('process.env.PORT');
  });

  it('exige App Check em produção e falha para configuração Firebase parcial', () => {
    const serverEnv = readFileSync(join(projectRoot, 'server/config/env.ts'), 'utf8');
    const frontendEnv = readFileSync(join(projectRoot, 'src/config/firebaseEnvironment.ts'), 'utf8');
    expect(serverEnv).toContain('APP_CHECK_ENFORCEMENT deve ser true em produção');
    expect(serverEnv).toContain('A configuração de emuladores está parcial');
    expect(frontendEnv).toContain('VITE_APP_CHECK_ENABLED deve ser true em produção');
    expect(frontendEnv).toContain('Configuração Firebase do frontend inválida ou parcial');
  });
});
