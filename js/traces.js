// Pre-loaded example traces from CS 213 Lecture 04

const TRACES = {
    "Basic MSI (L04 Example)":
`# Classic MSI trace from Lecture 04 worked example
# Shows read sharing, write invalidation, writeback on read miss
P0 R X
P1 R X
P0 W X 5
P1 R X
P1 W X 10`,

    "MESI Advantage — Silent Upgrade":
`# Only one reader → gets Exclusive state
# Write upgrades E→M silently (zero bus traffic!)
# Compare MSI: read gets S, write needs BusUpgr
P0 R X
P0 W X 42`,

    "MOESI Advantage — No Writeback":
`# P0 reads then writes → M state
# P1 reads → triggers BusRd
# MSI: M must writeback to memory then go to S
# MOESI: M goes to O, supplies data directly, NO writeback!
P0 R X
P0 W X 99
P1 R X`,

    "3-Processor Contention (L04 Practice)":
`# Heavy contention: 3 processors fighting over block A
# Shows invalidation cascades and writebacks
P0 R A
P1 R A
P2 W A 42
P0 R A
P1 W A 99`,

    "SMT Cacheline Sharing (HW Example)":
`# 4-core 2-way SMT system with thread-to-core and variable-to-cacheline mapping
# Threads 0,1 → Core 0 | Threads 2,3 → Core 1 | Thread 4 → Core 2 | Thread 5 → Core 3
# Variables A,B → cacheline FOO | Variables C,D → cacheline BAR
# Thread 0: Load A → Core 0 reads FOO
P0 R FOO
# Thread 1: Load B → Core 0 reads FOO (hit, already in S)
P0 R FOO
# Thread 2: Store C → Core 1 writes BAR
P1 W BAR
# Thread 0: Store A → Core 0 writes FOO
P0 W FOO
# Thread 3: Load C → Core 1 reads BAR (hit, already in M)
P1 R BAR
# Thread 3: Store A → Core 1 writes FOO
P1 W FOO
# Thread 4: Load B → Core 2 reads FOO
P2 R FOO
# Thread 5: Load D → Core 3 reads BAR
P3 R BAR
# Thread 0: Load B → Core 0 reads FOO
P0 R FOO`,

    "Private Data — MESI Shines":
`# Each processor works on its own block — no sharing
# MSI: every read gets S, every write needs BusUpgr
# MESI: reads get E (only copy), writes upgrade silently E→M
P0 R A
P0 W A 1
P1 R B
P1 W B 2
P2 R C
P2 W C 3`
};
