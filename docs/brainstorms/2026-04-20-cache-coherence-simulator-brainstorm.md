# Brainstorm: Cache Coherence Protocol Simulator

**Date:** 2026-04-20
**Status:** Ready for planning
**Author:** Rushi Patel (solo)
**Course:** CS 213 — Multiprocessor Architecture and Programming (Prof. Bingyao Li, UCR)

---

## What We're Building

An interactive, browser-based cache coherence protocol simulator that:

1. **Simulates three protocols:** MSI, MESI, and MOESI
2. **Visualizes step-by-step** cache state transitions, bus messages, and memory state for each processor
3. **Compares protocols side-by-side** — run the same trace through all three simultaneously, showing stats in real time
4. **Tracks key metrics:** bus traffic (total messages), invalidations, and writebacks per protocol
5. **Supports 2-4 configurable processors** with multiple memory blocks
6. **Accepts input** via pre-loaded example traces (from lecture) AND custom user-typed traces

## Why This Approach

- **Directly maps to L04 lecture material** — every state transition table, every protocol comparison from the notes becomes a feature in the simulator
- **Zero-install demo** — pure HTML/CSS/JS, just open `index.html` in a browser. Perfect for the 15-minute presentation
- **The side-by-side comparison IS the analysis** — running the same trace through MSI vs MESI vs MOESI automatically generates the data for the final report's evaluation section
- **Teaching tool angle** — positions the project as something that could help future CS 213 students, which professors love
- **Solo-feasible** — no backend, no special hardware, no dependencies. Just a browser

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Interface | Web UI (browser-based) | Best presentation impact, zero setup for demo |
| Language | All JavaScript (no backend) | No server, no install, just open index.html |
| Processor count | 2-4 configurable | Matches lecture examples, flexible without overcomplicating UI |
| Input method | Pre-loaded examples + custom text input | Pre-loaded for quick demos, custom for exploration |
| Wow feature | Side-by-side protocol comparison | Instantly shows why MESI/MOESI improve on MSI — this IS the analysis |
| Metrics | Bus traffic, invalidations, writebacks | The three key costs from L04. Directly shows what each protocol optimizes |

## Scope — What's In vs. Out

### In Scope (Must Have)
- MSI, MESI, MOESI protocol simulation with correct state transitions
- Per-processor cache state display (color-coded by state: M=red, E=blue, S=green, I=gray, O=orange)
- Bus message log (what message, who sent it, who responded)
- Memory state tracking (current value, dirty/clean)
- Step-by-step execution (Step button) and auto-run mode
- Side-by-side comparison view with live stats
- 3-5 pre-loaded example traces from lecture (the ones in L04 notes)
- Custom trace input via text box
- Summary stats dashboard (total bus messages, invalidations, writebacks per protocol)
- Bar chart or table comparing protocols after trace completes

### Out of Scope (Don't Build)
- Directory-based coherence (snooping only — matches lecture emphasis)
- Write-update protocol (lecture focuses on write-invalidate)
- Animated FSM state diagrams (nice but not worth the time)
- Multi-level caches (L1/L2) — keep it single-level
- Cache replacement policies (assume fully associative, unlimited capacity)
- Network/interconnect simulation

## Pre-Loaded Example Traces

These come directly from L04 notes and lecture slides:

1. **Basic MSI trace:** P1 reads X, P2 reads X, P1 writes X=5, P2 reads X, P2 writes X=10
2. **MESI advantage:** P1 reads X (gets E), P1 writes X (E→M silently, no bus traffic!)
3. **MOESI advantage:** P1 reads X, P1 writes X, P2 reads X (M→O, no memory writeback)
4. **3-processor trace:** P1 reads A, P2 reads A, P3 writes A=42, P1 reads A, P2 writes A=99
5. **Custom (empty):** User types their own

## Deliverable Timeline

| Date | Deliverable | What's Due |
|---|---|---|
| 4/26 | **Proposal** (1-2 pages) | Problem statement, approach, evaluation plan |
| ~5/15 | **Core simulator done** | All 3 protocols working, basic UI |
| ~5/25 | **Comparison view + polish** | Side-by-side mode, stats, pre-loaded traces |
| 6/1-6/3 | **Presentation** (15 min) | Live demo + analysis slides |
| 6/12 | **Final report + code** | 4-page report, all source code |

## Evaluation Plan (for the report)

Run 4-5 traces of increasing complexity through all three protocols. For each trace, compare:

1. **Total bus messages** — MSI vs MESI vs MOESI
2. **Invalidation count** — shows MESI's E-state advantage
3. **Writeback count** — shows MOESI's O-state advantage
4. **Qualitative analysis** — which protocol is best for which workload pattern (private data heavy → MESI wins, sharing-heavy → MOESI wins)

This data comes directly from running the simulator — the tool generates its own evaluation data.

## Open Questions

*None — all key decisions resolved during brainstorm.*
