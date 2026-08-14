import { type AffectState, normalizeAffect } from "./affect-intelligence";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export type AffectJourneyStrategy = "maintain" | "gradual-shift" | "contrast" | "free";

export interface AffectJourney {
    start: AffectState;
    target: AffectState;
    durationMinutes?: number;
    strategy: AffectJourneyStrategy;
}

export function planAffectJourney(journey: AffectJourney, steps = 6): AffectState[] {
    const start = normalizeAffect(journey.start);
    const target = journey.strategy === "maintain" ? start : normalizeAffect(journey.target);
    if (journey.strategy === "free") return [start, target];
    return Array.from({ length: Math.max(1, steps) }, (_, index) => {
        const linear = (index + 1) / Math.max(1, steps);
        const progress = journey.strategy === "contrast" ? Math.min(1, linear * 1.8) : linear;
        return normalizeAffect({
            valence: start.valence + (target.valence - start.valence) * progress,
            arousal: start.arousal + (target.arousal - start.arousal) * progress,
            valenceConfidence: Math.min(start.valenceConfidence, target.valenceConfidence),
            arousalConfidence: Math.min(start.arousalConfidence, target.arousalConfidence),
        });
    });
}

export interface CrowdMoodEvidence {
    explicit: number;
    behavioral: number;
    physiological?: number;
}

export interface CrowdMoodInference {
    estimate: AffectState;
    uncertainty: number;
    evidence: CrowdMoodEvidence;
    latent: true;
}

export function inferLatentCrowdMood(input: {
    explicit?: AffectState;
    behavioral?: AffectState;
    physiological?: AffectState;
    evidence: CrowdMoodEvidence;
}): CrowdMoodInference {
    const sources = [
        input.explicit && { state: input.explicit, weight: clamp01(input.evidence.explicit) * 0.55 },
        input.behavioral && { state: input.behavioral, weight: clamp01(input.evidence.behavioral) * 0.4 },
        input.physiological && {
            state: input.physiological,
            weight: clamp01(input.evidence.physiological ?? 0) * 0.05,
        },
    ].filter((source): source is { state: AffectState; weight: number } => Boolean(source));
    const weight = sources.reduce((sum, source) => sum + source.weight, 0);
    const estimate = normalizeAffect({
        valence: sources.reduce((sum, source) => sum + source.state.valence * source.weight, 0) / Math.max(weight, 1),
        arousal: sources.reduce((sum, source) => sum + source.state.arousal * source.weight, 0) / Math.max(weight, 1),
        valenceConfidence: weight,
        arousalConfidence: weight,
    });
    return { estimate, uncertainty: round(clamp01(1 - weight)), evidence: { ...input.evidence }, latent: true };
}

export interface CrowdReactionSample {
    memberId: string;
    atMs: number;
    direction: number;
    engagement: number;
    saved?: boolean;
}

export interface CrowdCohesion {
    consensus: number;
    sharedEngagement: number;
    reactionSynchrony: number;
    confidence: number;
}

export function assessCrowdCohesion(samples: readonly CrowdReactionSample[]): CrowdCohesion {
    if (!samples.length) return { consensus: 0.5, sharedEngagement: 0, reactionSynchrony: 0, confidence: 0 };
    const meanDirection = samples.reduce((sum, sample) => sum + sample.direction, 0) / samples.length;
    const disagreement =
        samples.reduce((sum, sample) => sum + Math.abs(sample.direction - meanDirection), 0) / samples.length;
    const timeRange =
        Math.max(...samples.map((sample) => sample.atMs)) - Math.min(...samples.map((sample) => sample.atMs));
    return {
        consensus: round(clamp01(1 - disagreement / 2)),
        sharedEngagement: round(clamp01(samples.reduce((sum, sample) => sum + sample.engagement, 0) / samples.length)),
        reactionSynchrony: round(clamp01(1 - timeRange / 30_000)),
        confidence: round(clamp01(new Set(samples.map((sample) => sample.memberId)).size / 6)),
    };
}

export const PHYSIOLOGICAL_SIGNAL_POLICY = {
    required: false,
    defaultEnabled: false,
    consent: "explicit-opt-in",
    priority: "below-explicit-and-interaction",
} as const;

export interface CrowdExperienceSignals {
    mood: AffectState;
    engagement: number;
    sentiment: number;
    satisfaction: number;
}

export function separateCrowdExperienceSignals(input: {
    mood: AffectState;
    activity: number;
    positiveReactions: number;
    negativeReactions: number;
    acceptance: number;
}): CrowdExperienceSignals {
    const totalReactions = Math.max(1, input.positiveReactions + input.negativeReactions);
    return {
        mood: normalizeAffect(input.mood),
        engagement: round(clamp01(input.activity)),
        sentiment: round(
            Math.max(-1, Math.min(1, (input.positiveReactions - input.negativeReactions) / totalReactions)),
        ),
        satisfaction: round(clamp01(input.acceptance)),
    };
}

export type DynamicGroupAggregationStrategy =
    | "average"
    | "least-misery"
    | "most-pleasure"
    | "approval"
    | "fair-share"
    | "weighted-consensus";

export interface MemberUtility {
    memberId: string;
    utility: number;
    weight?: number;
    fairnessDebt?: number;
    approved?: boolean;
}

export function aggregateGroupUtility(
    members: readonly MemberUtility[],
    strategy: DynamicGroupAggregationStrategy,
): number {
    if (!members.length) return 0;
    const utilities = members.map((member) => clamp01(member.utility));
    if (strategy === "least-misery") return round(Math.min(...utilities));
    if (strategy === "most-pleasure") return round(Math.max(...utilities));
    if (strategy === "approval") return round(members.filter((member) => member.approved).length / members.length);
    if (strategy === "fair-share")
        return round(
            members.reduce(
                (sum, member) => sum + clamp01(member.utility) * (1 + clamp01(member.fairnessDebt ?? 0)),
                0,
            ) / members.reduce((sum, member) => sum + 1 + clamp01(member.fairnessDebt ?? 0), 0),
        );
    if (strategy === "weighted-consensus")
        return round(
            members.reduce((sum, member) => sum + clamp01(member.utility) * Math.max(0, member.weight ?? 1), 0) /
                Math.max(
                    1,
                    members.reduce((sum, member) => sum + Math.max(0, member.weight ?? 1), 0),
                ),
        );
    return round(utilities.reduce((sum, utility) => sum + utility, 0) / utilities.length);
}

export interface GroupAggregationPolicy {
    averageWeight: number;
    leastMiseryWeight: number;
    fairnessDebtWeight: number;
    requestWeight: number;
    hostWeight: number;
    mostPleasureWeight: number;
    polarizationPenalty: number;
}

export function selectFairnessPolicy(context: "dinner" | "party-peak" | "default"): GroupAggregationPolicy {
    if (context === "dinner")
        return {
            averageWeight: 0.25,
            leastMiseryWeight: 0.35,
            fairnessDebtWeight: 0.15,
            requestWeight: 0.05,
            hostWeight: 0.1,
            mostPleasureWeight: 0.1,
            polarizationPenalty: 0.3,
        };
    if (context === "party-peak")
        return {
            averageWeight: 0.2,
            leastMiseryWeight: 0.1,
            fairnessDebtWeight: 0.1,
            requestWeight: 0.2,
            hostWeight: 0.1,
            mostPleasureWeight: 0.3,
            polarizationPenalty: 0.1,
        };
    return {
        averageWeight: 0.3,
        leastMiseryWeight: 0.2,
        fairnessDebtWeight: 0.2,
        requestWeight: 0.1,
        hostWeight: 0.1,
        mostPleasureWeight: 0.1,
        polarizationPenalty: 0.2,
    };
}

export type FairnessReason =
    | "shared-preference"
    | "least-misery"
    | "fairness-debt"
    | "request"
    | "host-intent"
    | "bridge";

export function explainFairness(reasons: readonly FairnessReason[], details: { genres?: readonly string[] }): string {
    if (reasons.includes("bridge") && (details.genres?.length ?? 0) >= 2)
        return `Bridges ${details.genres!.slice(0, 2).join(" and ")} for the current group.`;
    if (reasons.includes("fairness-debt")) return "Represents members who have recently received fewer fitting tracks.";
    if (reasons.includes("least-misery")) return "Avoids a track that strongly conflicts with a group member.";
    if (reasons.includes("request")) return "Follows an active group request.";
    if (reasons.includes("host-intent")) return "Follows the host's explicit session intent.";
    return "Matches the group's measured shared preferences.";
}

export interface FairnessEvaluation {
    computational: number;
    perceived?: number;
    gap?: number;
    strategyUniversal: false;
}

export function evaluateGroupFairness(
    representationBalance: number,
    perceivedReports: readonly number[],
): FairnessEvaluation {
    const perceived = perceivedReports.length
        ? perceivedReports.reduce((sum, report) => sum + clamp01(report), 0) / perceivedReports.length
        : undefined;
    return {
        computational: round(clamp01(representationBalance)),
        ...(perceived === undefined
            ? {}
            : { perceived: round(perceived), gap: round(Math.abs(representationBalance - perceived)) }),
        strategyUniversal: false,
    };
}
