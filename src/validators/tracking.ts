import { z } from 'zod';

export const trackingSchema = z.object({
  protocol: z
    .string()
    .trim()
    .min(1, 'Informe o protocolo.')
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{4}-\d{6}$/i, 'Informe um protocolo no formato INF-2026-000001.'),
  trackingKey: z
    .string()
    .trim()
    .min(1, 'Informe a chave de acompanhamento.')
    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i, 'Informe a chave no formato XXXX-XXXX-XXXX.'),
});
