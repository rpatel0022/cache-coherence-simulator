// MSI Protocol — Modified, Shared, Invalid
// The foundation protocol. All transitions from L04 notes.

class MSIProtocol extends BaseProtocol {
    constructor() {
        super();
        this.name = 'MSI';
    }

    // Handle a CPU read or write request from procIndex on blockId
    // Returns: { busMessages: [{type, description}], snoopResults: [{proc, oldState, newState, action}] }
    handleCpuRequest(currentState, op, blockId, caches, procIndex, metrics) {
        const result = {
            newState: currentState,
            busMessages: [],
            snoopResults: [],
            dataSource: null,  // 'memory' or processor index
            description: ''
        };

        if (op === 'R') {
            switch (currentState) {
                case STATES.I: {
                    // I → S: read miss, place BusRd on bus
                    result.busMessages.push({ type: BUS.BusRd, description: `P${procIndex} BusRd ${blockId}` });
                    metrics.addBusMessage(); // BusRd request

                    // Check if another cache has it in M (must writeback)
                    const supplier = this.findSupplier(caches, blockId, procIndex);
                    if (supplier >= 0 && caches[supplier][blockId].state === STATES.M) {
                        // M holder writes back and goes to S
                        result.snoopResults.push({
                            proc: supplier, oldState: STATES.M, newState: STATES.S,
                            action: `Writeback ${blockId}, supply to P${procIndex}`,
                            writeback: true
                        });
                        metrics.addWriteback();
                        metrics.addBusMessage(); // data supply
                        result.dataSource = supplier;
                    } else {
                        metrics.addBusMessage(); // data from memory
                        result.dataSource = 'memory';
                    }

                    result.newState = STATES.S;
                    result.description = `Read miss → S`;
                    break;
                }
                case STATES.S:
                    // S → S: read hit, no bus action
                    result.newState = STATES.S;
                    result.description = `Read hit (S)`;
                    break;
                case STATES.M:
                    // M → M: read hit, no bus action
                    result.newState = STATES.M;
                    result.description = `Read hit (M)`;
                    break;
            }
        } else if (op === 'W') {
            switch (currentState) {
                case STATES.I: {
                    // I → M: write miss, place BusRdX on bus
                    result.busMessages.push({ type: BUS.BusRdX, description: `P${procIndex} BusRdX ${blockId}` });
                    metrics.addBusMessage(); // BusRdX request

                    // Invalidate all other copies and get data
                    const supplier = this.findSupplier(caches, blockId, procIndex);
                    let dataSourceSet = false;

                    for (let i = 0; i < caches.length; i++) {
                        if (i === procIndex) continue;
                        const block = caches[i][blockId];
                        if (!block || block.state === STATES.I) continue;

                        if (block.state === STATES.M) {
                            result.snoopResults.push({
                                proc: i, oldState: STATES.M, newState: STATES.I,
                                action: `Writeback ${blockId}, supply to P${procIndex}, invalidate`,
                                writeback: true
                            });
                            metrics.addWriteback();
                            metrics.addBusMessage(); // data supply
                            metrics.addInvalidation();
                            result.dataSource = i;
                            dataSourceSet = true;
                        } else if (block.state === STATES.S) {
                            result.snoopResults.push({
                                proc: i, oldState: STATES.S, newState: STATES.I,
                                action: `Invalidate ${blockId}`
                            });
                            metrics.addInvalidation();
                        }
                    }

                    if (!dataSourceSet) {
                        metrics.addBusMessage(); // data from memory
                        result.dataSource = 'memory';
                    }

                    result.newState = STATES.M;
                    result.description = `Write miss → M`;
                    break;
                }
                case STATES.S: {
                    // S → M: write hit, place BusUpgr (invalidate others)
                    result.busMessages.push({ type: BUS.BusUpgr, description: `P${procIndex} BusUpgr ${blockId}` });
                    metrics.addBusMessage(); // BusUpgr

                    // Invalidate all other S copies
                    for (let i = 0; i < caches.length; i++) {
                        if (i === procIndex) continue;
                        const block = caches[i][blockId];
                        if (block && block.state === STATES.S) {
                            result.snoopResults.push({
                                proc: i, oldState: STATES.S, newState: STATES.I,
                                action: `Invalidate ${blockId}`
                            });
                            metrics.addInvalidation();
                        }
                    }

                    result.newState = STATES.M;
                    result.description = `Write hit (S→M), invalidate others`;
                    break;
                }
                case STATES.M:
                    // M → M: write hit, no bus action
                    result.newState = STATES.M;
                    result.description = `Write hit (M)`;
                    break;
            }
        }

        return result;
    }
}
