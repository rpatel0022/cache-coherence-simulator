// Simulator — orchestrates trace execution, manages caches and memory

class Simulator {
    constructor(numProcessors, protocolName) {
        this.numProcessors = numProcessors;
        this.protocolName = protocolName;
        this.protocol = this.createProtocol(protocolName);
        this.metrics = new Metrics();
        this.reset();
    }

    createProtocol(name) {
        switch (name) {
            case 'MSI': return new MSIProtocol();
            case 'MESI': return new MESIProtocol();
            case 'MOESI': return new MOESIProtocol();
            default: return new MSIProtocol();
        }
    }

    reset() {
        // caches[procIndex][blockId] = CacheBlock
        this.caches = [];
        for (let i = 0; i < this.numProcessors; i++) {
            this.caches.push({});
        }
        // memory[blockId] = { value, dirty (false when clean) }
        this.memory = {};
        this.metrics.reset();
        this.stepLog = [];
        this.currentStep = 0;
        this.valueCounter = {};  // auto-increment for writes without explicit value
    }

    setProtocol(name) {
        this.protocolName = name;
        this.protocol = this.createProtocol(name);
        this.reset();
    }

    setProcessors(num) {
        this.numProcessors = num;
        this.reset();
    }

    // Ensure a cache block exists for this processor and block
    ensureBlock(procIndex, blockId) {
        if (!this.caches[procIndex][blockId]) {
            this.caches[procIndex][blockId] = new CacheBlock();
        }
        return this.caches[procIndex][blockId];
    }

    // Ensure memory entry exists
    ensureMemory(blockId) {
        if (!this.memory[blockId]) {
            this.memory[blockId] = { value: 0, dirty: false };
        }
        return this.memory[blockId];
    }

    // Get the next auto-increment value for a block
    getNextValue(blockId) {
        if (!this.valueCounter[blockId]) {
            this.valueCounter[blockId] = 1;
        }
        return this.valueCounter[blockId]++;
    }

    // Execute one trace operation and return the step result
    executeStep(operation) {
        const { proc, op, block: blockId, value } = operation;
        this.currentStep++;

        // Ensure all caches and memory have entries for this block
        for (let i = 0; i < this.numProcessors; i++) {
            this.ensureBlock(i, blockId);
        }
        this.ensureMemory(blockId);

        const cacheBlock = this.caches[proc][blockId];
        const oldState = cacheBlock.state;

        // Run protocol logic
        const result = this.protocol.handleCpuRequest(
            oldState, op, blockId, this.caches, proc, this.metrics
        );

        // Apply snoop results (other caches' state changes)
        for (const snoop of result.snoopResults) {
            const snoopBlock = this.caches[snoop.proc][blockId];
            // Only update memory when the protocol says to writeback
            if (snoop.writeback) {
                this.memory[blockId].value = snoopBlock.value;
            }
            snoopBlock.state = snoop.newState;
        }

        // Apply requesting cache's state change
        cacheBlock.state = result.newState;

        // Handle data values
        if (op === 'W') {
            const writeValue = value !== null ? value : this.getNextValue(blockId);
            cacheBlock.value = writeValue;
            // In M state, memory is stale (dirty)
        } else if (op === 'R') {
            if (oldState === STATES.I) {
                // Read miss — get value from supplier or memory
                if (result.dataSource !== null && result.dataSource !== 'memory') {
                    cacheBlock.value = this.caches[result.dataSource][blockId].value;
                } else {
                    cacheBlock.value = this.memory[blockId].value;
                }
            }
            // Read hit — value already in cache
        }

        // Build step log entry
        const stepEntry = {
            step: this.currentStep,
            proc,
            op: op === 'R' ? 'Read' : 'Write',
            block: blockId,
            value: op === 'W' ? cacheBlock.value : null,
            oldState,
            newState: result.newState,
            description: result.description,
            busMessages: result.busMessages,
            snoopResults: result.snoopResults,
            dataSource: result.dataSource,
            cacheSnapshot: this.getCacheSnapshot(),
            memorySnapshot: this.getMemorySnapshot(),
            metricsSnapshot: this.metrics.snapshot()
        };

        this.stepLog.push(stepEntry);
        return stepEntry;
    }

    // Get a snapshot of all cache states
    getCacheSnapshot() {
        const snapshot = [];
        for (let i = 0; i < this.numProcessors; i++) {
            const procCache = {};
            for (const [blockId, block] of Object.entries(this.caches[i])) {
                procCache[blockId] = { state: block.state, value: block.value };
            }
            snapshot.push(procCache);
        }
        return snapshot;
    }

    // Get a snapshot of memory
    getMemorySnapshot() {
        const snapshot = {};
        for (const [blockId, mem] of Object.entries(this.memory)) {
            snapshot[blockId] = { value: mem.value };
        }
        return snapshot;
    }
}
