const steps = ['Fotografia', 'Local', 'Categoria', 'Detalhes', 'Revisão', 'Confirmação'] as const;

export function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps?: number }): React.JSX.Element {
  const resolvedTotal = totalSteps ?? 5;
  const currentStepName = steps[currentStep - 1] ?? `Etapa ${currentStep}`;

  return (
    <nav aria-label="Etapas do registro">
      {/* Visualização para telas estreitas (< sm) */}
      <div className="space-y-2 rounded border border-slate-300 bg-white p-3 sm:hidden" role="group" aria-label="Progresso do formulário">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">
            Etapa <strong className="text-slate-900">{currentStep}</strong> de {resolvedTotal}
          </span>
          <span className="font-bold text-green-900" aria-current="step">
            {currentStepName}
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: resolvedTotal }).map((_, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            return (
              <div
                key={stepNum}
                className={`h-2 flex-1 rounded-sm transition-colors ${
                  isCurrent
                    ? 'bg-green-800'
                    : isCompleted
                      ? 'bg-green-600'
                      : 'bg-slate-200'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Visualização para telas médias e amplas (>= sm) */}
      <div className="hidden sm:block overflow-x-auto">
        <ol className="flex min-w-max gap-2 pb-1">
          {steps.slice(0, resolvedTotal).map((label, index) => {
            const stepNumber = index + 1;
            const active = stepNumber === currentStep;
            const completed = stepNumber < currentStep;
            return (
              <li
                key={label}
                aria-current={active ? 'step' : undefined}
                className={`flex min-h-10 items-center gap-2 border px-3 text-xs font-semibold ${
                  active
                    ? 'border-green-800 bg-green-800 text-white'
                    : completed
                      ? 'border-green-300 bg-green-50 text-green-900'
                      : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                <span aria-hidden="true">{stepNumber}.</span>
                {label}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
