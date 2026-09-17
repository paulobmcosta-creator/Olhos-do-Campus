import { BRANDING } from '../../config/branding';
import { APP_VERSION } from '../../config/version';
import { useAppData } from '../../context/AppDataContext';

export function Footer(): React.JSX.Element {
  const { data } = useAppData();
  const institution = data?.config.institutionDisplayName ?? BRANDING.institution;

  return (
    <footer className="mt-auto border-t border-slate-300 bg-slate-100">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 text-sm text-slate-700 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <p className="font-semibold text-slate-900">{BRANDING.publicName}</p>
          <p>{BRANDING.officialName}</p>
          <p className="mt-2 max-w-3xl text-xs leading-5">
            Canal exclusivo para registro, gerenciamento e acompanhamento de problemas relacionados à infraestrutura física. Situações de emergência devem também ser comunicadas pelos canais institucionais adequados.
          </p>
        </div>
        <p className="text-xs md:text-right">
          {institution}<br />
          Versão {APP_VERSION} — Sistema institucional de atendimento e infraestrutura
        </p>
      </div>
    </footer>
  );
}
