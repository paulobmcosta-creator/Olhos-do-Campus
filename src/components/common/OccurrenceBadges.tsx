import type { OccurrencePriority, OccurrenceStatus } from '../../models/occurrence';

const PRIORITY_EXPLANATIONS: Record<OccurrencePriority, string> = {
  Baixa: 'Pequeno impacto, sem comprometimento relevante do uso, continuidade ou segurança.',
  Normal: 'Ocorrência ordinária de manutenção, sem necessidade de tratamento prioritário.',
  Alta: 'Impacto relevante no uso do ambiente ou atividade, sem indicação de risco imediato.',
  Urgente: 'Exige priorização por impacto operacional relevante ou indicação de risco imediato sujeita à triagem.',
  Emergencial: 'Situação confirmada administrativamente com potencial de dano imediato a pessoas, patrimônio ou funcionamento essencial.',
};

const STATUS_EXPLANATIONS: Record<OccurrenceStatus, string> = {
  'Recebida': 'Ocorrência registrada e ainda não submetida à triagem administrativa.',
  'Em triagem': 'A equipe confere categoria, local, risco, prioridade e encaminhamento.',
  'Em análise': 'A ocorrência está em avaliação técnica ou administrativa para definição da providência.',
  'Encaminhada ao setor responsável': 'Uma equipe ou setor foi formalmente indicada, sem pressupor que a execução já começou.',
  'Em atendimento': 'Existe atuação efetiva sobre a providência.',
  'Aguardando material': 'A providência depende de material, peça ou insumo; o SLA efetivo de conclusão fica pausado.',
  'Aguardando contratação ou serviço externo': 'A providência depende de contratação, fornecedor ou agente externo; o SLA efetivo de conclusão fica pausado.',
  'Resolvida': 'A providência foi concluída e o problema considerado solucionado.',
  'Não procedente': 'Após análise, não foi confirmada providência de infraestrutura aplicável ou a demanda não pertence ao escopo.',
  'Duplicada': 'O mesmo problema já está sendo tratado em outra ocorrência.',
  'Cancelada': 'Ocorrência encerrada administrativamente por motivo diferente de duplicidade ou não procedência.',
};

export function StatusBadge({ status }: { status: OccurrenceStatus }): React.JSX.Element {
  return <span className="inline-flex border border-slate-400 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800" title={STATUS_EXPLANATIONS[status]} aria-label={`${status}: ${STATUS_EXPLANATIONS[status]}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: OccurrencePriority }): React.JSX.Element {
  const style = priority === 'Emergencial' || priority === 'Urgente'
    ? 'border-red-400 bg-red-50 text-red-900'
    : priority === 'Alta'
      ? 'border-amber-400 bg-amber-50 text-amber-900'
      : 'border-slate-400 bg-slate-100 text-slate-800';
  return <span className={`inline-flex border px-2 py-1 text-xs font-semibold ${style}`} title={PRIORITY_EXPLANATIONS[priority]} aria-label={`${priority}: ${PRIORITY_EXPLANATIONS[priority]}`}>{priority}</span>;
}
