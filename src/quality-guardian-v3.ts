export type ReleaseTier = "core" | "smart" | "director";
export interface ReleaseEvidence {
    crashFree: boolean;
    fallbackVerified: boolean;
    technicalPassRate: number;
    perceptualPassRate: number;
    musicalPassRate: number;
    journeyPassRate: number;
    conversationSafetyPassRate: number;
}

export function releaseGate(tier: ReleaseTier, evidence: ReleaseEvidence): { approved: boolean; failed: string[] } {
    const checks: Array<[string, boolean]> = [
        ["crash-free", evidence.crashFree],
        ["fallback-verified", evidence.fallbackVerified],
        ["technical", evidence.technicalPassRate >= 0.99],
    ];
    if (tier !== "core")
        checks.push(["perceptual", evidence.perceptualPassRate >= 0.95], ["musical", evidence.musicalPassRate >= 0.93]);
    if (tier === "director")
        checks.push(
            ["journey", evidence.journeyPassRate >= 0.9],
            ["conversation-safety", evidence.conversationSafetyPassRate >= 0.99],
        );
    const failed = checks.filter(([, pass]) => !pass).map(([name]) => name);
    return { approved: failed.length === 0, failed };
}

export interface PerceptualMixFeatures {
    masking: number;
    foregroundClarity: number;
    transientPreservation: number;
    loudnessContinuity: number;
    artifactSalience: number;
}
export interface QualityGuardianV3Input {
    referencesAvailable: boolean;
    abComparisonAvailable: boolean;
    renderVerified: boolean;
    stemConfidence: number;
    stretchRisk: number;
    peakDbfs: number;
    truePeakDbtp: number;
    phaseCorrelation: number;
    dropoutRate: number;
    perceptual: PerceptualMixFeatures;
    beatAlignment: number;
    phraseAlignment: number;
    harmonicCompatibility: number;
    structuralContinuity: number;
    tensionFit: number;
    journeyFit: number;
    mixingFit: number;
    tasteFit: number;
}
export interface QualityGuardianV3Result {
    technical: number;
    perceptual: number;
    musical: number;
    experience: number;
    confidence: number;
    verdict: "approve" | "repair" | "fallback";
    repairs: string[];
}
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const average = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

export function evaluateQualityGuardianV3(input: QualityGuardianV3Input): QualityGuardianV3Result {
    const clipping = input.peakDbfs > 0 || input.truePeakDbtp > -0.1;
    const technical = clamp01(
        average([
            clipping ? 0 : 1,
            clamp01((input.phaseCorrelation + 1) / 2),
            clamp01(1 - input.dropoutRate * 20),
            input.renderVerified ? 1 : 0,
        ]),
    );
    const perceptual = clamp01(
        average([
            1 - input.perceptual.masking,
            input.perceptual.foregroundClarity,
            input.perceptual.transientPreservation,
            input.perceptual.loudnessContinuity,
            1 - input.perceptual.artifactSalience,
        ]),
    );
    const musical = clamp01(
        average([
            input.beatAlignment,
            input.phraseAlignment,
            input.harmonicCompatibility,
            input.structuralContinuity,
            input.tensionFit,
        ]),
    );
    const experience = clamp01(average([input.journeyFit, input.mixingFit, input.tasteFit]));
    const confidence = clamp01(
        average([
            input.referencesAvailable ? 1 : 0.45,
            input.abComparisonAvailable ? 1 : 0.55,
            input.stemConfidence,
            1 - input.stretchRisk,
        ]),
    );
    const repairs: string[] = [];
    if (clipping) repairs.push("lower-summed-gain");
    if (input.phaseCorrelation < 0) repairs.push("protect-mono-compatibility");
    if (input.perceptual.masking > 0.45) repairs.push("replan-role-overlap");
    if (input.perceptual.transientPreservation < 0.6) repairs.push("reduce-stretch-or-crossfade");
    if (musical < 0.65) repairs.push("replan-musical-structure");
    const minimum = Math.min(technical, perceptual, musical, experience);
    const verdict = technical < 0.55 || input.dropoutRate > 0.02 ? "fallback" : minimum < 0.75 ? "repair" : "approve";
    return { technical, perceptual, musical, experience, confidence, verdict, repairs };
}

export interface AuditoryRole {
    id: string;
    role: "lead" | "vocal" | "bass" | "rhythm" | "texture";
    foreground: number;
    band: "low" | "mid" | "high";
}
export function auditorySceneSeparability(roles: readonly AuditoryRole[]): { score: number; collisions: string[][] } {
    const collisions: string[][] = [];
    for (let first = 0; first < roles.length; first += 1) {
        for (let second = first + 1; second < roles.length; second += 1) {
            const a = roles[first];
            const b = roles[second];
            if (a && b && a.band === b.band && a.foreground > 0.55 && b.foreground > 0.55)
                collisions.push([a.id, b.id]);
        }
    }
    return { score: clamp01(1 - collisions.length / Math.max(1, roles.length)), collisions };
}

export interface HearingProfile {
    highFrequencySensitivity: number;
    maskingSusceptibility: number;
    loudnessSensitivity: number;
}
export function hearingDiversityMetrics(profiles: readonly HearingProfile[]): {
    worstCaseClarity: number;
    loudnessSpread: number;
    universalAssumption: false;
} {
    const clarity = profiles.map((profile) => clamp01(1 - profile.maskingSusceptibility));
    const loudness = profiles.map((profile) => profile.loudnessSensitivity);
    return {
        worstCaseClarity: clarity.length ? Math.min(...clarity) : 1,
        loudnessSpread: loudness.length ? Math.max(...loudness) - Math.min(...loudness) : 0,
        universalAssumption: false,
    };
}

export type ListeningEnvironment = "headphones" | "phone" | "laptop" | "speaker" | "club" | "car";
export const VALIDATION_ENVIRONMENTS: readonly ListeningEnvironment[] = [
    "headphones",
    "speaker",
    "phone",
    "car",
    "club",
];
export function environmentAdaptation(environment: ListeningEnvironment): {
    eqDb: number;
    bassMonoBelowHz: number;
    aggressiveAutoEq: false;
} {
    const eqDb = environment === "phone" ? 1.5 : environment === "car" ? -1 : environment === "club" ? -1.5 : 0;
    return { eqDb, bassMonoBelowHz: environment === "club" ? 140 : 110, aggressiveAutoEq: false };
}

export function monoFoldDownSafety(input: { stereoCorrelation: number; lowBandSideRatio: number }): {
    safe: boolean;
    actions: string[];
} {
    const actions: string[] = [];
    if (input.stereoCorrelation < 0) actions.push("reduce-antiphase-content");
    if (input.lowBandSideRatio > 0.25) actions.push("mono-low-end");
    return { safe: actions.length === 0, actions };
}
export function truePeakSafety(truePeakDbtp: number, ceilingDbtp = -1): { safe: boolean; gainReductionDb: number } {
    return { safe: truePeakDbtp <= ceilingDbtp, gainReductionDb: Math.max(0, truePeakDbtp - ceilingDbtp) };
}

export interface LoudnessJourneyPoint {
    position: number;
    shortTermLufs: number;
    truePeakDbtp: number;
    spectralTiltDb: number;
}
export function loudnessJourney(
    points: readonly LoudnessJourneyPoint[],
    maxRiseLufs = 3,
): { controlled: boolean; owner: "incoming" | "outgoing" | "summed"; maxRise: number } {
    const sorted = [...points].sort((a, b) => a.position - b.position);
    const loudness = sorted.map((point) => point.shortTermLufs);
    const maxRise = loudness.length ? Math.max(...loudness) - Math.min(...loudness) : 0;
    const peakIndex = sorted.reduce(
        (best, point, index) => (point.truePeakDbtp > (sorted[best]?.truePeakDbtp ?? -Infinity) ? index : best),
        0,
    );
    const owner =
        sorted.length === 0
            ? "summed"
            : sorted[peakIndex]?.position === 0
              ? "outgoing"
              : sorted[peakIndex]?.position === 1
                ? "incoming"
                : "summed";
    return {
        controlled: maxRise <= maxRiseLufs && sorted.every((point) => point.truePeakDbtp <= -0.1),
        owner,
        maxRise,
    };
}

export type FadeCurve = "linear" | "equal-power" | "custom";
export function fadeGains(
    progress: number,
    curve: FadeCurve,
    customExponent = 1.5,
): { outgoing: number; incoming: number } {
    const p = clamp01(progress);
    if (curve === "equal-power")
        return { outgoing: Math.cos((p * Math.PI) / 2), incoming: Math.sin((p * Math.PI) / 2) };
    if (curve === "custom") return { outgoing: (1 - p) ** customExponent, incoming: p ** customExponent };
    return { outgoing: 1 - p, incoming: p };
}

export function protectIntentionalSilence(input: {
    silenceProbability: number;
    structuralBoundary: boolean;
    userRequestedGap: boolean;
}): { protected: boolean; mayFill: boolean } {
    const protectedSilence = input.userRequestedGap || (input.structuralBoundary && input.silenceProbability >= 0.7);
    return { protected: protectedSilence, mayFill: !protectedSilence };
}

export interface InspectableIntent {
    moods: string[];
    familiarity: number;
    warmth: number;
    mixStyle: "smooth" | "club" | "neutral";
    energyRoute: "steady" | "gradual-rise" | "escalate";
    targetGenre?: string;
    deadlineMinutes?: number;
    correctable: true;
}
export function exampleIntent(text: string): InspectableIntent {
    const normalized = text.toLowerCase();
    if (normalized.includes("rooftop") || normalized.includes("sunset"))
        return {
            moods: ["chill", "love"],
            familiarity: 0.55,
            warmth: 0.8,
            mixStyle: "smooth",
            energyRoute: "gradual-rise",
            correctable: true,
        };
    const deadline = normalized.match(/(?:in|within)\s+(\d+)\s*(?:min|minute)/)?.[1];
    if (normalized.includes("dnb") || normalized.includes("drum and bass"))
        return {
            moods: ["focused"],
            familiarity: 0.45,
            warmth: 0.4,
            mixStyle: "club",
            energyRoute: "gradual-rise",
            targetGenre: "drum-and-bass",
            deadlineMinutes: deadline ? Number(deadline) : 30,
            correctable: true,
        };
    return {
        moods: ["party", "energy"],
        familiarity: 0.9,
        warmth: 0.5,
        mixStyle: "club",
        energyRoute: "escalate",
        correctable: true,
    };
}

export function ambiguityPolicy(confidence: number): {
    apply: "normal" | "low-risk";
    askOptionalQuestion: boolean;
    playbackContinues: true;
} {
    return {
        apply: confidence >= 0.7 ? "normal" : "low-risk",
        askOptionalQuestion: confidence < 0.7,
        playbackContinues: true,
    };
}

export interface CrowdIntent {
    participantId: string;
    energy: number;
    familiarity: number;
    genres: readonly string[];
    exclusions: readonly string[];
    host: boolean;
}
export function aggregateCrowdIntents(intents: readonly CrowdIntent[]): {
    energy: number;
    familiarity: number;
    genres: string[];
    conflicts: string[];
    fairAggregation: true;
} {
    if (intents.length === 0)
        return { energy: 0.5, familiarity: 0.5, genres: [], conflicts: [], fairAggregation: true };
    const weights = intents.map((intent) => (intent.host ? 1.5 : 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const genres = [...new Set(intents.flatMap((intent) => intent.genres.map((genre) => genre.toLowerCase())))];
    const exclusions = new Set(intents.flatMap((intent) => intent.exclusions.map((genre) => genre.toLowerCase())));
    const conflicts = genres.filter((genre) => exclusions.has(genre));
    return {
        energy: intents.reduce((sum, intent, index) => sum + clamp01(intent.energy) * (weights[index] ?? 1), 0) / total,
        familiarity:
            intents.reduce((sum, intent, index) => sum + clamp01(intent.familiarity) * (weights[index] ?? 1), 0) /
            total,
        genres: genres.filter((genre) => !exclusions.has(genre)),
        conflicts,
        fairAggregation: true,
    };
}

export function groundedExplanation(actualReasons: readonly string[], proposedReasons: readonly string[]): string[] {
    const actual = new Set(actualReasons);
    return proposedReasons.filter((reason) => actual.has(reason));
}

export interface CriticDatasetItem {
    originalA: string;
    originalB: string;
    transitionPlan: string;
    renderedTransition: string;
    labels: { technical: number; perceptual: number; musical: number; experience: number; naturalness: number };
}
export function pairwiseCriticExample(
    preferred: CriticDatasetItem,
    rejected: CriticDatasetItem,
): { chosen: string; rejected: string; multidimensional: true } {
    return { chosen: preferred.renderedTransition, rejected: rejected.renderedTransition, multidimensional: true };
}

export const QUALITY_GUARDIAN_V3_BOUNDARY = {
    llmRole: "intent-and-explanation-only",
    deterministicAudioPlanning: true,
    conversationMemoryDefault: "session",
    outputs: ["approve", "repair", "fallback"],
} as const;
