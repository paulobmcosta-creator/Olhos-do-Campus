import { z } from 'zod';

export const locationSelectionSchema = z.object({
  campusId: z.string().trim().min(1, 'Informe o campus ou unidade.'),
  buildingId: z.string().trim().min(1, 'Informe o prédio ou área.'),
  floorId: z.string().trim().min(1, 'Informe o pavimento ou referência.'),
  roomId: z.string().trim().min(1, 'Informe o ambiente ou local.'),
  complement: z.string().trim().max(300, 'O complemento deve ter até 300 caracteres.').optional(),
  isOther: z.boolean().optional(),
  otherDescription: z.string().trim().max(300, 'A descrição do outro local deve ter até 300 caracteres.').optional(),
});

export const createOccurrenceSchema = z.object({
  location: locationSelectionSchema,
  categoryId: z.string().trim().min(1, 'Selecione uma categoria.'),
  description: z.string().trim().min(20, 'Descreva a situação com pelo menos 20 caracteres.').max(2000, 'A descrição deve ter até 2.000 caracteres.'),
  immediateRisk: z.boolean(),
});

export type OccurrenceFormValues = z.infer<typeof createOccurrenceSchema>;

export function validateOccurrenceForm(values: OccurrenceFormValues): Record<string, string> {
  const result = createOccurrenceSchema.safeParse(values);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    if (key !== '' && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}
