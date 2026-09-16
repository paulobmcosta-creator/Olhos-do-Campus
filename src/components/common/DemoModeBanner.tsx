import { FlaskConical } from 'lucide-react';

export function DemoModeBanner({ emulatorMode }: { emulatorMode: boolean }): React.JSX.Element | null {
  if (!emulatorMode) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p><strong>Ambiente local de desenvolvimento.</strong> Authentication, Firestore e Cloud Storage estão configurados para a Firebase Emulator Suite. Não utilize dados reais neste ambiente.</p>
      </div>
    </div>
  );
}
