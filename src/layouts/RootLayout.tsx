import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DemoModeBanner } from '../components/common/DemoModeBanner';
import { Footer } from '../components/common/Footer';
import { Header } from '../components/common/Header';
import { LoadingState } from '../components/common/LoadingState';
import { StatusAlert } from '../components/common/StatusAlert';
import { useAppData } from '../context/AppDataContext';

export function RootLayout(): React.JSX.Element {
  const { data, error, loading, refresh } = useAppData();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <a href="#conteudo-principal" className="skip-link">Ir para o conteúdo principal</a>
      <Header />
      {data !== null && <DemoModeBanner emulatorMode={data.runtime.emulatorMode} />}
      <main
        id="conteudo-principal"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
      >
        {loading && data === null ? (
          <LoadingState />
        ) : error !== null && data === null ? (
          <div className="mx-auto max-w-2xl">
            <StatusAlert tone="error">
              <p>{error}</p>
              <button type="button" className="btn-secondary mt-3" onClick={() => void refresh()}>
                Tentar novamente
              </button>
            </StatusAlert>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <Footer />
    </div>
  );
}
