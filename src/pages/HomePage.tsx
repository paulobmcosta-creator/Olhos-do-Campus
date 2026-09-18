import { AlertTriangle, ClipboardList, HardHat, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BRANDING } from '../config/branding';
import { ROUTES } from '../config/routes';
import { useAppData } from '../context/AppDataContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function HomePage(): React.JSX.Element {
  useDocumentTitle();
  const { data } = useAppData();
  const serviceNotice = data?.config.serviceNotice.trim() ?? '';

  return (
    <div className="space-y-10">
      <section className="border-l-4 border-green-800 bg-slate-50 px-5 py-7 sm:px-8 sm:py-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-800">{BRANDING.publicName}</p>
        <h1 className="mt-2 max-w-4xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
          {BRANDING.tagline}
        </h1>
        <p className="mt-5 max-w-4xl text-base leading-7 text-slate-700 sm:text-lg">
          Identificou um problema de limpeza, iluminação, climatização, instalação elétrica, estrutura predial ou outra condição relacionada à infraestrutura física? Registre a ocorrência para que a equipe responsável possa avaliar, encaminhar e acompanhar a situação.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">
          É possível fazer o registro sem identificação pessoal obrigatória. Ao final, você receberá um protocolo e uma chave para acompanhar a ocorrência.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link to={ROUTES.newOccurrence} className="btn-primary">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            Registrar problema de infraestrutura
          </Link>
          <Link to={ROUTES.trackOccurrence} className="btn-secondary">
            <Search className="h-5 w-5" aria-hidden="true" />
            Acompanhar uma ocorrência
          </Link>
        </div>
      </section>

      {serviceNotice !== '' && (
        <section aria-labelledby="service-notice-heading" className="border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <h2 id="service-notice-heading" className="font-bold">Aviso de atendimento</h2>
          <p className="mt-2 text-sm leading-6">{serviceNotice}</p>
        </section>
      )}

      <section aria-labelledby="orientacoes-heading" className="grid gap-6 lg:grid-cols-3">
        <div className="border border-slate-300 p-5">
          <HardHat className="h-7 w-7 text-green-800" aria-hidden="true" />
          <h2 id="orientacoes-heading" className="mt-3 text-lg font-bold text-slate-950">Finalidade do canal</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Use este sistema exclusivamente para problemas de infraestrutura física, como conservação, instalações, climatização, mobiliário, acessibilidade, segurança física e áreas externas.
          </p>
        </div>
        <div className="border border-slate-300 p-5">
          <ClipboardList className="h-7 w-7 text-green-800" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-slate-950">Dados pessoais não obrigatórios</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Não é obrigatório informar nome, matrícula, CPF ou e-mail. O acompanhamento é realizado somente com o protocolo e a chave gerados pelo sistema.
          </p>
        </div>
        <div className="border border-red-300 bg-red-50 p-5">
          <AlertTriangle className="h-7 w-7 text-red-700" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-red-950">Fotografias e emergências</h2>
          <p className="mt-2 text-sm leading-6 text-red-900">
            Não fotografe rostos, documentos ou outras informações pessoais. Situações de emergência não devem depender exclusivamente deste canal; acione também os meios institucionais apropriados.
          </p>
        </div>
      </section>

    </div>
  );
}
