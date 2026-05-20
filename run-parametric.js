// Parametric experiment: vary sharing ratio from 0% to 100%
// and measure bus traffic, invalidations, writebacks across MSI/MESI/MOESI
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'js');
const loadOrder = [
  'metrics.js', 'protocols/base-protocol.js', 'protocols/msi.js',
  'protocols/mesi.js', 'protocols/moesi.js', 'trace-parser.js',
  'simulator.js', 'traces.js'
];
const allCode = loadOrder.map(f => fs.readFileSync(path.join(srcDir, f), 'utf-8')).join('\n;\n');
const loader = new Function(allCode + `;return { STATES, Simulator, TraceParser, TRACES };`);
const { Simulator, TraceParser } = loader();

const NUM_PROCS = 4;
const NUM_OPS = 500;
const NUM_BLOCKS = 8;
const PROTOCOLS = ['MSI', 'MESI', 'MOESI'];

// Generate a trace with a given sharing ratio
// sharingRatio: 0.0 = all private (each proc touches its own blocks)
//               1.0 = all shared (all procs touch the same blocks)
// readRatio: fraction of operations that are reads (vs writes)
function generateTrace(numOps, numProcs, numBlocks, sharingRatio, readRatio) {
  const lines = [];
  // Assign private blocks: proc i owns blocks i*blocksPerProc .. (i+1)*blocksPerProc-1
  // Shared blocks: blocks 0..numBlocks-1 accessed by any proc
  const privateBlocksPerProc = Math.max(1, Math.floor(numBlocks / numProcs));

  for (let i = 0; i < numOps; i++) {
    const proc = Math.floor(Math.random() * numProcs);
    const op = Math.random() < readRatio ? 'R' : 'W';

    let block;
    if (Math.random() < sharingRatio) {
      // Shared access: pick from shared pool (all blocks)
      block = `B${Math.floor(Math.random() * numBlocks)}`;
    } else {
      // Private access: pick from this proc's private blocks
      const privateBase = proc * privateBlocksPerProc;
      block = `P${proc}B${Math.floor(Math.random() * privateBlocksPerProc)}`;
    }

    if (op === 'W') {
      lines.push(`P${proc} W ${block} ${i}`);
    } else {
      lines.push(`P${proc} R ${block}`);
    }
  }
  return lines.join('\n');
}

// Run experiment
function runExperiment(traceText, proto) {
  const sim = new Simulator(NUM_PROCS, proto);
  const { operations } = TraceParser.parse(traceText, NUM_PROCS);
  for (const op of operations) sim.executeStep(op);
  return {
    busTraffic: sim.metrics.busTraffic,
    invalidations: sim.metrics.invalidations,
    writebacks: sim.metrics.writebacks
  };
}

// Sweep sharing ratio
const sharingRatios = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const readRatio = 0.5; // 50/50 read/write mix
const RUNS = 5; // average over multiple random seeds

console.log('\nPARAMETRIC EXPERIMENT: Sharing Ratio vs Protocol Performance');
console.log(`${NUM_PROCS} processors, ${NUM_OPS} ops/trace, ${NUM_BLOCKS} blocks, ${(readRatio*100).toFixed(0)}% reads, averaged over ${RUNS} runs`);
console.log('='.repeat(100));
console.log('Sharing | MSI Bus  | MESI Bus | MOESI Bus | MSI Inv  | MESI Inv | MOESI Inv | MSI Wb | MESI Wb | MOESI Wb');
console.log('-'.repeat(100));

const results = [];

for (const sr of sharingRatios) {
  const totals = {};
  for (const p of PROTOCOLS) {
    totals[p] = { busTraffic: 0, invalidations: 0, writebacks: 0 };
  }

  for (let run = 0; run < RUNS; run++) {
    const trace = generateTrace(NUM_OPS, NUM_PROCS, NUM_BLOCKS, sr, readRatio);
    for (const p of PROTOCOLS) {
      const r = runExperiment(trace, p);
      totals[p].busTraffic += r.busTraffic;
      totals[p].invalidations += r.invalidations;
      totals[p].writebacks += r.writebacks;
    }
  }

  const avg = {};
  for (const p of PROTOCOLS) {
    avg[p] = {
      busTraffic: Math.round(totals[p].busTraffic / RUNS),
      invalidations: Math.round(totals[p].invalidations / RUNS),
      writebacks: Math.round(totals[p].writebacks / RUNS)
    };
  }

  results.push({ sharingRatio: sr, ...avg });

  const sr_str = (sr * 100).toFixed(0).padStart(4) + '%  ';
  const row = PROTOCOLS.map(p =>
    `${String(avg[p].busTraffic).padStart(8)} `
  ).join(' | ') + ' | ' + PROTOCOLS.map(p =>
    `${String(avg[p].invalidations).padStart(8)} `
  ).join(' | ') + ' | ' + PROTOCOLS.map(p =>
    `${String(avg[p].writebacks).padStart(6)} `
  ).join(' | ');
  console.log(sr_str + '| ' + row);
}

// Summary: MESI vs MSI bus reduction, MOESI vs MSI writeback reduction
console.log('\n\nSUMMARY: Relative reductions vs MSI');
console.log('-'.repeat(80));
console.log('Sharing | MESI Bus Reduction | MOESI Bus Reduction | MOESI Wb Reduction');
console.log('-'.repeat(80));
for (const r of results) {
  const sr_str = (r.sharingRatio * 100).toFixed(0).padStart(4) + '%  ';
  const mesiBusRed = r.MSI.busTraffic > 0 ? ((r.MSI.busTraffic - r.MESI.busTraffic) / r.MSI.busTraffic * 100).toFixed(1) : '0.0';
  const moesiBusRed = r.MSI.busTraffic > 0 ? ((r.MSI.busTraffic - r.MOESI.busTraffic) / r.MSI.busTraffic * 100).toFixed(1) : '0.0';
  const moesiWbRed = r.MSI.writebacks > 0 ? ((r.MSI.writebacks - r.MOESI.writebacks) / r.MSI.writebacks * 100).toFixed(1) : 'N/A';
  console.log(`${sr_str}| ${mesiBusRed.padStart(16)}%  | ${moesiBusRed.padStart(18)}%  | ${moesiWbRed.padStart(15)}%`);
}

// LaTeX table output
console.log('\n\nLATEX TABLE:');
console.log('Sharing & MSI & MESI & MOESI & MESI $\\Delta$ & MOESI $\\Delta$ \\\\');
for (const r of results) {
  const mesiBusRed = r.MSI.busTraffic > 0 ? ((r.MSI.busTraffic - r.MESI.busTraffic) / r.MSI.busTraffic * 100).toFixed(1) : '0.0';
  const moesiWbRed = r.MSI.writebacks > 0 ? ((r.MSI.writebacks - r.MOESI.writebacks) / r.MSI.writebacks * 100).toFixed(1) : '--';
  console.log(`${(r.sharingRatio*100).toFixed(0)}\\% & ${r.MSI.busTraffic}/${r.MSI.invalidations}/${r.MSI.writebacks} & ${r.MESI.busTraffic}/${r.MESI.invalidations}/${r.MESI.writebacks} & ${r.MOESI.busTraffic}/${r.MOESI.invalidations}/${r.MOESI.writebacks} & ${mesiBusRed}\\% & ${moesiWbRed}\\% \\\\`);
}
