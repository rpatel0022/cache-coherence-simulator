# Cache Coherence Protocol Simulator

Browser-based simulator for MSI, MESI, and MOESI cache coherence protocols. Built for CS 213 (Multiprocessor Architecture and Programming).

## How to Run

Open `index.html` in any modern browser. No build step or server required.

## Features

- **Single Protocol Mode**: Step through traces with one protocol, see cache states, bus log, and statistics
- **Compare Mode**: Run the same trace on all 3 protocols side-by-side with bar chart comparison
- **Pre-loaded traces**: Example traces demonstrating each protocol's advantages
- **Trace highlighting**: Current instruction highlighted during stepping

## Trace Format

One instruction per line:

```
P<n> <R|W> <block> [value]
```

- `P<n>` — processor index (P0, P1, P2, P3)
- `R` / `W` — read or write
- `<block>` — cache block identifier (e.g., X, A, B)
- `[value]` — optional write value (auto-incremented if omitted)

Comments start with `#`. Blank lines are ignored.

**Example:**
```
P0 R X
P1 W X 5
P0 R X
```

## Architecture

```
index.html              Entry point
css/styles.css          All styles
js/
  protocols/
    base-protocol.js    States, bus types, CacheBlock, BaseProtocol
    msi.js              MSI protocol transitions
    mesi.js             MESI protocol transitions (adds E state)
    moesi.js            MOESI protocol transitions (adds O state)
  simulator.js          Orchestrates execution, manages caches and memory
  trace-parser.js       Parses trace text into operations
  traces.js             Pre-loaded example traces
  metrics.js            Bus traffic, invalidation, writeback counters
  ui.js                 DOM wiring, rendering, event handling
```

## Protocols

| Protocol | States | Key Feature |
|----------|--------|-------------|
| MSI      | M, S, I | Baseline — every write from S needs BusUpgr |
| MESI     | M, E, S, I | E state enables silent E->M upgrade (no bus traffic) |
| MOESI    | M, O, E, S, I | O state avoids writebacks on shared reads (M->O, not M->S+writeback) |
