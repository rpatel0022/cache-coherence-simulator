// Automated test suite for cache coherence simulator
// Run: node tests/test-simulator.js

const fs = require('fs');
const path = require('path');

// Load source files in dependency order (they use globals)
const srcDir = path.join(__dirname, '..', 'js');
const loadOrder = [
    'metrics.js',
    'protocols/base-protocol.js',
    'protocols/msi.js',
    'protocols/mesi.js',
    'protocols/moesi.js',
    'trace-parser.js',
    'simulator.js',
    'traces.js'
];

// Concatenate all source files and run as one function, returning needed symbols
const allCode = loadOrder
    .map(file => fs.readFileSync(path.join(srcDir, file), 'utf-8'))
    .join('\n;\n');

const loader = new Function(allCode + `
;return { STATES, BUS, CacheBlock, BaseProtocol, MSIProtocol, MESIProtocol, MOESIProtocol,
          Metrics, Simulator, TraceParser, TRACES };
`);
const { STATES, BUS, CacheBlock, BaseProtocol, MSIProtocol, MESIProtocol, MOESIProtocol,
        Metrics, Simulator, TraceParser, TRACES } = loader();

// ── Test helpers ──
let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        passed++;
        console.log(`  PASS: ${msg}`);
    } else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}

function assertEqual(actual, expected, msg) {
    assert(actual === expected, `${msg} (expected ${expected}, got ${actual})`);
}

function runTrace(protocol, numProcs, traceText) {
    const sim = new Simulator(numProcs, protocol);
    const { operations, errors } = TraceParser.parse(traceText.trim(), numProcs);
    if (errors.length > 0) {
        throw new Error(`Parse errors: ${errors.map(e => e.message).join(', ')}`);
    }
    const results = [];
    for (const op of operations) {
        results.push(sim.executeStep(op));
    }
    return { sim, results, lastResult: results[results.length - 1] };
}

// ── Test 1: MOESI writeback correctness ──
console.log('\nTest 1: MOESI — No writeback on M→O');
{
    const { sim, lastResult } = runTrace('MOESI', 2, TRACES["MOESI Advantage — No Writeback"]);
    const metrics = lastResult.metricsSnapshot;
    assertEqual(metrics.writebacks, 0, 'MOESI writebacks should be 0');
    assertEqual(sim.memory['X'].value, 0, 'Memory X should still be 0 (not written back)');
    // P0 should be in O (was M, went to O on P1's BusRd)
    assertEqual(sim.caches[0]['X'].state, 'O', 'P0 should be in O state');
    assertEqual(sim.caches[1]['X'].state, 'S', 'P1 should be in S state');
    assertEqual(sim.caches[0]['X'].value, 99, 'P0 cache should have value 99');
    assertEqual(sim.caches[1]['X'].value, 99, 'P1 cache should have value 99 (supplied by P0)');
}

// ── Test 2: MSI writeback still works ──
console.log('\nTest 2: MSI — Writeback on M→S');
{
    const { sim, results } = runTrace('MSI', 2, TRACES["Basic MSI (L04 Example)"]);
    // After step 4 (P1 R X): P0 was M, writes back, goes to S
    const step4 = results[3].metricsSnapshot;
    assertEqual(step4.writebacks, 1, 'MSI writebacks should be 1 after step 4');
    assertEqual(sim.memory['X'].value, 5, 'Memory X should be 5 (writeback from step 4, step 5 write stays dirty)');

    const finalMetrics = results[4].metricsSnapshot;
    assertEqual(finalMetrics.writebacks, 1, 'MSI total writebacks should be 1 (only M→S in step 4)');
}

// ── Test 3: MESI silent upgrade ──
console.log('\nTest 3: MESI — Silent E→M upgrade');
{
    const { lastResult } = runTrace('MESI', 2, TRACES["MESI Advantage — Silent Upgrade"]);
    const metrics = lastResult.metricsSnapshot;
    assertEqual(metrics.busTraffic, 2, 'MESI bus messages should be 2 (BusRd + data only)');
    // Step 2 should describe silent upgrade
    assert(lastResult.description.includes('silent'), 'Step 2 should mention silent upgrade');
}

// ── Test 4: Compare mode — MSI vs MOESI writebacks ──
console.log('\nTest 4: Compare — MSI vs MOESI writebacks on same trace');
{
    const trace = TRACES["MOESI Advantage — No Writeback"];
    const msi = runTrace('MSI', 2, trace);
    const moesi = runTrace('MOESI', 2, trace);
    assertEqual(msi.lastResult.metricsSnapshot.writebacks, 1, 'MSI should have 1 writeback');
    assertEqual(moesi.lastResult.metricsSnapshot.writebacks, 0, 'MOESI should have 0 writebacks');
}

// ── Test 5: MESI private data advantage ──
console.log('\nTest 5: MESI — Private data silent upgrades');
{
    const trace = TRACES["Private Data — MESI Shines"];
    const msi = runTrace('MSI', 3, trace);
    const mesi = runTrace('MESI', 3, trace);
    // MESI should have fewer bus messages (silent E→M on each write)
    assert(
        mesi.lastResult.metricsSnapshot.busTraffic < msi.lastResult.metricsSnapshot.busTraffic,
        `MESI bus traffic (${mesi.lastResult.metricsSnapshot.busTraffic}) < MSI (${msi.lastResult.metricsSnapshot.busTraffic})`
    );
}

// ── Test 6: 3-processor contention ──
console.log('\nTest 6: 3-processor contention trace runs without error');
{
    const trace = TRACES["3-Processor Contention (L04 Practice)"];
    for (const proto of ['MSI', 'MESI', 'MOESI']) {
        const { results } = runTrace(proto, 3, trace);
        assertEqual(results.length, 5, `${proto}: all 5 steps should execute`);
    }
}

// ── Test 7: All traces run on all protocols without errors ──
console.log('\nTest 7: All traces × all protocols — no errors');
{
    for (const [name, text] of Object.entries(TRACES)) {
        // Detect max proc needed
        let maxProc = 0;
        const re = /P(\d+)/gi;
        let m;
        while ((m = re.exec(text)) !== null) {
            maxProc = Math.max(maxProc, parseInt(m[1]));
        }
        const numProcs = maxProc + 1;

        for (const proto of ['MSI', 'MESI', 'MOESI']) {
            try {
                const { results } = runTrace(proto, numProcs, text);
                assert(results.length > 0, `"${name}" × ${proto}: ran ${results.length} steps`);
            } catch (e) {
                assert(false, `"${name}" × ${proto}: threw ${e.message}`);
            }
        }
    }
}

// ── Test 8: Parser — dynamic processor error message ──
console.log('\nTest 8: Parser — dynamic processor names in error');
{
    // P3 is a valid processor name but exceeds 2-proc config → "P3 referenced but only 2 processors"
    const result2 = TraceParser.parse('P3 R X', 2);
    assert(result2.errors.length > 0, '2-proc config rejects P3');
    assert(result2.errors[0].message.includes('only 2'), 'Error mentions only 2 processors configured');

    // PX is not a valid processor name → "Invalid processor" with dynamic list
    const result2b = TraceParser.parse('PX R X', 2);
    assert(result2b.errors.length > 0, 'Invalid proc name rejected');
    assert(result2b.errors[0].message.includes('P0') && result2b.errors[0].message.includes('P1'),
           'Error lists P0, P1 for 2-proc config');
    assert(!result2b.errors[0].message.includes('P2'), 'Error does NOT list P2 for 2-proc');

    const result4 = TraceParser.parse('PZ R X', 4);
    assert(result4.errors.length > 0, '4-proc config rejects invalid name');
    assert(result4.errors[0].message.includes('P3'), 'Error lists P3 for 4-proc config');
}

// ── Test 9: Parser — valid traces parse correctly ──
console.log('\nTest 9: Parser — valid traces');
{
    const { operations, errors } = TraceParser.parse('P0 R X\nP1 W Y 42\n# comment\n\nP0 W X', 2);
    assertEqual(errors.length, 0, 'No parse errors');
    assertEqual(operations.length, 3, '3 operations parsed');
    assertEqual(operations[0].op, 'R', 'First op is read');
    assertEqual(operations[1].value, 42, 'Second op has value 42');
    assertEqual(operations[2].value, null, 'Third op has null value');
}

// ── Test 10: MOESI M→I on BusRdX — no writeback ──
console.log('\nTest 10: MOESI M→I on BusRdX — no memory update');
{
    // P0 writes X (gets M), then P1 writes X (BusRdX, P0 M→I)
    const { sim } = runTrace('MOESI', 2, 'P0 W X 77\nP1 W X 88');
    // P0 was M, P1 BusRdX → P0 goes I, supplies data but NO writeback
    assertEqual(sim.memory['X'].value, 0, 'Memory should still be 0 (no writeback on M→I in MOESI)');
    assertEqual(sim.caches[1]['X'].value, 88, 'P1 should have written 88');
}

// ── Test 11: MSI M→I on BusRdX — DOES writeback ──
console.log('\nTest 11: MSI M→I on BusRdX — memory IS updated');
{
    const { sim } = runTrace('MSI', 2, 'P0 W X 77\nP1 W X 88');
    assertEqual(sim.memory['X'].value, 77, 'MSI: memory should be 77 (writeback on M→I)');
}

// ── Summary ──
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);
