# Golden Mix Benchmark

Each directory exports one versioned ground-truth manifest. The shared factory materializes BPM, downbeats, phrase boundaries, structural sections and vocal regions; every case then defines acceptable and forbidden transition strategies, quality limits and a human reference note.

Run the review-gated corpus with:

```sh
bun run benchmark:golden-mixes
```

When intentionally changing transition policy, inspect every changed case before updating `baseline.ts`. Do not lower a threshold merely to make a regression pass; update a manifest only when listening evidence changes the expected musical behavior.
