export const ADMIN_POLLING_INTERVAL_MS = 60_000;

export function startNonDestructivePolling(
  checkForChanges: () => Promise<boolean>,
  onChange: () => void,
  intervalMs = ADMIN_POLLING_INTERVAL_MS,
): () => void {
  const timer = window.setInterval(() => {
    void checkForChanges().then((changed) => {
      if (changed) onChange();
    }).catch(() => {
      // Falhas transitórias do polling não substituem o estado/erro da tela.
    });
  }, intervalMs);
  return () => window.clearInterval(timer);
}
