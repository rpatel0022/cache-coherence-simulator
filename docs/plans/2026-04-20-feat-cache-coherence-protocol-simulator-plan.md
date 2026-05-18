---
title: "feat: Cache Coherence Protocol Simulator"
type: feat
status: active
date: 2026-04-20
origin: docs/brainstorms/2026-04-20-cache-coherence-simulator-brainstorm.md
---

# Cache Coherence Protocol Simulator

## Overview

An interactive, browser-based simulator that models **MSI, MESI, and MOESI** snooping cache coherence protocols. Users input memory access traces (pre-loaded or custom), step through execution, and compare protocols side-by-side with live metrics. Built as a solo CS 213 final project (40% of grade).

**Key value:** The side-by-side comparison mode IS the evaluation — the tool generates its own analysis data for the final report.

## Problem Statement / Motivation

Cache coherence protocols are hard to understand from static slides alone. Students memorize state transition tables but can't trace through multi-step scenarios confidently. This simulator lets users see exactly what happens at each step — which cache changes state, what goes on the bus, and why MESI/MOESI outperform MSI in specific workloads.

(see brainstorm: docs/brainstorms/2026-04-20-cache-coherence-simulator-brainstorm.md — "Teaching tool angle")

## Proposed Solution

A single-page web application (pure HTML/CSS/JS, no backend) with three layers:

1. **Simulation Engine** — protocol state machines for MSI, MESI, MOESI with metric tracking
2. **Trace Parser** — parses text-format memory access traces into structured operations
3. **UI Layer** — cache state grid, bus log, stats dashboard, comparison view

### Architecture

```
index.html
├── css/
│   └── styles.css
├── js/
│   ├── protocols/
│   │   ├── base-protocol.js    ← shared state machine logic
│   │   ├── msi.js              ← MSI transitions
│   │   ├── mesi.js             ← MESI transitions (extends base)
│   │   └── moesi.js            ← MOESI transitions (extends base)
│   ├── simulator.js            ← orchestrates execution, manages cache/memory state
│   ├── trace-parser.js         ← parses trace text into operations
│   ├── metrics.js              ← counts bus traffic, invalidations, writebacks
│   ├── ui.js                   ← renders state grid, bus log, controls
│   ├── comparison.js           ← side-by-side mode logic
│   └── traces.js               ← pre-loaded example traces
└── README.md
```

## Technical Specification

### Trace Format

```
P<n> <R|W> <block_id> [value]
```

- `P<n>` — processor index, zero-indexed (P0, P1, P2, P3)
- `R` or `W` — read or write
- `<block_id>` — memory block identifier (letter or number: A, B, X, 0, 1)
- `[value]` — optional write value (default: auto-increment)
- One instruction per line, blank lines and `#` comments allowed
- Processor index must be < configured processor count (else: error shown inline)

**Example:**
```
# Basic MSI trace from Lecture 04
P0 R X
P1 R X
P0 W X 5
P1 R X
P1 W X 10
```

### Protocol State Machines

#### MSI — CPU Requests

| Current | Event | Next | Bus Message | Metric Counted |
|---|---|---|---|---|
| I | Read | S | BusRd | +1 bus traffic |
| I | Write | M | BusRdX | +1 bus traffic |
| S | Read | S | — | — |
| S | Write | M | BusUpgr | +1 bus traffic, +1 invalidation per S copy |
| M | Read | M | — | — |
| M | Write | M | — | — |

#### MSI — Bus Snooped Events

| Current | Bus Event | Next | Action | Metric Counted |
|---|---|---|---|---|
| S | BusRd | S | — | — |
| S | BusRdX | I | Invalidate | — (counted at requester) |
| S | BusUpgr | I | Invalidate | — (counted at requester) |
| M | BusRd | S | Writeback + supply data | +1 writeback, +1 bus traffic |
| M | BusRdX | I | Writeback + supply data | +1 writeback, +1 bus traffic |

#### MESI — Additions to MSI

| Current | Event | Next | Bus Message | Notes |
|---|---|---|---|---|
| I | Read (no other copies) | **E** | BusRd | Exclusive — only copy, clean |
| I | Read (other copies exist) | S | BusRd | Shared — others have it |
| **E** | Read | E | — | Hit, no bus |
| **E** | Write | **M** | — | **Silent upgrade! No bus traffic!** |
| **E** | Snooped BusRd | S | Supply data | Downgrade to shared |
| **E** | Snooped BusRdX | I | Supply data | Give up block |

**Key implementation detail:** On a BusRd, the simulator checks ALL other caches. If no other cache holds the block → requester gets E. If any other cache holds it → requester gets S. This is how E-state is determined.

#### MOESI — Additions to MESI

| Current | Event | Next | Bus Message | Notes |
|---|---|---|---|---|
| M | Snooped BusRd | **O** | Supply data (NO writeback) | **Owner — no memory write!** |
| **O** | Read | O | — | Hit, still owner |
| **O** | Write | M | BusUpgr | Invalidate S copies, become M |
| **O** | Snooped BusRd | O | Supply data | Still owner, supply to requester |
| **O** | Snooped BusRdX | I | Supply data | Give up ownership |

**Key difference from MESI:** When M-state cache is snooped by BusRd, it goes to O (not S) and does NOT writeback to memory. The O-state cache is responsible for supplying data on future requests. This saves writebacks — the defining advantage of MOESI.

### Metric Counting Rules

All three protocols use the same counting method for fair comparison:

| Metric | What's Counted | Example |
|---|---|---|
| **Bus traffic** | Each bus message sent (request OR response). BusRd = 1, BusRdX = 1, BusUpgr = 1, data supply = 1, writeback = 1 | P0 reads X (miss): BusRd + data reply = 2 messages |
| **Invalidations** | Each cache line that transitions to I due to another processor's action. If 3 caches go S→I, that's 3 invalidations | P0 writes X, P1 and P2 in S: 2 invalidations |
| **Writebacks** | Each time dirty data is written from cache to memory | M→S on BusRd in MSI: 1 writeback |

### Simulation Model Assumptions

- **Unlimited cache capacity** — no evictions, no replacement policy (see brainstorm: out of scope)
- **Sequential trace execution** — one operation per step, no simultaneous requests, no bus arbitration needed
- **Write-invalidate only** — no write-update (see brainstorm: out of scope)
- **Snooping only** — no directory protocol (see brainstorm: out of scope)
- **Single-level cache** — no L1/L2 hierarchy

### UI Specification

#### Layout (Single Protocol Mode)

```
┌─────────────────────────────────────────────────────────┐
│  Cache Coherence Simulator          [MSI▼] [Procs: 3▼] │
│─────────────────────────────────────────────────────────│
│  Trace Input:                    │  Controls:           │
│  ┌─────────────────────────┐     │  [▶ Step] [▶▶ Run]  │
│  │ P0 R X                  │     │  [↻ Reset]           │
│  │ P1 R X                  │     │  Speed: [━━━●━━]     │
│  │ P0 W X 5                │     │                      │
│  │ P1 R X  ← highlighted   │     │  Pre-loaded: [▼]     │
│  └─────────────────────────┘     │                      │
│─────────────────────────────────────────────────────────│
│  Cache States:           │  Memory:                     │
│       P0    P1    P2     │    X = 5 (dirty in P0)       │
│  X  [ M ]  [ I ]  [ I ] │    A = 0 (clean)             │
│  A  [ S ]  [ S ]  [ I ] │                              │
│─────────────────────────────────────────────────────────│
│  Bus Log:                │  Stats:                      │
│  4. P1 BusRd X → P0     │  Bus messages:  7            │
│  3. P0 BusUpgr X        │  Invalidations: 3            │
│  2. P1 BusRd X → mem    │  Writebacks:    1            │
│  1. P0 BusRd X → mem    │                              │
└─────────────────────────────────────────────────────────┘
```

#### Layout (Comparison Mode)

```
┌─────────────────────────────────────────────────────────┐
│  Compare All Protocols     Trace: [Basic MSI ▼]        │
│  [▶ Step All] [▶▶ Run All] [↻ Reset]    Procs: [3▼]   │
│─────────────────────────────────────────────────────────│
│  MSI              │  MESI             │  MOESI          │
│  P0  P1  P2       │  P0  P1  P2       │  P0  P1  P2    │
│  [S] [I] [I]      │  [E] [I] [I]      │  [E] [I] [I]   │
│                   │                   │                  │
│  Bus: 7           │  Bus: 5           │  Bus: 4          │
│  Inv: 3           │  Inv: 1           │  Inv: 1          │
│  WB:  2           │  WB:  1           │  WB:  0          │
│─────────────────────────────────────────────────────────│
│  Comparison Summary:                                    │
│  ████████████  MSI  — 7 bus msgs                       │
│  █████████     MESI — 5 bus msgs  (29% less)           │
│  ███████       MOESI— 4 bus msgs  (43% less)           │
└─────────────────────────────────────────────────────────┘
```

#### Color Coding

| State | Color | CSS |
|---|---|---|
| M (Modified) | Red | `#e74c3c` |
| E (Exclusive) | Blue | `#3498db` |
| O (Owned) | Orange | `#e67e22` |
| S (Shared) | Green | `#2ecc71` |
| I (Invalid) | Gray | `#95a5a6` |

#### UI States & Interactions

| Scenario | Behavior |
|---|---|
| Page load | Protocol: MSI, Processors: 2, Trace: first pre-loaded example loaded, Step/Run enabled |
| Empty trace + Step clicked | Show inline error: "Enter a trace first" |
| Invalid trace syntax | Show inline error under trace input with line number |
| Trace references P3 but procs=2 | Error: "P3 referenced but only 2 processors configured" |
| Step clicked | Execute one trace instruction, advance highlight, update grid/log/stats |
| Run clicked | Auto-step with configurable delay (default 800ms), button changes to [⏸ Pause] |
| Pause clicked | Stop auto-run, re-enable Step |
| Trace exhausted | Show "Simulation Complete" banner, disable Step/Run, keep Reset enabled |
| Reset clicked | Clear all cache states, bus log, stats. Keep trace and settings. Move highlight to top |
| Protocol changed mid-run | Reset simulation, keep trace |
| Processor count changed | Reset simulation, keep trace (validate trace against new count) |
| Switch to comparison mode | Reset, run trace through all 3 protocols in parallel (each gets its own state) |

### Pre-Loaded Traces

```javascript
const TRACES = {
  "Basic MSI (L04 Example)": `
    P0 R X
    P1 R X
    P0 W X 5
    P1 R X
    P1 W X 10
  `,
  "MESI Advantage — Silent Upgrade": `
    # Only one reader → gets Exclusive
    # Write upgrades E→M silently (no bus traffic!)
    P0 R X
    P0 W X 42
  `,
  "MOESI Advantage — No Writeback": `
    # P0 reads then writes → M state
    # P1 reads → MSI: writeback + S. MOESI: O state, no writeback!
    P0 R X
    P0 W X 99
    P1 R X
  `,
  "3-Processor Contention (L04 Practice)": `
    P0 R A
    P1 R A
    P2 W A 42
    P0 R A
    P1 W A 99
  `,
  "Private Data — MESI Shines": `
    # Each processor works on its own block — no sharing
    # MSI: every write needs BusUpgr. MESI: E→M is silent
    P0 R A
    P0 W A 1
    P1 R B
    P1 W B 2
    P2 R C
    P2 W C 3
  `
};
```

## Implementation Phases

### Phase 1: Core Engine (Target: ~5/1)

Build the simulation logic with no UI — test via console.

**Files:**
- `js/protocols/base-protocol.js` — `CacheBlock` class (state, value, dirty), base transition logic
- `js/protocols/msi.js` — MSI `handleCpuRequest(proc, op, block)` and `handleBusEvent(proc, event, block)`
- `js/trace-parser.js` — parse trace text → `[{proc, op, block, value}]`, validation
- `js/simulator.js` — `Simulator` class: manages array of caches, memory, executes one step at a time, calls protocol handlers
- `js/metrics.js` — `Metrics` class: `{busTraffic, invalidations, writebacks}`, increment methods

**Acceptance criteria:**
- [ ] MSI protocol produces correct state transitions for all 5 pre-loaded traces
- [ ] Traces verified against L04 notes worked examples (exact state match at each step)
- [ ] Trace parser rejects invalid syntax with line-number error messages
- [ ] Metrics match hand-calculated values for each trace

### Phase 2: Basic UI (Target: ~5/10)

Wire the engine to a web interface — single protocol mode only.

**Files:**
- `index.html` — page structure, layout
- `css/styles.css` — grid layout, state colors, responsive design
- `js/ui.js` — render cache grid, bus log, memory panel, controls, trace input
- `js/traces.js` — pre-loaded trace data

**Acceptance criteria:**
- [ ] Cache state grid updates with color-coded states after each step
- [ ] Bus log shows each message with step number, processor, type, block
- [ ] Stats panel shows live bus traffic / invalidations / writebacks counts
- [ ] Step, Run (with pause), Reset buttons work correctly
- [ ] Pre-loaded trace dropdown populates trace input
- [ ] Custom trace input with inline validation errors
- [ ] Speed slider controls auto-run delay (200ms to 2000ms)
- [ ] Current trace instruction highlighted during execution

### Phase 3: MESI + MOESI (Target: ~5/18)

Add the remaining two protocols.

**Files:**
- `js/protocols/mesi.js` — MESI transitions, E-state logic
- `js/protocols/moesi.js` — MOESI transitions, O-state logic

**Acceptance criteria:**
- [ ] MESI: E state granted when no other cache has the block
- [ ] MESI: E→M upgrade is silent (no bus message, no metric increment)
- [ ] MOESI: M→O on snooped BusRd (no writeback to memory)
- [ ] MOESI: O-state cache supplies data on subsequent BusRd
- [ ] Protocol dropdown switches between MSI/MESI/MOESI with correct behavior
- [ ] All 5 pre-loaded traces produce correct results under all 3 protocols

### Phase 4: Comparison Mode (Target: ~5/25)

The wow feature — side-by-side protocol comparison.

**Files:**
- `js/comparison.js` — runs 3 independent `Simulator` instances with the same trace

**Acceptance criteria:**
- [ ] "Compare All" button/mode runs same trace through MSI, MESI, MOESI simultaneously
- [ ] Three columns show cache states for each protocol at each step
- [ ] Step All / Run All advances all three in lockstep
- [ ] Stats displayed per-protocol below each column
- [ ] Summary bar chart shows bus traffic comparison with percentage reduction
- [ ] Comparison data matches expected results from L04 notes

### Phase 5: Polish + Report (Target: ~6/3)

Prepare for presentation and final submission.

**Tasks:**
- [ ] Test all traces across all protocols — verify correctness
- [ ] Run 4-5 traces of increasing complexity, capture comparison screenshots
- [ ] Write 4-page final report (problem, approach, implementation, results, analysis, conclusions)
- [ ] Build 15-minute presentation with live demo plan
- [ ] Add README.md with project description, how to run, architecture overview
- [ ] Clean up code, add comments where non-obvious

## Evaluation Plan (for the Report)

Run these traces through comparison mode and capture the stats:

| Trace | What It Shows |
|---|---|
| Basic MSI (5 ops) | Baseline — all protocols handle simple read/write sharing |
| MESI Advantage (2 ops) | MESI saves bus traffic on private data (E→M silent) |
| MOESI Advantage (3 ops) | MOESI saves writebacks on shared dirty data (M→O) |
| 3-Processor Contention (5 ops) | Heavy contention — shows how bus traffic scales |
| Private Data (6 ops) | Best case for MESI — no sharing, E state everywhere |

**Analysis angles:**
1. **Quantitative:** Bar charts comparing bus traffic, invalidations, writebacks across protocols per trace
2. **Qualitative:** Which workload patterns favor which protocol? (private data → MESI, shared-write-heavy → MOESI)
3. **Takeaway:** Protocol choice is a tradeoff between complexity and performance — more states = fewer bus messages but more complex hardware

## Deliverable Timeline

| Date | Milestone | Deliverable |
|---|---|---|
| 4/26 | **Proposal due** | 1-2 page proposal (extract from this plan) |
| ~5/1 | Phase 1 done | Core engine, MSI working, console-tested |
| ~5/10 | Phase 2 done | Basic UI, single protocol mode |
| ~5/18 | Phase 3 done | All 3 protocols working |
| ~5/25 | Phase 4 done | Comparison mode, stats, bar chart |
| 6/1-6/3 | **Presentation** | 15-min live demo + slides |
| 6/12 | **Final report + code** | 4-page report, all source code |

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| MOESI transitions are complex | Use L04 notes as ground truth, test against hand-traced examples |
| E-state detection requires checking all caches | Simulator already manages all cache state — just iterate |
| Side-by-side layout might be crowded | Keep it simple — show states + stats, not full bus logs in comparison mode |
| Time pressure (solo, other coursework) | Phases are incremental — even Phase 2 alone is a working project |

## Sources & References

### Origin
- **Brainstorm document:** [docs/brainstorms/2026-04-20-cache-coherence-simulator-brainstorm.md](docs/brainstorms/2026-04-20-cache-coherence-simulator-brainstorm.md)
- Key decisions carried forward: Web UI, all-JS, side-by-side comparison, 2-4 procs, bus traffic/invalidations/writebacks metrics

### Course Materials
- CS 213 Lecture 04: Cache Coherence (Prof. Bingyao Li)
- CS 213 Lecture 04 study notes: `~/Desktop/CS213/notes/04-Cache-Coherence-notes.md`
- Course textbook (optional): Parallel Computer Architecture, Culler et al., Chapters 6 & 8
