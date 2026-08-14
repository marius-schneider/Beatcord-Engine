import {
    BEAT_MESH_EXPERIMENTS_V1,
    BEAT_MESH_TORTURE_BUCKETS_V1,
    beatMeshActiveTeachingValue,
    beatMeshPromotionRule,
    compareBeatMeshEnsemble,
    localRefinementValue,
    selectAnnotationWindows,
} from "./beat-mesh-torture-lab-v1";
import {
    activeEvaluationPairs,
    decideIntervention,
    explanationImportance,
    FIVE_LAB_ARCHITECTURE_V1,
    HUMAN_EVALUATION_PROGRAM_V1,
    interventionThreshold,
    interventionUtility,
    musicalSwitchingCost,
    sessionRegret,
    temporalOpportunityDecision,
    updateInterventionTrust,
} from "./human-intervention-lab-v1";
import {
    autonomyPolicyForCohort,
    discoveryHalfLife,
    LONGITUDINAL_TASTE_LAB_V1,
    longitudinalLabSuccess,
    longitudinalSelfInfluence,
    meaningfulDiscoveryScore,
    tasteEvolutionAssessment,
} from "./longitudinal-taste-lab-v1";
import type { RuntimeEvidenceSummaryV1 } from "./runtime-evidence-ledger-v1";
import {
    originalPreservingStrategy,
    restorationDecision,
    STEM_UTILITY_BENCHMARK_V1,
    selectStemPortfolioRoute,
    stemDemandPlan,
    stemExposureRisk,
    transitionStemUtility,
} from "./stem-transition-utility-v1";

export interface ValidationRuntimeCompilerInputV1 {
    currentTrackId: string;
    nextTrackId: string;
    transitionType: string;
    fadeSec: number;
    stemsReady: boolean;
    beat: {
        compatibility: number;
        bpmConfidence: number;
        rhythmicMismatch: number;
        phraseCompatibility: number;
    };
    stem: {
        quality: number;
        artifactSalience: number;
        stretchArtifacts: number;
        spectralCollision: number;
        vocalCollision: number;
        spatialQuality: number;
        spatialCollisionRisk: number;
        maskingRisk: number;
        postRendererRisk: number;
        manipulationCost: number;
        totalQualityRisk: number;
    };
    taste: {
        profileDrift: number;
        userConfirmedChange: number;
        profileIdentification: number;
    };
    intervention: {
        experience: "party" | "other";
        experienceImprovement: number;
        decisionConfidence: number;
        currentSongValue: number;
        upcomingPayoff: number;
        userSelected: boolean;
        albumIntegrity: number;
        currentFlow: number;
        targetEnergy: number;
        surpriseUsed: number;
        candidates: readonly { id: string; plannerScore: number; directorScore: number }[];
    };
    runtimeEvidence: RuntimeEvidenceSummaryV1;
}

export function compileValidationRuntimeV1(input: ValidationRuntimeCompilerInputV1) {
    const simpleBeatResult = {
        domain: "straight-edm-control" as const,
        accuracy: input.beat.compatibility,
        calibration: input.beat.bpmConfidence,
        computeCost: 0.2,
        transitionFailures: input.beat.rhythmicMismatch > 0.5 ? 1 : 0,
        latencyRegression: 0,
        batteryRegression: 0,
        falseCorrectionRate: 0,
    };
    const meshBeatResult = {
        ...simpleBeatResult,
        calibration: Math.max(input.beat.bpmConfidence, input.beat.compatibility),
        computeCost: 0.4,
        transitionFailures: input.beat.rhythmicMismatch > 0.8 ? 1 : 0,
    };
    const beatMeshTortureLabV1 = {
        buckets: BEAT_MESH_TORTURE_BUCKETS_V1,
        annotationWindows: selectAnnotationWindows(
            [
                {
                    id: `${input.currentTrackId}:transition-window`,
                    disagreement: 1 - input.beat.compatibility,
                    downstreamImpact: 1 - input.beat.rhythmicMismatch,
                    futureReuse: 0.8,
                },
            ],
            1,
        ),
        ensemble: compareBeatMeshEnsemble({ single: simpleBeatResult, ensemble: meshBeatResult }),
        refinement: localRefinementValue({
            fullTrackQuality: input.beat.compatibility,
            localWindowQuality: input.beat.compatibility,
            fullTrackCompute: 1,
            localWindowCompute: 0.35,
        }),
        teachingValue: beatMeshActiveTeachingValue({
            correctionSeconds: 5,
            beatImprovement: input.beat.compatibility,
            phraseImprovement: input.beat.phraseCompatibility,
            transitionImprovement: 1 - input.beat.rhythmicMismatch,
            futureReuse: 0.8,
        }),
        promotion: beatMeshPromotionRule([meshBeatResult]),
        experiments: BEAT_MESH_EXPERIMENTS_V1,
    };

    const exposed = input.transitionType === "acapella";
    const exposure = {
        relativeGainDb: exposed ? 0 : -18,
        soloFraction: exposed ? 0.8 : 0,
        durationSeconds: input.fadeSec,
        foregroundProbability: input.stem.vocalCollision,
        maskingLevel: 1 - input.stem.spectralCollision,
    };
    const stemUtility = transitionStemUtility({
        profile: {
            isolation: input.stem.quality,
            artifactSalience: input.stem.artifactSalience,
            transientIntegrity: 1 - input.stem.stretchArtifacts,
            tonalIntegrity: 1 - input.stem.spectralCollision,
            spatialIntegrity: input.stem.spatialQuality,
            transitionUtilityByRole: { "vocal-overlay": 1 - input.stem.vocalCollision },
        },
        role: "vocal-overlay",
        exposure,
        maskingBenefit: 1 - input.stem.maskingRisk,
        spatialDamage: input.stem.spatialCollisionRisk,
        reconstructionRisk: input.stem.artifactSalience,
    });
    const exposureClass = exposed ? "exposed" : "masked";
    const stemTransitionUtilityV1 = {
        exposureRisk: stemExposureRisk(exposure),
        utility: stemUtility,
        portfolio: selectStemPortfolioRoute(
            [
                {
                    model: "current-separator",
                    role: "vocal-overlay" as const,
                    section: "transition",
                    exposureClass,
                    utility: stemUtility,
                },
            ],
            { role: "vocal-overlay", section: "transition", exposureClass },
        ),
        originalPreservation: originalPreservingStrategy({
            task: "vocal-attenuation",
            reconstructionUtility: stemUtility,
            subtractionUtility: 1 - input.stem.postRendererRisk,
            classicEqUtility: 1 - input.stem.totalQualityRisk,
        }),
        restoration: restorationDecision({
            transitionGain: stemUtility,
            artisticChange: input.stem.manipulationCost,
            exposedInTransition: exposed,
        }),
        demand: stemDemandPlan({
            requiredRoles: exposed ? ["vocal-overlay"] : ["bass-handoff"],
            cachedRoles: input.stemsReady ? ["vocal-overlay", "bass-handoff"] : [],
            deadlineMs: Math.max(0, input.fadeSec * 1_000),
            estimatedRoleMs: 500,
        }),
        benchmark: STEM_UTILITY_BENCHMARK_V1,
    };

    const longitudinalTasteLabV1 = {
        selfInfluence: longitudinalSelfInfluence(input.runtimeEvidence.tasteEvidence),
        discoveryScore: meaningfulDiscoveryScore(input.runtimeEvidence.discoverySignals),
        discoveryHalfLife: discoveryHalfLife(input.runtimeEvidence.discoverySignals),
        evolution: tasteEvolutionAssessment(input.taste),
        autonomy: autonomyPolicyForCohort("hybrid-listener"),
        success: longitudinalLabSuccess({
            satisfactionGain: 0,
            discoveryGain: 0,
            profileAccuracyGain: 0,
            agencyChange: 0,
        }),
        program: LONGITUDINAL_TASTE_LAB_V1,
    };

    const interventionAssessment = {
        expectedExperienceImprovement: input.intervention.experienceImprovement,
        decisionConfidence: input.intervention.decisionConfidence,
        disruptionCost: input.stem.manipulationCost * 0.2,
        artisticCost: input.stem.postRendererRisk * 0.2,
        userControlCost: 0,
    };
    const mode = input.intervention.experience === "party" ? ("director-first" as const) : ("hybrid" as const);
    const level = input.transitionType === "fade" ? (1 as const) : (2 as const);
    const trust = input.runtimeEvidence.intervention.trust;
    const humanInterventionLabV1 = {
        utility: interventionUtility(interventionAssessment),
        switchingCost: musicalSwitchingCost({
            currentSongValue: input.intervention.currentSongValue,
            upcomingPayoff: input.intervention.upcomingPayoff,
            userSelected: input.intervention.userSelected,
            albumIntegrity: input.intervention.albumIntegrity,
            artistPreservation: 1,
            currentFlow: input.intervention.currentFlow,
            cognitiveDisruption: input.stem.manipulationCost,
            queueSurprise: input.intervention.surpriseUsed,
        }),
        threshold: interventionThreshold({ mode, level, trust }),
        decision: decideIntervention({
            assessment: interventionAssessment,
            mode,
            level,
            trust,
            persistenceMs: 5_000,
            minimumPersistenceMs: 2_000,
        }),
        temporalDecision: temporalOpportunityDecision({
            immediateBenefit: input.intervention.experienceImprovement,
            immediateSwitchingCost: input.stem.manipulationCost,
            futureBenefit: input.intervention.targetEnergy,
            waitSeconds: input.fadeSec,
        }),
        trust: updateInterventionTrust({
            currentTrust: trust,
            accepted: input.runtimeEvidence.intervention.accepted,
            undone: input.runtimeEvidence.intervention.undone,
            evidenceWindow: input.runtimeEvidence.intervention.evidenceWindow,
        }),
        explanation: explanationImportance(input.transitionType === "fade" ? "normal-choice" : "genre-jump"),
        regret: sessionRegret({ skip: 0, queue: 0, transition: 0, discovery: 0, intervention: 0, preservation: 0 }),
        activeEvaluation: activeEvaluationPairs(
            input.intervention.candidates.map((candidate) => ({
                id: candidate.id,
                modelScores: [candidate.plannerScore, candidate.directorScore],
            })),
            3,
        ),
        program: HUMAN_EVALUATION_PROGRAM_V1,
        architecture: FIVE_LAB_ARCHITECTURE_V1,
    };

    return { beatMeshTortureLabV1, stemTransitionUtilityV1, longitudinalTasteLabV1, humanInterventionLabV1 };
}

export type ValidationRuntimeV1 = ReturnType<typeof compileValidationRuntimeV1>;
