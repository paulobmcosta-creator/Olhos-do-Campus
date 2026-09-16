import { useEffect } from 'react';
import { BRANDING } from '../config/branding';

export function useDocumentTitle(pageTitle?: string): void {
  useEffect(() => {
    document.title = pageTitle === undefined
      ? `${BRANDING.publicName} | ${BRANDING.officialName}`
      : `${pageTitle} | ${BRANDING.publicName}`;
  }, [pageTitle]);
}
