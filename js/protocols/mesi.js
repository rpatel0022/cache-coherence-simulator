// MESI Protocol — Modified, Exclusive, Shared, Invalid
// Adds E state: only copy, clean. E→M is a SILENT upgrade (no bus traffic).

class MESIProtocol extends BaseProtocol {
    constructor() {
        super();
        this.name = 'MESI';
    }

    handleCpuRequest(currentState, op, blockId, caches, procIndex, metrics) {
        const result = {
            newState: currentState,
            busMessages: [],
            snoopResults: [],
            dataSource: null,
            description: ''
        };

        if (op === 'R') {
            switch (currentState) {
                case STATES.I: {
                    // Read miss — BusRd
                    result.busMessages.push({ type: BUS.BusRd, description: `P${procIndex} BusRd ${blockId}` });
                    metrics.addBusMessage();

                    const othersHave = this.otherCachesHaveBlock(caches, blockId, procIndex);
                    const supplier = this.findSupplier(caches, blockId, procIndex);

                    if (supplier >= 0) {
                        const supplierState = caches[supplier][blockId].state;
                        if (supplierState === STATES.M) {
                            // M holder writes back, goes to S
                            result.snoopResults.push({
                                proc: supplier, oldState: STATES.M, newState: STATES.S,
                                action: `Writeback ${blockId}, supply to P${procIndex}`,
                                writeback: true
                            });
                            metrics.addWriteback();
                            metrics.addBusMessage();
                            result.dataSource = supplier;
                            result.newState = STATES.S; // others have it now
                        } else if (supplierState === STATES.E) {
                            // E holder goes to S, supplies data
                            result.snoopResults.push({
                                proc: supplier, oldState: STATES.E, newState: STATES.S,
                                action: `Supply ${blockId} to P${procIndex}, downgrade E→S`
                            });
                            metrics.addBusMessage();
                            result.dataSource = supplier;
                            result.newState = STATES.S;
                        } else {
                            // S holder — memory supplies
                            metrics.addBusMessage();
                            result.dataSource = 'memory';
                            result.newState = STATES.S;
                        }
                    } else if (othersHave) {
                        // Others have it in S
                        metrics.addBusMessage();
                        result.dataSource = 'memory';
                        result.newState = STATES.S;
                    } else {
                        // No other cache has it → EXCLUSIVE
                        metrics.addBusMessage();
                        result.dataSource = 'memory';
                        result.newState = STATES.E;
                    }

                    result.description = result.newState === STATES.E
                        ? `Read miss → E (exclusive, no other copies)`
                        : `Read miss → S`;
                    break;
                }
                case STATES.S:
                    result.newState = STATES.S;
                    result.description = `Read hit (S)`;
                    break;
                case STATES.E:
                    result.newState = STATES.E;
                    result.description = `Read hit (E)`;
                    break;
                case STATES.M:
                    result.newState = STATES.M;
                    result.description = `Read hit (M)`;
                    break;
            }
        } else if (op === 'W') {
            switch (currentState) {
                case STATES.I: {
                    // Write miss — BusRdX
                    result.busMessages.push({ type: BUS.BusRdX, description: `P${procIndex} BusRdX ${blockId}` });
                    metrics.addBusMessage();

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
                            metrics.addBusMessage();
                            metrics.addInvalidation();
                            result.dataSource = i;
                            dataSourceSet = true;
                        } else if (block.state === STATES.E) {
                            result.snoopResults.push({
                                proc: i, oldState: STATES.E, newState: STATES.I,
                                action: `Supply ${blockId}, invalidate`
                            });
                            metrics.addBusMessage();
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
                        metrics.addBusMessage();
                        result.dataSource = 'memory';
                    }

                    result.newState = STATES.M;
                    result.description = `Write miss → M`;
                    break;
                }
                case STATES.S: {
                    // S → M: BusUpgr, invalidate others
                    result.busMessages.push({ type: BUS.BusUpgr, description: `P${procIndex} BusUpgr ${blockId}` });
                    metrics.addBusMessage();

                    for (let i = 0; i < caches.length; i++) {
                        if (i === procIndex) continue;
                        const block = caches[i][blockId];
                        if (!block || block.state === STATES.I) continue;
                        if (block.state === STATES.S) {
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
                case STATES.E:
                    // E → M: SILENT upgrade! No bus traffic!
                    result.newState = STATES.M;
                    result.description = `Write hit (E→M) — silent upgrade, no bus traffic!`;
                    break;
                case STATES.M:
                    result.newState = STATES.M;
                    result.description = `Write hit (M)`;
                    break;
            }
        }

        return result;
    }
}
