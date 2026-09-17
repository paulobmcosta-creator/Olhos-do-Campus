import type { NotificationRetryMode, NotificationRetrySafety } from '../models/notificationDomain';

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSendRequest {
  message: EmailMessage;
  idempotencyKey: string;
  notificationId: string;
  attemptId: string;
}

export interface EmailSendResult {
  providerMessageId?: string;
  quotaRemaining?: number;
  quotaResetAt?: Date;
}

export interface EmailProvider {
  readonly name: 'resend' | 'ews';
  send(request: EmailSendRequest): Promise<EmailSendResult>;
}

export class EmailProviderError extends Error {
  public constructor(
    public readonly category: 'PERMANENT' | 'TRANSIENT' | 'QUOTA' | 'CONFIGURATION' | 'INVALID_RECIPIENT' | 'SUPPRESSED',
    public readonly code: string,
    message: string,
    public readonly retryMode?: NotificationRetryMode,
    public readonly retrySafety?: NotificationRetrySafety,
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}
