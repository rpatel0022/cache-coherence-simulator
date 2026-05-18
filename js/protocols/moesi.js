// MOESI Protocol — Modified, Owned, Exclusive, Shared, Invalid
// Adds O state: dirty copy, responsible for supplying data. M→O on snooped BusRd (no writeback!)

class MOESIProtocol extends BaseProtocol {
    constructor() {
        super();
        this.name = 'MOESI';
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
                    result.busMessages.push({ type: BUS.BusRd, description: `P${procIndex} BusRd ${blockId}` });
                    metrics.addBusMessage();

                    const supplier = this.findSupplier(caches, blockId, procIndex);
                    const othersHave = this.otherCachesHaveBlock(caches, blockId, procIndex);

                    if (supplier >= 0) {
                        const supplierState = caches[supplier][blockId].state;
                        if (supplierState === STATES.M) {
                            // M → O: owner supplies data, NO writeback (MOESI key difference!)
                            result.snoopResults.push({
                                proc: supplier, oldState: STATES.M, newState: STATES.O,
                                action: `Supply ${blockId} to P${procIndex}, M→O (no writeback!)`,
                                writeback: false
                            });
                            metrics.addBusMessage(); // data supply
                            result.dataSource = supplier;
                            result.newState = STATES.S;
                        } else if (supplierState === STATES.O) {
                            // O stays O, supplies data
                            result.snoopResults.push({
                                proc: supplier, oldState: STATES.O, newState: STATES.O,
                                action: `Supply ${blockId} to P${procIndex} (still owner)`
                            });
                            metrics.addBusMessage();
                            result.dataSource = supplier;
                            result.newState = STATES.S;
                        } else if (supplierState === STATES.E) {
                            // E → S, supplies data
                            result.snoopResults.push({
                                proc: supplier, oldState: STATES.E, newState: STATES.S,
                                action: `Supply ${blockId} to P${procIndex}, E→S`
                            });
                            metrics.addBusMessage();
                            result.dataSource = supplier;
                            result.newState = STATES.S;
                        } else {
                            metrics.addBusMessage();
                            result.dataSource = 'memory';
                            result.newState = STATES.S;
                        }
                    } else if (othersHave) {
                        metrics.addBusMessage();
                        result.dataSource = 'memory';
                        result.newState = STATES.S;
                    } else {
                        // No other copies → Exclusive
                        metrics.addBusMessage();
                        result.dataSource = 'memory';
                        result.newState = STATES.E;
                    }

                    result.description = result.newState === STATES.E
                        ? `Read miss → E (exclusive)`
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
                case STATES.O:
                    result.newState = STATES.O;
                    result.description = `Read hit (O)`;
                    break;
                case STATES.M:
                    result.newState = STATES.M;
                    result.description = `Read hit (M)`;
                    break;
            }
        } else if (op === 'W') {
            switch (currentState) {
                case STATES.I: {
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
                                action: `Supply ${blockId}, invalidate (M→I)`,
                                writeback: false
                            });
                            // M holder supplies but no writeback needed in MOESI context
                            // since requester is taking ownership
                            metrics.addBusMessage();
                            metrics.addInvalidation();
                            result.dataSource = i;
                            dataSourceSet = true;
                        } else if (block.state === STATES.O) {
                            result.snoopResults.push({
                                proc: i, oldState: STATES.O, newState: STATES.I,
                                action: `Supply ${blockId}, give up ownership (O→I)`
                            });
                            metrics.addBusMessage();
                            metrics.addInvalidation();
                            result.dataSource = i;
                            dataSourceSet = true;
                        } else if (block.state === STATES.E) {
                            result.snoopResults.push({
                                proc: i, oldState: STATES.E, newState: STATES.I,
                                action: `Supply ${blockId}, invalidate (E→I)`
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
                    result.busMessages.push({ type: BUS.BusUpgr, description: `P${procIndex} BusUpgr ${blockId}` });
                    metrics.addBusMessage();

                    for (let i = 0; i < caches.length; i++) {
                        if (i === procIndex) continue;
                        const block = caches[i][blockId];
                        if (!block || block.state === STATES.I) continue;

                        if (block.state === STATES.O) {
                            // O holder gives up ownership
                            result.snoopResults.push({
                                proc: i, oldState: STATES.O, newState: STATES.I,
                                action: `Give up ownership of ${blockId} (O→I)`
                            });
                            metrics.addInvalidation();
                        } else if (block.state === STATES.S) {
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
                case STATES.O: {
                    // O → M: BusUpgr to invalidate S copies
                    result.busMessages.push({ type: BUS.BusUpgr, description: `P${procIndex} BusUpgr ${blockId}` });
                    metrics.addBusMessage();

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
                    result.description = `Write hit (O→M), invalidate S copies`;
                    break;
                }
                case STATES.E:
                    // E → M: silent upgrade
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
