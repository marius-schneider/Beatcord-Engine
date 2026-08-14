import { runGoldenMixBenchmark } from "../src/golden-mix-benchmark";
import { goldenMixBaseline } from "../tests/mixes/baseline";
import { goldenMixCases } from "../tests/mixes/index";

const report = runGoldenMixBenchmark(goldenMixCases, goldenMixBaseline.thresholds);

console.log("Golden Mix Benchmark v1");
for (const item of report.cases) {
    const status = item.passed ? "PASS" : "FAIL";
    console.log(
        `${status.padEnd(4)}  ${item.caseId.padEnd(22)} ${item.recommendedType.padEnd(9)} natural ${item.naturalness.toFixed(1).padStart(5)}  risk ${item.artifactRisk.toFixed(1).padStart(5)}`,
    );
    for (const failure of item.failures) console.log(`      ${failure}`);
}
console.log(
    `\n${report.passedCases}/${report.totalCases} passed | naturalness ${report.meanNaturalness.toFixed(1)} | artifact risk ${report.meanArtifactRisk.toFixed(1)} | forbidden ${(report.forbiddenOfferRate * 100).toFixed(1)}%`,
);
if (!report.passed) {
    for (const failure of report.failures) console.error(`REGRESSION: ${failure}`);
    process.exitCode = 1;
}
