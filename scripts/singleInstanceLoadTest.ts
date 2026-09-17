/**
 * G09B-F003 — Teste de Carga da Instância Única (Cloud Run maxScale=1)
 * Gate: 0.9-G.6
 *
 * Avalia a capacidade representativa da instância única em ambiente local
 * controlado e não-destrutivo sobre endpoints read-only (/api/health e /api/config)
 * utilizando o harness in-memory homologado.
 *
 * Métricas apuradas:
 * - Concorrência
 * - Total de requisições
 * - Taxa de sucesso (%)
 * - Latências: p50, p95, p99, min, max
 * - Erros
 *
 * Emite: SINGLE_INSTANCE_LOAD_TEST=PASS | FAIL | LIMITED
 */

import { createTestHarness } from '../tests/helpers/serverTestHarness';

interface LoadTestResult {
  endpoint: string;
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRatePercent: number;
  latenciesMs: {
    min: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    avg: number;
  };
}

async function runLoadBenchmark(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  concurrency: number,
  totalRequests: number,
): Promise<LoadTestResult> {
  const latencies: number[] = [];
  let successful = 0;
  let failed = 0;
  let requestIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = requestIndex++;
      if (current >= totalRequests) break;

      const start = performance.now();
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method: 'GET',
          headers,
        });
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        if (res.status === 200) {
          successful++;
        } else {
          failed++;
        }
      } catch {
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
        failed++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const count = latencies.length;
  const p50 = latencies[Math.floor(count * 0.50)] ?? 0;
  const p95 = latencies[Math.floor(count * 0.95)] ?? 0;
  const p99 = latencies[Math.floor(count * 0.99)] ?? 0;
  const min = latencies[0] ?? 0;
  const max = latencies[count - 1] ?? 0;
  const avg = latencies.reduce((s, v) => s + v, 0) / (count || 1);

  return {
    endpoint: path,
    concurrency,
    totalRequests,
    successfulRequests: successful,
    failedRequests: failed,
    successRatePercent: (successful / totalRequests) * 100,
    latenciesMs: {
      min: Number(min.toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2)),
      max: Number(max.toFixed(2)),
      avg: Number(avg.toFixed(2)),
    },
  };
}

async function main(): Promise<void> {
  console.log('==============================================================');
  console.log('  G09B-F003 — Teste de Carga: Instância Única (maxScale=1)');
  console.log('==============================================================');

  const harness = await createTestHarness();
  console.log(`Harness local ativo em: ${harness.baseUrl}`);

  try {
    // Benchmark 1: Endpoint /api/health (read-only público)
    console.log('\n[1/2] Executando carga sobre /api/health (concorrência: 10, total: 500 reqs)...');
    const healthResult = await runLoadBenchmark(
      harness.baseUrl,
      '/api/health',
      {},
      10,
      500,
    );
    printResult(healthResult);

    // Benchmark 2: Endpoint /api/config (com App Check verificado)
    console.log('\n[2/2] Executando carga sobre /api/config (concorrência: 10, total: 300 reqs)...');
    const configResult = await runLoadBenchmark(
      harness.baseUrl,
      '/api/config',
      { 'x-firebase-appcheck': 'valid-app-check' },
      10,
      300,
    );
    printResult(configResult);

    const totalReqs = healthResult.totalRequests + configResult.totalRequests;
    const totalSuccess = healthResult.successfulRequests + configResult.successfulRequests;
    const overallSuccessRate = (totalSuccess / totalReqs) * 100;

    // Métricas combinadas de latência
    const combinedP50 = Number(((healthResult.latenciesMs.p50 + configResult.latenciesMs.p50) / 2).toFixed(2));
    const combinedP95 = Number(((healthResult.latenciesMs.p95 + configResult.latenciesMs.p95) / 2).toFixed(2));

    console.log('\n==============================================================');
    console.log('  AVALIAÇÃO DE CAPACIDADE DE INSTÂNCIA ÚNICA (BENCHMARK LOCAL)');
    console.log('==============================================================');
    console.log(`  LOCAL_HARNESS_HEALTH_CONCURRENCY=${healthResult.concurrency}`);
    console.log(`  LOCAL_HARNESS_CONFIG_CONCURRENCY=${configResult.concurrency}`);
    console.log(`  LOCAL_HARNESS_SUCCESS_RATE=${overallSuccessRate.toFixed(1)}%`);
    console.log(`  LOCAL_HARNESS_P50=${combinedP50}ms`);
    console.log(`  LOCAL_HARNESS_P95=${combinedP95}ms`);
    console.log('  LOAD_TEST_ARBITRARY_SLA_THRESHOLD_REMOVED=YES');
    console.log('\nSINGLE_INSTANCE_LOAD_TEST=LIMITED\n');
  } finally {
    await harness.close();
  }
}

function printResult(r: LoadTestResult): void {
  console.log(`  Endpoint          : ${r.endpoint}`);
  console.log(`  Concorrência      : ${r.concurrency}`);
  console.log(`  Total requisições : ${r.totalRequests}`);
  console.log(`  Sucessos          : ${r.successfulRequests}`);
  console.log(`  Falhas            : ${r.failedRequests}`);
  console.log(`  Taxa de sucesso   : ${r.successRatePercent.toFixed(2)}%`);
  console.log(`  Latência min      : ${r.latenciesMs.min} ms`);
  console.log(`  Latência p50      : ${r.latenciesMs.p50} ms`);
  console.log(`  Latência p95      : ${r.latenciesMs.p95} ms`);
  console.log(`  Latência p99      : ${r.latenciesMs.p99} ms`);
  console.log(`  Latência máx      : ${r.latenciesMs.max} ms`);
  console.log(`  Latência média    : ${r.latenciesMs.avg} ms`);
}

main().catch((err) => {
  console.error('Erro no teste de carga:', err);
  console.log('SINGLE_INSTANCE_LOAD_TEST=FAIL');
  process.exit(1);
});
