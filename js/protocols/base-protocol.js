// Base Protocol — shared cache state management and interface

// Valid states across all protocols
const STATES = {
    M: 'M',  // Modified — only copy, dirty
    O: 'O',  // Owned — dirty, responsible for supplying (MOESI only)
    E: 'E',  // Exclusive — only copy, clean (MESI/MOESI only)
    S: 'S',  // Shared — clean copy, others may have it
    I: 'I'   // Invalid — not present
};

// Bus message types
const BUS = {
    BusRd:   'BusRd',    // Read miss — need a copy
    BusRdX:  'BusRdX',   // Read-exclusive — need copy for writing (write miss from I)
    BusUpgr: 'BusUpgr',  // Upgrade — already have copy, want to write (S→M)
};

class CacheBlock {
    constructor() {
        this.state = STATES.I;
        this.value = null;
    }
}

class BaseProtocol {
    constructor() {
        this.name = 'Base';
    }

    // Returns: { newState, busMessage (or null), description }
    handleCpuRequest(currentState, op, blockId, caches, procIndex, metrics) {
        throw new Error('Subclass must implement handleCpuRequest');
    }

    // Check if any other cache has this block in a non-Invalid state
    otherCachesHaveBlock(caches, blockId, excludeProc) {
        for (let i = 0; i < caches.length; i++) {
            if (i === excludeProc) continue;
            const block = caches[i][blockId];
            if (block && block.state !== STATES.I) return true;
        }
        return false;
    }

    // Get all caches that have this block in a specific state
    getCachesInState(caches, blockId, state, excludeProc) {
        const result = [];
        for (let i = 0; i < caches.length; i++) {
            if (i === excludeProc) continue;
            const block = caches[i][blockId];
            if (block && block.state === state) result.push(i);
        }
        return result;
    }

    // Find the cache that can supply data (M, O, or E state)
    findSupplier(caches, blockId, excludeProc) {
        for (let i = 0; i < caches.length; i++) {
            if (i === excludeProc) continue;
            const block = caches[i][blockId];
            if (block && (block.state === STATES.M || block.state === STATES.O || block.state === STATES.E)) {
                return i;
            }
        }
        return -1; // memory supplies
    }
}
