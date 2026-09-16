import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_POLLING_INTERVAL_MS, startNonDestructivePolling } from '../src/utils/polling';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

describe('polling administrativo não destrutivo 0.6.0',()=>{
  it('consulta em 60 segundos e apenas sinaliza quando há mudança',async()=>{
    vi.useFakeTimers();const check=vi.fn().mockResolvedValue(true);const changed=vi.fn();const stop=startNonDestructivePolling(check,changed);
    expect(ADMIN_POLLING_INTERVAL_MS).toBe(60_000);expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);expect(check).toHaveBeenCalledTimes(1);expect(changed).toHaveBeenCalledTimes(1);stop();
  });
  it('não sinaliza sem mudança nem transforma erro de rede em atualização',async()=>{
    vi.useFakeTimers();const changed=vi.fn();const check=vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('network'));const stop=startNonDestructivePolling(check,changed);
    await vi.advanceTimersByTimeAsync(120_000);expect(check).toHaveBeenCalledTimes(2);expect(changed).not.toHaveBeenCalled();stop();
  });
  it('limpa o timer ao desmontar/encerrar o polling',async()=>{
    vi.useFakeTimers();const check=vi.fn().mockResolvedValue(true);const stop=startNonDestructivePolling(check,vi.fn());stop();await vi.advanceTimersByTimeAsync(180_000);expect(check).not.toHaveBeenCalled();
  });
});
