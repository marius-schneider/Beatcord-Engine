const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export type ContentOrigin = "human" | "hybrid" | "ai" | "unknown";
export interface ContentProvenance {
    origin: ContentOrigin;
    confidence: number;
    providerLabel?: string;
    trustedProviderData: boolean;
}
export interface ProvenanceVector {
    composition?: ContentOrigin;
    vocal?: ContentOrigin;
    instruments?: ContentOrigin;
    production?: ContentOrigin;
    confidence: number;
    trustedData: boolean;
}
export type ProvenancePreference = "allow" | "deprioritize" | "hide";
export function provenanceRecommendation(
    provenance: ContentProvenance,
    preference: ProvenancePreference,
): { allowed: boolean; scoreMultiplier: number; labelShown: boolean; uncertainClassifierClaim: false } {
    const reliable = provenance.trustedProviderData && provenance.confidence >= 0.8;
    if (!reliable || provenance.origin === "unknown")
        return { allowed: true, scoreMultiplier: 1, labelShown: false, uncertainClassifierClaim: false };
    if (provenance.origin === "ai" && preference === "hide")
        return { allowed: false, scoreMultiplier: 0, labelShown: true, uncertainClassifierClaim: false };
    return {
        allowed: true,
        scoreMultiplier: provenance.origin === "ai" && preference === "deprioritize" ? 0.65 : 1,
        labelShown: true,
        uncertainClassifierClaim: false,
    };
}
export function provenanceVector(
    data: Omit<ProvenanceVector, "confidence" | "trustedData">,
    providerConfidence: number,
    trusted: boolean,
): ProvenanceVector {
    return { ...data, confidence: trusted ? clamp01(providerConfidence) : 0, trustedData: trusted };
}

export type SessionTasteChoice = "learn-normally" | "party-profile" | "guest-mode" | "dont-learn";
export const PROACTIVE_TASTE_CHOICES: readonly SessionTasteChoice[] = [
    "learn-normally",
    "party-profile",
    "guest-mode",
    "dont-learn",
];
export function proactiveTastePolicy(choice: SessionTasteChoice): {
    bucket: "personal" | "party" | "guest";
    persistent: boolean;
    promptAtSessionStart: true;
} {
    return {
        bucket: choice === "party-profile" ? "party" : choice === "guest-mode" ? "guest" : "personal",
        persistent: choice === "learn-normally" || choice === "party-profile",
        promptAtSessionStart: true,
    };
}

export type PlaybackExperience = "pure" | "chill" | "love" | "energy" | "party";
export function signalPath(
    experience: PlaybackExperience,
    losslessInput: boolean,
): { stages: string[]; preservesLosslessBenefit: boolean; adaptiveIntelligenceIsDifferentiator: true } {
    const minimal = ["decode", "gain", "optional-gentle-transition", "output"];
    const party = ["decode", "tempo", "stems", "eq", "fx", "mix", "limiter", "output"];
    const stages = experience === "party" || experience === "energy" ? party : minimal;
    return {
        stages,
        preservesLosslessBenefit: !losslessInput || stages === minimal,
        adaptiveIntelligenceIsDifferentiator: true,
    };
}

export interface BroadcastCapability {
    auracast: boolean;
    measuredReceiverLatency: boolean;
    multiroomRendering: boolean;
}
export function wirelessAudioPolicy(capability: BroadcastCapability): {
    use: "disabled" | "broadcast" | "synchronized-multiroom";
    exactReceiverLatencyClaim: boolean;
    applications: string[];
} {
    if (capability.multiroomRendering && capability.measuredReceiverLatency)
        return {
            use: "synchronized-multiroom",
            exactReceiverLatencyClaim: true,
            applications: ["shared-listening", "multi-headphone"],
        };
    if (capability.auracast)
        return {
            use: "broadcast",
            exactReceiverLatencyClaim: false,
            applications: ["silent-party", "shared-listening", "accessibility", "multi-headphone"],
        };
    return { use: "disabled", exactReceiverLatencyClaim: false, applications: [] };
}

export type PlaybackEnvironment = "headphones" | "car" | "speaker" | "xr" | "public-broadcast";
export interface SpatialSource {
    genuineMultichannel: boolean;
    foregroundPosition: number;
    ambienceWidth: number;
}
export function spatialTransition(
    outgoing: SpatialSource,
    incoming: SpatialSource,
    environment: PlaybackEnvironment,
): {
    enabled: boolean;
    foregroundHandoff: number;
    ambienceWidth: number;
    artificialExtremePanning: false;
    personalContextPersisted: false;
} {
    const enabled =
        outgoing.genuineMultichannel &&
        incoming.genuineMultichannel &&
        (environment === "headphones" || environment === "xr");
    return {
        enabled,
        foregroundHandoff: enabled ? (outgoing.foregroundPosition + incoming.foregroundPosition) / 2 : 0,
        ambienceWidth: enabled ? Math.min(1, incoming.ambienceWidth) : 0,
        artificialExtremePanning: false,
        personalContextPersisted: false,
    };
}

export type PlaybackMode = "adaptive-playback" | "creative-remix";
export function creativeBoundary(mode: PlaybackMode): {
    preserveArtistRecording: boolean;
    transformationAllowed: boolean;
    explicitUserOptIn: boolean;
} {
    return mode === "adaptive-playback"
        ? { preserveArtistRecording: true, transformationAllowed: false, explicitUserOptIn: false }
        : { preserveArtistRecording: false, transformationAllowed: true, explicitUserOptIn: true };
}

export interface EvaluationScores {
    objective: number;
    specialist: number;
    llmJudge: number;
    humanPanel: number;
    realBehavior: number;
}
export function evaluationEnsemble(scores: EvaluationScores): {
    score: number;
    llmGroundTruth: false;
    components: EvaluationScores;
} {
    const score =
        scores.objective * 0.25 +
        scores.specialist * 0.25 +
        scores.llmJudge * 0.1 +
        scores.humanPanel * 0.25 +
        scores.realBehavior * 0.15;
    return { score: clamp01(score), llmGroundTruth: false, components: { ...scores } };
}
export const AUDIO_UNDERSTANDING_CI = {
    suites: ["structure-questions", "mixability-questions", "moment-questions", "semantic-questions"],
    toleranceBasedAnswers: true,
    runsOnEveryModelUpdate: true,
} as const;
export interface MusicRegressionAnswer {
    id: string;
    actual: number | boolean | string;
    expected: number | boolean | string;
    tolerance?: number;
}
export function musicModelRegression(answers: readonly MusicRegressionAnswer[]): {
    passed: boolean;
    failures: string[];
} {
    const failures = answers
        .filter((answer) =>
            typeof answer.actual === "number" && typeof answer.expected === "number"
                ? Math.abs(answer.actual - answer.expected) > (answer.tolerance ?? 0)
                : answer.actual !== answer.expected,
        )
        .map((answer) => answer.id);
    return { passed: failures.length === 0, failures };
}
export const PROVENANCE_RESEARCH = {
    fullyAiUploadsPerDay: 90_000,
    peakNewUploadShareAbove: 0.5,
    hybridWorkflowExpected: true,
    providerLabelsPreferred: true,
    ownDetectionAsTruthForbidden: true,
} as const;
