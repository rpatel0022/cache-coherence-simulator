// Metrics tracker — counts bus traffic, invalidations, writebacks

class Metrics {
    constructor() {
        this.reset();
    }

    reset() {
        this.busTraffic = 0;
        this.invalidations = 0;
        this.writebacks = 0;
    }

    addBusMessage(count = 1) {
        this.busTraffic += count;
    }

    addInvalidation(count = 1) {
        this.invalidations += count;
    }

    addWriteback(count = 1) {
        this.writebacks += count;
    }

    snapshot() {
        return {
            busTraffic: this.busTraffic,
            invalidations: this.invalidations,
            writebacks: this.writebacks
        };
    }
}
