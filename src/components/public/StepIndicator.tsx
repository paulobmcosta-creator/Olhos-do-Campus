const steps = ['Fotografia', 'Local', 'Categoria', 'Detalhes', 'Revisão', 'Confirmação'] as const;

export function StepIndicator({ currentStep }: { currentStep: number; totalSteps?: number }): React.JSX.Element {
  return (
    <nav aria-label="Etapas do registro" className="overflow-x-auto">
      <ol className="flex min-w-max gap-2 pb-1">
        {steps.map((label, index) => {
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
    </nav>
  );
}
