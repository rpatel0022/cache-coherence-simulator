# CS 213 Project Proposal — Cache Coherence Protocol Simulator

**Author:** Rushi Patel
**Course:** CS 213 — Multiprocessor Architecture and Programming (Prof. Bingyao Li)
**Date:** April 20, 2026
**Team:** Individual

---

## Introduction & Background

Cache coherence is one of the most fundamental challenges in multiprocessor systems. When multiple cores cache the same shared data, their caches can become inconsistent — one core modifies a value while others still hold stale copies. Coherence protocols (MSI, MESI, MOESI) solve this through state machines that track ownership and coordinate access via bus messages.

While the state transition tables for these protocols are well-defined, tracing through multi-step scenarios by hand is error-prone and hard to visualize. Students can memorize the rules but often struggle to see _why_ MESI and MOESI outperform MSI in specific workload patterns.

## Project Goal & Scope

I plan to build an **interactive, browser-based cache coherence protocol simulator** that:

1. **Simulates three snooping protocols:** MSI, MESI, and MOESI
2. **Visualizes step-by-step execution** — cache state transitions, bus messages, and memory state for each processor
3. **Compares protocols side-by-side** — runs the same memory access trace through all three protocols simultaneously, showing live statistics
4. **Tracks key metrics:** total bus traffic, invalidation count, and writeback count per protocol

The simulator supports 2–4 configurable processors and accepts both pre-loaded example traces (from lecture) and custom user-input traces.

### What's In Scope

- MSI, MESI, MOESI protocol simulation with correct state transitions (snooping-based, write-invalidate)
- Color-coded cache state display per processor
- Bus message log showing each transaction
- Step-by-step execution and auto-run mode
- Side-by-side protocol comparison with bar charts
- 5 pre-loaded traces designed to highlight each protocol's strengths

### What's Out of Scope

- Directory-based coherence (snooping only)
- Write-update protocol
- Multi-level caches (L1/L2)
- Cache replacement policies (assumes unlimited capacity)

## Approach

The simulator is a **single-page web application** built entirely in HTML, CSS, and JavaScript — no backend, no dependencies. Just open `index.html` in a browser.

**Architecture:**

- **Simulation engine** — separate state machine implementations for MSI, MESI, and MOESI, each handling CPU requests and snooped bus events
- **Trace parser** — parses text-format memory access traces (e.g., `P0 R X`, `P1 W X 5`) with input validation
- **UI layer** — cache state grid, bus log, stats dashboard, and comparison view

## Platform & Tools

- **Language:** JavaScript (browser-based, no server)
- **Platform:** Any modern web browser
- **No external libraries or frameworks** — vanilla HTML/CSS/JS

## Evaluation Plan

I will run 5 traces of increasing complexity through all three protocols and compare:

| Trace                             | Purpose                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| Basic read/write sharing (5 ops)  | Baseline — all protocols handle simple sharing                      |
| Single reader then writer (2 ops) | Shows MESI's silent E→M upgrade (zero bus traffic for private data) |
| Modified block shared (3 ops)     | Shows MOESI's M→O transition (avoids memory writeback)              |
| 3-processor contention (5 ops)    | Heavy contention — how bus traffic scales with sharing              |
| Private data, no sharing (6 ops)  | Best case for MESI — E state eliminates unnecessary invalidations   |

**Metrics compared across protocols:**

1. **Total bus messages** — overall communication cost
2. **Invalidation count** — demonstrates MESI's E-state advantage
3. **Writeback count** — demonstrates MOESI's O-state advantage

**Analysis:** Quantitative comparison via bar charts + qualitative discussion of which workload patterns favor which protocol (private data → MESI, sharing-heavy → MOESI).

## Why This Project

This simulator directly applies concepts from Lectures 03–05 (shared memory, cache coherence, memory consistency) into a working tool. The side-by-side comparison feature is designed to make the performance tradeoffs between protocols immediately visible — something that's hard to convey through static slides alone. The project could also serve as a teaching aid for future CS 213 students.
