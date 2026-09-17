import type { AuthorizedAdminProfile } from '../../src/models/admin';
import type { AdminUserRepository } from '../repositories/adminUserRepository';
import type { AuditLogRepository } from '../repositories/auditLogRepository';
import { HttpError } from '../types/errors';
import type { VerifiedFirebaseUser } from '../types/firebase';
import { emailDomain, normalizeEmail } from '../utils/email';

export class AdminAuthorizationService {
  private readonly allowedDomains: Set<string>;

  public constructor(
    private readonly users: AdminUserRepository,
    private readonly auditLogs: AuditLogRepository,
    allowedDomains: readonly string[],
  ) {
    this.allowedDomains = new Set(allowedDomains.map((domain) => domain.toLowerCase()));
  }

  public async authorize(
    firebaseUser: VerifiedFirebaseUser,
    correlationId: string,
    recordAuthorizedLogin = false,
  ): Promise<AuthorizedAdminProfile> {
    if (firebaseUser.provider !== 'google.com') {
      await this.auditDenied(firebaseUser, correlationId, 'Provedor de autenticação não autorizado.');
      throw new HttpError(403, 'PROVIDER_NOT_ALLOWED', 'O acesso administrativo exige autenticação com Google.');
    }
    if (firebaseUser.email === undefined || firebaseUser.email.trim() === '') {
      await this.auditDenied(firebaseUser, correlationId, 'Conta autenticada sem endereço eletrônico verificável.');
      throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'A conta Google não forneceu um endereço eletrônico verificável.');
    }
    if (!firebaseUser.emailVerified) {
      await this.auditDenied(firebaseUser, correlationId, 'Endereço eletrônico não verificado.');
      throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'O endereço eletrônico da conta Google precisa estar verificado.');
    }

    const normalizedEmail = normalizeEmail(firebaseUser.email);
    if (!this.allowedDomains.has(emailDomain(normalizedEmail))) {
      await this.auditDenied(firebaseUser, correlationId, 'Domínio administrativo não autorizado.', normalizedEmail);
      throw new HttpError(403, 'DOMAIN_NOT_ALLOWED', 'O domínio da conta Google não está autorizado para a área administrativa.');
    }

    const result = await this.users.authorizeLogin(normalizedEmail, firebaseUser.uid, recordAuthorizedLogin);
    if (result.status === 'not-found') {
      await this.auditDenied(firebaseUser, correlationId, 'Usuário não previamente autorizado.', normalizedEmail);
      throw new HttpError(403, 'ADMIN_NOT_AUTHORIZED', 'A conta está autenticada, mas não possui autorização administrativa ativa.');
    }
    if (result.status === 'inactive') {
      await this.auditDenied(firebaseUser, correlationId, 'Cadastro administrativo inativo.', normalizedEmail);
      throw new HttpError(403, 'ADMIN_INACTIVE', 'O cadastro administrativo está inativo.');
    }
    if (result.status === 'uid-mismatch') {
      await this.auditDenied(firebaseUser, correlationId, 'UID divergente do vínculo administrativo.', normalizedEmail);
      throw new HttpError(403, 'UID_MISMATCH', 'A conta autenticada não corresponde ao vínculo administrativo registrado.');
    }

    if (result.status === 'legacy-role') {
      await this.auditDenied(firebaseUser, correlationId, 'Cadastro com papel legado aguardando decisão administrativa.', normalizedEmail);
      throw new HttpError(403, 'LEGACY_ROLE_REQUIRES_RESOLUTION', 'O cadastro possui um papel administrativo legado. Um Administrador deve convertê-lo explicitamente para Gestor, ativá-lo como Atendente ou inativá-lo.');
    }

    if (result.uidBound) {
      await this.auditLogs.write({
        eventType: 'ADMIN_UID_BOUND',
        actorUid: firebaseUser.uid,
        actorEmail: normalizedEmail,
        actorRole: result.user.role,
        targetType: 'adminUser',
        targetId: result.user.id,
        summary: 'UID Firebase vinculado ao cadastro administrativo no primeiro acesso autorizado.',
        requestCorrelationId: correlationId,
      });
    }
    if (recordAuthorizedLogin) {
      await this.auditLogs.write({
        eventType: 'ADMIN_LOGIN_AUTHORIZED',
        actorUid: firebaseUser.uid,
        actorEmail: normalizedEmail,
        actorRole: result.user.role,
        targetType: 'adminSession',
        targetId: result.user.id,
        summary: 'Acesso administrativo autorizado.',
        requestCorrelationId: correlationId,
      });
    }

    return {
      id: result.user.id,
      uid: firebaseUser.uid,
      email: normalizedEmail,
      displayName: result.user.displayName || firebaseUser.displayName || normalizedEmail,
      role: result.user.role,
      ...(result.user.department === undefined ? {} : { department: result.user.department }),
      teamIds: result.user.teamIds,
      active: true,
      ...(result.user.lastAuthorizedLoginAt === undefined
        ? {}
        : { lastAuthorizedLoginAt: result.user.lastAuthorizedLoginAt }),
    };
  }

  private async auditDenied(
    firebaseUser: VerifiedFirebaseUser,
    correlationId: string,
    summary: string,
    normalizedEmail?: string,
  ): Promise<void> {
    try {
      await this.auditLogs.write({
        eventType: 'ADMIN_LOGIN_DENIED',
        actorUid: firebaseUser.uid,
        ...(normalizedEmail === undefined ? {} : { actorEmail: normalizedEmail }),
        targetType: 'security',
        summary,
        requestCorrelationId: correlationId,
      });
    } catch (error) {
      console.error('Falha ao registrar auditoria de acesso negado:', error);
    }
  }
}
