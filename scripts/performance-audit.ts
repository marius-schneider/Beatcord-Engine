import { emptyRuntimeEvidenceSummary } from "../src/runtime-evidence-ledger-v1";
import { benchmarkSyncV1, determinismAuditV1, performanceBudgetStatus } from "../src/performance-stability-v1";
import { compileValidationRuntimeV1, type ValidationRuntimeCompilerInputV1 } from "../src/validation-runtime-compiler-v1";

const input: ValidationRuntimeCompilerInputV1 = {
    currentTrackId: "perf-a",
    nextTrackId: "perf-b",
    transitionType: "blend",
    fadeSec: 8,
    stemsReady: false,
    beat: { compatibility: 0.9, bpmConfidence: 0.8, rhythmicMismatch: 0.1, phraseCompatibility: 0.9 },
    stem: { quality: 0.8, artifactSalience: 0.1, stretchArtifacts: 0.1, spectralCollision: 0.1, vocalCollision: 0.1, spatialQuality: 0.9, spatialCollisionRisk: 0.1, maskingRisk: 0.1, postRendererRisk: 0.1, manipulationCost: 0.2, totalQualityRisk: 0.1 },
    taste: { profileDrift: 0, userConfirmedChange: 0, profileIdentification: 1 },
    intervention: { experience: "other", experienceImprovement: 0.8, decisionConfidence: 0.9, currentSongValue: 0.7, upcomingPayoff: 0.2, userSelected: false, albumIntegrity: 0, currentFlow: 0.7, targetEnergy: 0.8, surpriseUsed: 0.1, candidates: [{ id: "blend", plannerScore: 0.7, directorScore: 0.8 }] },
    runtimeEvidence: emptyRuntimeEvidenceSummary(1),
};

const distribution = benchmarkSyncV1(() => compileValidationRuntimeV1(input), { warmup: 500, iterations: 5_000 });
const budget = performanceBudgetStatus({ distribution, p95BudgetMicros: 500, p99BudgetMicros: 1_000 });
const determinism = determinismAuditV1(() => compileValidationRuntimeV1(input));
console.log(JSON.stringify({ version: 1, compiler: "validation-runtime-v1", distribution, budget, deterministic: determinism.deterministic }, null, 2));
if (!budget.passed || !determinism.deterministic) process.exitCode = 1;

