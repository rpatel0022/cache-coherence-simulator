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
