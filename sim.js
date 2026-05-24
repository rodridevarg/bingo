// sim.js - Simulación del sorteo de Bingo (índice aleatorio + splice)
// Usage: node sim.js [G]

const G = Number(process.argv[2]) || 10000; // partidas
const N = 90; // bolas

function runSim(G, N) {
  const posSums = new Float64Array(N);
  const posSq = new Float64Array(N);
  const counts = new Uint32Array(N);

  for (let g = 0; g < G; g++) {
    const rem = new Array(N);
    for (let i = 0; i < N; i++) rem[i] = i + 1;
    const seen = new Set();

    for (let pos = 0; pos < N; pos++) {
      const idx = Math.floor(Math.random() * rem.length);
      const num = rem.splice(idx, 1)[0];
      if (seen.has(num)) {
        throw new Error(`Duplicado detectado en partida ${g} numero ${num}`);
      }
      seen.add(num);
      posSums[num - 1] += (pos + 1);
      posSq[num - 1] += (pos + 1) * (pos + 1);
      counts[num - 1]++;
    }
  }

  return { posSums, posSq, counts };
}

function analyze(res, G, N) {
  const expectedMean = (N + 1) / 2;
  const means = new Array(N);
  const stddevs = new Array(N);
  let minMean = Infinity, maxMean = -Infinity;
  let minIdx = -1, maxIdx = -1;
  for (let i = 0; i < N; i++) {
    const c = res.counts[i];
    if (c === 0) {
      means[i] = NaN;
      stddevs[i] = NaN;
      continue;
    }
    const mean = res.posSums[i] / c;
    const variance = res.posSq[i] / c - mean * mean;
    const sd = Math.sqrt(Math.max(0, variance));
    means[i] = mean;
    stddevs[i] = sd;

    if (mean < minMean) { minMean = mean; minIdx = i + 1; }
    if (mean > maxMean) { maxMean = mean; maxIdx = i + 1; }
  }

  const diffs = means.map(m => Math.abs(m - expectedMean));
  const maxDiff = Math.max(...diffs.filter(d => !Number.isNaN(d)));

  // Top/bottom 5 by mean
  const arr = means.map((m, i) => ({ num: i + 1, mean: m }));
  arr.sort((a, b) => b.mean - a.mean);
  const top5 = arr.slice(0, 5);
  arr.sort((a, b) => a.mean - b.mean);
  const bottom5 = arr.slice(0, 5);

  return {
    expectedMean,
    minMean, minIdx,
    maxMean, maxIdx,
    maxDiff,
    top5, bottom5,
    means, stddevs
  };
}

(async function main() {
  console.log(`Simulaciones: ${G} partidas, ${N} bolas`);
  const t0 = Date.now();
  const res = runSim(G, N);
  const t1 = Date.now();
  const analysis = analyze(res, G, N);

  console.log(`Tiempo: ${(t1 - t0) / 1000}s`);
  console.log(`Expected mean position: ${analysis.expectedMean.toFixed(4)}`);
  console.log(`Observed mean min: ${analysis.minMean.toFixed(4)} (num ${analysis.minIdx})`);
  console.log(`Observed mean max: ${analysis.maxMean.toFixed(4)} (num ${analysis.maxIdx})`);
  console.log(`Max deviation from expected mean: ${analysis.maxDiff.toFixed(4)}`);
  console.log('Top 5 (mayor mean):', analysis.top5.map(x => `${x.num}:${x.mean.toFixed(3)}`).join(', '));
  console.log('Bottom 5 (menor mean):', analysis.bottom5.map(x => `${x.num}:${x.mean.toFixed(3)}`).join(', '));

  // sanity counts
  const bad = [];
  for (let i = 0; i < N; i++) if (res.counts[i] !== G) bad.push({ num: i + 1, count: res.counts[i] });
  if (bad.length === 0) {
    console.log(`Cada número aparece exactamente ${G} veces (OK).`);
  } else {
    console.error('Inconsistencias en counts detectadas:', bad.slice(0,10));
  }
})();
