// UI Controller — wires simulator to DOM

(function() {
    // ── State ──
    let sim = null;
    let operations = [];
    let currentOpIndex = 0;
    let isRunning = false;
    let runTimer = null;
    let mode = 'single'; // 'single' or 'compare'

    // Compare mode simulators
    let compareSims = {};

    // ── DOM refs ──
    const protocolSelect = document.getElementById('protocolSelect');
    const procCountSelect = document.getElementById('procCountSelect');
    const traceSelect = document.getElementById('traceSelect');
    const traceInput = document.getElementById('traceInput');
    const traceError = document.getElementById('traceError');
    const stepBtn = document.getElementById('stepBtn');
    const runBtn = document.getElementById('runBtn');
    const resetBtn = document.getElementById('resetBtn');
    const speedSlider = document.getElementById('speedSlider');
    const stepBanner = document.getElementById('stepBanner');
    const cacheGrid = document.getElementById('cacheGrid');
    const memoryGrid = document.getElementById('memoryGrid');
    const busLog = document.getElementById('busLog');
    const statBus = document.getElementById('statBus');
    const statInv = document.getElementById('statInv');
    const statWb = document.getElementById('statWb');
    const singleView = document.getElementById('singleView');
    const compareView = document.getElementById('compareView');
    const barChart = document.getElementById('barChart');
    const traceDisplay = document.getElementById('traceDisplay');
    const historyTable = document.getElementById('historyTable');
    const modeTabs = document.querySelectorAll('.mode-tab');

    // ── Init ──
    function init() {
        populateTraceSelect();
        sim = new Simulator(getNumProcs(), getProtocol());
        bindEvents();
        // Load first trace by default
        traceSelect.selectedIndex = 1;
        loadSelectedTrace();
        renderSingle();
    }

    function getProtocol() { return protocolSelect.value; }
    function getNumProcs() { return parseInt(procCountSelect.value); }
    function getSpeed() { return 2100 - parseInt(speedSlider.value); }

    // ── Trace Select ──
    function populateTraceSelect() {
        traceSelect.innerHTML = '<option value="">— Select Example —</option>';
        for (const name of Object.keys(TRACES)) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            traceSelect.appendChild(opt);
        }
    }

    function detectMaxProc(text) {
        let max = -1;
        const re = /P(\d+)/gi;
        let match;
        while ((match = re.exec(text)) !== null) {
            const n = parseInt(match[1]);
            if (n > max) max = n;
        }
        return max + 1; // count of processors needed
    }

    function loadSelectedTrace() {
        const name = traceSelect.value;
        if (name && TRACES[name]) {
            const text = TRACES[name].trim();
            const needed = detectMaxProc(text);
            if (needed > getNumProcs()) {
                procCountSelect.value = String(needed);
            }
            traceInput.value = text;
            resetSimulation();
        }
    }

    // ── Parse & Validate ──
    function parseTrace() {
        const text = traceInput.value;
        const numProcs = getNumProcs();
        const result = TraceParser.parse(text, numProcs);

        if (result.errors.length > 0) {
            const msgs = result.errors.map(e => `Line ${e.line}: ${e.message}`);
            showError(msgs.join('\n'));
            return null;
        }

        if (result.operations.length === 0) {
            showError('Enter a trace first.');
            return null;
        }

        hideError();
        return result.operations;
    }

    function showError(msg) {
        traceError.textContent = msg;
        traceError.classList.add('visible');
    }

    function hideError() {
        traceError.classList.remove('visible');
    }

    // ── Simulation Control ──
    function resetSimulation() {
        stopRun();
        currentOpIndex = 0;
        operations = [];
        hideError();

        // Show textarea, hide trace display
        traceInput.classList.remove('hidden');
        traceDisplay.classList.add('hidden');
        traceDisplay.innerHTML = '';

        // Clear history
        historyEntries = [];
        historyTable.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">Step through to build history</div>';

        if (mode === 'single') {
            sim = new Simulator(getNumProcs(), getProtocol());
            renderSingle();
        } else {
            compareSims = {
                MSI: new Simulator(getNumProcs(), 'MSI'),
                MESI: new Simulator(getNumProcs(), 'MESI'),
                MOESI: new Simulator(getNumProcs(), 'MOESI')
            };
            renderCompare();
        }

        stepBanner.className = 'step-banner';
        stepBanner.innerHTML = '<span class="step-label">Ready</span><span>Load a trace and click Step or Run</span>';
        stepBtn.disabled = false;
        runBtn.disabled = false;
        runBtn.textContent = 'Run';
    }

    function step() {
        // Parse on first step
        if (operations.length === 0) {
            const parsed = parseTrace();
            if (!parsed) return;
            operations = parsed;
            currentOpIndex = 0;
        }

        if (currentOpIndex >= operations.length) {
            markComplete();
            return;
        }

        // On first step, switch from textarea to trace display
        if (currentOpIndex === 0) {
            showTraceDisplay();
        }

        const op = operations[currentOpIndex];

        if (mode === 'single') {
            const result = sim.executeStep(op);
            renderSingleStep(result, op);
        } else {
            const results = {};
            for (const [proto, s] of Object.entries(compareSims)) {
                results[proto] = s.executeStep(op);
            }
            renderCompareStep(results, op);
        }

        currentOpIndex++;
        updateTraceHighlight();

        if (currentOpIndex >= operations.length) {
            markComplete();
        }
    }

    function startRun() {
        if (isRunning) {
            stopRun();
            return;
        }
        isRunning = true;
        runBtn.textContent = 'Pause';
        runBtn.classList.add('btn-danger');
        runBtn.classList.remove('btn-success');

        function tick() {
            if (!isRunning) return;
            if (currentOpIndex >= operations.length && operations.length > 0) {
                stopRun();
                markComplete();
                return;
            }
            step();
            if (isRunning && currentOpIndex < operations.length) {
                runTimer = setTimeout(tick, getSpeed());
            } else {
                stopRun();
            }
        }
        tick();
    }

    function stopRun() {
        isRunning = false;
        clearTimeout(runTimer);
        runBtn.textContent = 'Run';
        runBtn.classList.remove('btn-danger');
        runBtn.classList.add('btn-success');
    }

    function markComplete() {
        stepBanner.className = 'step-banner complete';
        stepBanner.innerHTML = '<span class="step-label">Complete</span><span>Simulation finished. Click Reset to try again.</span>';
        stepBtn.disabled = true;
        runBtn.disabled = true;
        stopRun();
    }

    // ── Render: Single Protocol ──
    function renderSingle() {
        renderCacheGrid(sim, cacheGrid);
        renderMemory(sim, memoryGrid);
        busLog.innerHTML = '';
        statBus.textContent = '0';
        statInv.textContent = '0';
        statWb.textContent = '0';
    }

    function renderSingleStep(result, op) {
        // Update banner
        const opStr = `P${op.proc} ${op.op === 'R' ? 'Read' : 'Write'} ${op.block}${op.op === 'W' && result.value !== null ? ' = ' + result.value : ''}`;
        stepBanner.className = 'step-banner';
        stepBanner.innerHTML = `<span class="step-label">Step ${result.step} of ${operations.length}</span><span>${opStr} — ${result.description}</span>`;

        // Render cache grid with highlight
        renderCacheGrid(sim, cacheGrid, op.proc, op.block);
        renderMemory(sim, memoryGrid);

        // Bus log
        const entries = [];
        for (const msg of result.busMessages) {
            entries.push(`<div class="bus-entry"><span class="step-num">${result.step}.</span> <span class="bus-type">${msg.description}</span></div>`);
        }
        for (const snoop of result.snoopResults) {
            entries.push(`<div class="bus-entry"><span class="step-num">${result.step}.</span> P${snoop.proc}: ${snoop.oldState}→${snoop.newState} — ${snoop.action}</div>`);
        }
        if (entries.length > 0) {
            busLog.innerHTML = entries.join('') + busLog.innerHTML;
        }

        // Stats
        const m = result.metricsSnapshot;
        statBus.textContent = m.busTraffic;
        statInv.textContent = m.invalidations;
        statWb.textContent = m.writebacks;

        // History table
        historyEntries.push({
            opLabel: `P${op.proc} ${op.op === 'R' ? 'Read' : 'Write'} ${op.block}`,
            cacheSnapshot: result.cacheSnapshot
        });
        renderHistoryTable();
    }

    function renderCacheGrid(simulator, container, highlightProc, highlightBlock) {
        const numProcs = simulator.numProcessors;
        // Collect all blocks that have appeared
        const blocks = new Set();
        for (let i = 0; i < numProcs; i++) {
            for (const b of Object.keys(simulator.caches[i])) {
                blocks.add(b);
            }
        }
        const blockList = Array.from(blocks).sort();

        if (blockList.length === 0) {
            container.innerHTML = '<div style="padding: 20px; color: var(--text-muted); font-size: 0.85rem;">No cache activity yet</div>';
            return;
        }

        let html = '<div class="cache-grid-header"><div>Block</div>';
        for (let i = 0; i < numProcs; i++) {
            html += `<div>P${i}</div>`;
        }
        html += '</div>';

        for (const block of blockList) {
            html += `<div class="cache-grid-row"><div>${block}</div>`;
            for (let i = 0; i < numProcs; i++) {
                const cb = simulator.caches[i][block];
                const state = cb ? cb.state : STATES.I;
                const val = cb && cb.value !== null ? cb.value : '—';
                const isHighlight = (highlightProc === i && highlightBlock === block) ? ' highlight' : '';
                html += `<div><span class="state-badge state-${state}${isHighlight}">${state}</span><br><small style="color: var(--text-muted)">${val}</small></div>`;
            }
            html += '</div>';
        }

        container.innerHTML = html;
    }

    function renderMemory(simulator, container) {
        const blocks = Object.keys(simulator.memory).sort();
        if (blocks.length === 0) {
            container.innerHTML = '<span class="memory-item">No memory blocks</span>';
            return;
        }
        container.innerHTML = blocks.map(b => {
            const mem = simulator.memory[b];
            return `<span class="memory-item">${b} = ${mem.value}</span>`;
        }).join('');
    }

    // ── Render: Compare Mode ──
    function renderCompare() {
        for (const proto of ['MSI', 'MESI', 'MOESI']) {
            const col = document.getElementById('compare' + proto);
            const cacheDiv = col.querySelector('.compare-cache-grid');
            const statsDiv = col.querySelector('.compare-stats');
            cacheDiv.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">No activity</div>';
            statsDiv.innerHTML = renderCompareStats({ busTraffic: 0, invalidations: 0, writebacks: 0 });
        }
        barChart.innerHTML = '';
    }

    function renderCompareStep(results, op) {
        const opStr = `P${op.proc} ${op.op === 'R' ? 'Read' : 'Write'} ${op.block}`;
        const stepNum = results.MSI.step;
        stepBanner.className = 'step-banner';
        stepBanner.innerHTML = `<span class="step-label">Step ${stepNum} of ${operations.length}</span><span>${opStr}</span>`;

        for (const proto of ['MSI', 'MESI', 'MOESI']) {
            const col = document.getElementById('compare' + proto);
            const cacheDiv = col.querySelector('.compare-cache-grid');
            const statsDiv = col.querySelector('.compare-stats');

            renderCacheGrid(compareSims[proto], cacheDiv, op.proc, op.block);
            statsDiv.innerHTML = renderCompareStats(results[proto].metricsSnapshot);
        }

        // Bar chart
        renderBarChart(
            results.MSI.metricsSnapshot,
            results.MESI.metricsSnapshot,
            results.MOESI.metricsSnapshot
        );
    }

    function renderCompareStats(m) {
        return `
            <div class="compare-stat"><span>Bus Messages</span><span>${m.busTraffic}</span></div>
            <div class="compare-stat"><span>Invalidations</span><span>${m.invalidations}</span></div>
            <div class="compare-stat"><span>Writebacks</span><span>${m.writebacks}</span></div>
        `;
    }

    function renderBarChart(msi, mesi, moesi) {
        const maxBus = Math.max(msi.busTraffic, mesi.busTraffic, moesi.busTraffic, 1);
        const maxInv = Math.max(msi.invalidations, mesi.invalidations, moesi.invalidations, 1);
        const maxWb = Math.max(msi.writebacks, mesi.writebacks, moesi.writebacks, 1);

        function pct(val, max) { return Math.round((val / max) * 100); }
        function reduction(val, baseline) {
            if (baseline === 0) return '';
            const r = Math.round(((baseline - val) / baseline) * 100);
            return r > 0 ? ` (${r}% less)` : r < 0 ? ` (${-r}% more)` : '';
        }

        function makeBarGroup(label, msiVal, mesiVal, moesiVal, max) {
            return `
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 600;">${label}</div>
                    <div class="bar-row">
                        <span class="bar-label" style="color: var(--bar-msi);">MSI</span>
                        <div class="bar-track"><div class="bar-fill msi" style="width: ${pct(msiVal, max)}%">${msiVal}</div></div>
                        <span class="bar-value">${msiVal}</span>
                    </div>
                    <div class="bar-row">
                        <span class="bar-label" style="color: var(--bar-mesi);">MESI</span>
                        <div class="bar-track"><div class="bar-fill mesi" style="width: ${pct(mesiVal, max)}%">${mesiVal}</div></div>
                        <span class="bar-value">${mesiVal}${reduction(mesiVal, msiVal)}</span>
                    </div>
                    <div class="bar-row">
                        <span class="bar-label" style="color: var(--bar-moesi);">MOESI</span>
                        <div class="bar-track"><div class="bar-fill moesi" style="width: ${pct(moesiVal, max)}%">${moesiVal}</div></div>
                        <span class="bar-value">${moesiVal}${reduction(moesiVal, msiVal)}</span>
                    </div>
                </div>
            `;
        }

        barChart.innerHTML =
            makeBarGroup('Bus Traffic', msi.busTraffic, mesi.busTraffic, moesi.busTraffic, maxBus) +
            makeBarGroup('Invalidations', msi.invalidations, mesi.invalidations, moesi.invalidations, maxInv) +
            makeBarGroup('Writebacks', msi.writebacks, mesi.writebacks, moesi.writebacks, maxWb);
    }

    // ── Step History Table ──
    // Stores previous cache snapshots to detect changes
    let historyEntries = []; // { opLabel, cacheSnapshot, blocks }

    function renderHistoryTable() {
        if (historyEntries.length === 0) {
            historyTable.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">Step through to build history</div>';
            return;
        }

        const numProcs = sim.numProcessors;
        // Collect all blocks across all history entries
        const blockSet = new Set();
        for (const entry of historyEntries) {
            for (const b of Object.keys(entry.cacheSnapshot[0] || {})) blockSet.add(b);
        }
        const blocks = Array.from(blockSet).sort();

        if (blocks.length === 0) return;

        // Build header: Operation | Block | P0 | P1 | P2 | P3
        let html = '<table class="history-table"><thead><tr>';
        html += '<th>Operation</th><th>Block</th>';
        for (let i = 0; i < numProcs; i++) html += `<th>P${i}</th>`;
        html += '</tr></thead><tbody>';

        // Initial row
        html += buildHistoryRows('&lt;initial&gt;', null, blocks, numProcs, null);

        // One group of rows per step
        for (let i = 0; i < historyEntries.length; i++) {
            const entry = historyEntries[i];
            const prev = i === 0 ? null : historyEntries[i - 1].cacheSnapshot;
            html += buildHistoryRows(entry.opLabel, entry.cacheSnapshot, blocks, numProcs, prev);
        }

        html += '</tbody></table>';
        historyTable.innerHTML = html;

        // Scroll to bottom
        historyTable.scrollTop = historyTable.scrollHeight;
    }

    function buildHistoryRows(label, snapshot, blocks, numProcs, prevSnapshot) {
        let html = '';
        for (let b = 0; b < blocks.length; b++) {
            const block = blocks[b];
            html += '<tr';
            if (b === 0) html += ' class="group-separator"';
            html += '>';

            // Operation label spans all block rows
            if (b === 0) {
                html += `<td rowspan="${blocks.length}">${label}</td>`;
            }

            html += `<td>${block}</td>`;

            for (let p = 0; p < numProcs; p++) {
                const state = snapshot ? (snapshot[p][block] ? snapshot[p][block].state : 'I') : 'I';
                const prevState = prevSnapshot ? (prevSnapshot[p][block] ? prevSnapshot[p][block].state : 'I') : null;
                const changed = prevState !== null && prevState !== state ? ' changed' : '';
                html += `<td><span class="history-state hs-${state}${changed}">${state}</span></td>`;
            }

            html += '</tr>';
        }
        return html;
    }

    // ── Trace Display ──
    function showTraceDisplay() {
        traceInput.classList.add('hidden');
        traceDisplay.classList.remove('hidden');

        // Render each operation as a line
        const lines = operations.map((op, i) =>
            `<div class="trace-line" data-index="${i}">${op.raw}</div>`
        ).join('');
        traceDisplay.innerHTML = lines;
    }

    function updateTraceHighlight() {
        const lines = traceDisplay.querySelectorAll('.trace-line');
        lines.forEach((el, i) => {
            el.classList.remove('active', 'done');
            if (i < currentOpIndex - 1) {
                el.classList.add('done');
            } else if (i === currentOpIndex - 1) {
                el.classList.add('active');
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }

    // ── Event Bindings ──
    function bindEvents() {
        stepBtn.addEventListener('click', step);
        runBtn.addEventListener('click', startRun);
        resetBtn.addEventListener('click', resetSimulation);
        traceSelect.addEventListener('change', loadSelectedTrace);
        protocolSelect.addEventListener('change', resetSimulation);
        procCountSelect.addEventListener('change', resetSimulation);

        // Drag-to-resize panels
        function setupResizeHandle(handleId, targetId, direction) {
            const handle = document.getElementById(handleId);
            const target = document.getElementById(targetId);
            let dragging = false;
            let startY, startHeight;

            handle.addEventListener('mousedown', (e) => {
                dragging = true;
                startY = e.clientY;
                startHeight = target.offsetHeight;
                handle.classList.add('dragging');
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                // direction: 'below' = dragging resizes section above, 'above' = section below
                const delta = direction === 'above' ? (startY - e.clientY) : (e.clientY - startY);
                const newHeight = Math.max(0, Math.min(600, startHeight + delta));
                target.style.height = newHeight + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (!dragging) return;
                dragging = false;
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            });
        }

        setupResizeHandle('memoryResizeHandle', 'memorySection', 'below');
        setupResizeHandle('resizeHandle', 'bottomSection', 'above');

        traceInput.addEventListener('input', () => {
            hideError();
            // If user edits trace, reset
            if (currentOpIndex > 0) resetSimulation();
        });

        // Mode tabs
        modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                modeTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                mode = tab.dataset.mode;

                if (mode === 'single') {
                    singleView.classList.remove('hidden');
                    compareView.classList.add('hidden');
                    protocolSelect.disabled = false;
                } else {
                    singleView.classList.add('hidden');
                    compareView.classList.remove('hidden');
                    protocolSelect.disabled = true;
                }
                resetSimulation();
            });
        });
    }

    // ── Boot ──
    init();
})();
