import type { AffectState } from "./affect-intelligence";
import type { AffectJourney } from "./crowd-experience-v2";
import type { ExperienceId } from "./experience-engine";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export const CROWD_MOOD_RESEARCH_STATUS = {
    maturity: "exploratory",
    directConsumerPartyEvidence: "sparse",
    requiresOwnUserStudies: true,
    relatedFields: [
        "individual-recommendation",
        "group-recommendation",
        "music-emotion-recognition",
        "audience-synchrony",
    ],
} as const;

export const CROWD_STUDY_PROPOSAL = {
    groupSize: [3, 8] as const,
    conditions: [
        "no-crowd-adaptation",
        "explicit-reactions-only",
        "reactions-and-fairness",
        "reactions-fairness-and-mood-model",
    ] as const,
    measures: [
        "session-satisfaction",
        "perceived-fairness",
        "track-acceptance",
        "skip-votes",
        "requests",
        "discovery",
        "perceived-vibe-fit",
        "would-use-again",
    ] as const,
} as const;

export interface IndividualCrowdIntent {
    memberId: string;
    desired: AffectState;
    perceived?: AffectState;
    confidence: number;
}

export interface CrowdIntentCluster {
    id: string;
    center: AffectState;
    memberCount: number;
    weight: number;
}

export interface CrowdIntentDistribution {
    clusters: CrowdIntentCluster[];
    polarization: number;
    evidenceCount: number;
    source: "individual-desired-states";
}

function quadrant(state: AffectState): string {
    return `${state.valence >= 0 ? "positive" : "negative"}-${state.arousal >= 0.5 ? "high" : "low"}`;
}

export function aggregateCrowdIntent(intents: readonly IndividualCrowdIntent[]): CrowdIntentDistribution {
    const groups = new Map<string, IndividualCrowdIntent[]>();
    for (const intent of intents)
        groups.set(quadrant(intent.desired), [...(groups.get(quadrant(intent.desired)) ?? []), intent]);
    const totalWeight = intents.reduce((sum, intent) => sum + clamp01(intent.confidence), 0);
    const clusters = [...groups.entries()].map(([id, members]) => {
        const weight = members.reduce((sum, member) => sum + clamp01(member.confidence), 0);
        const weighted = (selector: (state: AffectState) => number) =>
            members.reduce((sum, member) => sum + selector(member.desired) * clamp01(member.confidence), 0) /
            Math.max(weight, 1);
        return {
            id,
            center: {
                valence: round(weighted((state) => state.valence)),
                arousal: round(clamp01(weighted((state) => state.arousal))),
                valenceConfidence: round(clamp01(weight / members.length)),
                arousalConfidence: round(clamp01(weight / members.length)),
            },
            memberCount: members.length,
            weight: round(weight / Math.max(totalWeight, 1)),
        };
    });
    let maximumDistance = 0;
    for (const left of clusters)
        for (const right of clusters) {
            const distance =
                (Math.abs(left.center.valence - right.center.valence) / 2 +
                    Math.abs(left.center.arousal - right.center.arousal)) /
                2;
            maximumDistance = Math.max(maximumDistance, distance * Math.min(1, (left.weight + right.weight) * 1.5));
        }
    return {
        clusters,
        polarization: round(clamp01(maximumDistance)),
        evidenceCount: intents.length,
        source: "individual-desired-states",
    };
}

export function choosePolarizationResponse(
    distribution: CrowdIntentDistribution,
    hostAvailable: boolean,
): "rotate-representation" | "find-bridge" | "ask-host" | "follow-session-phase" {
    if (distribution.polarization < 0.25) return "follow-session-phase";
    if (distribution.clusters.length >= 3) return "rotate-representation";
    if (hostAvailable && distribution.polarization >= 0.65) return "ask-host";
    return "find-bridge";
}

export function resolveDesiredVsPerceived(input: { perceived: AffectState; desired: AffectState }): {
    optimizationTarget: AffectState;
    perceived: AffectState;
    primary: "desired";
} {
    return { optimizationTarget: { ...input.desired }, perceived: { ...input.perceived }, primary: "desired" };
}

export type Stakeholder =
    | "listener-host"
    | "crowd-safety"
    | "session-satisfaction"
    | "personalization"
    | "discovery-creators"
    | "platform";

export const STAKEHOLDER_PRIORITY: readonly Stakeholder[] = [
    "listener-host",
    "crowd-safety",
    "session-satisfaction",
    "personalization",
    "discovery-creators",
    "platform",
] as const;

export function resolveStakeholderConflict(eligible: readonly Stakeholder[]): Stakeholder | null {
    return STAKEHOLDER_PRIORITY.find((stakeholder) => eligible.includes(stakeholder)) ?? null;
}

export const PRODUCT_OPTIMIZATION_OBJECTIVE = {
    primary: "user-selected-experience-quality",
    engagementRole: "diagnostic-only",
    hiddenSessionDurationMaximization: false,
} as const;

export type GroupMode = "solo" | "consensus" | "fair-share" | "host-led";

export interface SessionContract {
    experience: ExperienceId;
    familiarityTarget?: number;
    discoveryTarget?: number;
    groupMode?: GroupMode;
    hostPriority?: number;
    requestedJourney?: AffectJourney;
}

export function validateSessionContract(contract: SessionContract): {
    valid: boolean;
    normalized: SessionContract;
    violations: string[];
} {
    const violations: string[] = [];
    if (contract.familiarityTarget !== undefined && (contract.familiarityTarget < 0 || contract.familiarityTarget > 1))
        violations.push("familiarity-target-out-of-range");
    if (contract.discoveryTarget !== undefined && (contract.discoveryTarget < 0 || contract.discoveryTarget > 1))
        violations.push("discovery-target-out-of-range");
    if (contract.hostPriority !== undefined && (contract.hostPriority < 0 || contract.hostPriority > 1))
        violations.push("host-priority-out-of-range");
    if ((contract.familiarityTarget ?? 0) + (contract.discoveryTarget ?? 0) > 1.5)
        violations.push("conflicting-familiarity-discovery-targets");
    return {
        valid: violations.length === 0,
        normalized: {
            ...contract,
            ...(contract.familiarityTarget === undefined
                ? {}
                : { familiarityTarget: round(clamp01(contract.familiarityTarget)) }),
            ...(contract.discoveryTarget === undefined
                ? {}
                : { discoveryTarget: round(clamp01(contract.discoveryTarget)) }),
            ...(contract.hostPriority === undefined ? {} : { hostPriority: round(clamp01(contract.hostPriority)) }),
        },
        violations,
    };
}
