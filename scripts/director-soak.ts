import { runDirectorSoakV1 } from "../src/director-soak-v1";

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index++) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (key?.startsWith("--") && value && !value.startsWith("--")) {
        args.set(key.slice(2), value);
        index++;
    }
}

const report = runDirectorSoakV1({
    iterations: Number(args.get("iterations") ?? 500),
    seed: Number(args.get("seed") ?? 42),
    p99BudgetMicros: Number(args.get("p99-budget-micros") ?? 50_000),
});
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
