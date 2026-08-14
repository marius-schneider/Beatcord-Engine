import type { ConcreteExperienceId } from "./experience-engine";
import type { SessionJourneyPhase } from "./session-journey";

export interface JourneyCheckpoint {
    progress: number;
    label: string;
    targetEnergy: number;
    targetTension?: number;
    targetFamiliarity?: number;
}

export interface JourneyTemplate {
    id: ConcreteExperienceId;
    durationMinutes?: number;
    checkpoints: JourneyCheckpoint[];
}

export interface JourneyTemplatePosition {
    version: 1;
    templateId: ConcreteExperienceId;
    progress: number;
    rolling: boolean;
    label: string;
    targetEnergy: number;
    targetTension: number;
    targetFamiliarity: number;
}

export const JOURNEY_TEMPLATES: Record<ConcreteExperienceId, JourneyTemplate> = {
    party: {
        id: "party",
        durationMinutes: 120,
        checkpoints: [
            { progress: 0, label: "Warmup", targetEnergy: 0.55, targetTension: 0.35, targetFamiliarity: 0.55 },
            { progress: 0.25, label: "Build", targetEnergy: 0.75, targetTension: 0.72, targetFamiliarity: 0.58 },
            { progress: 0.48, label: "Peak", targetEnergy: 0.94, targetTension: 0.9, targetFamiliarity: 0.82 },
            { progress: 0.63, label: "Breather", targetEnergy: 0.58, targetTension: 0.34, targetFamiliarity: 0.5 },
            { progress: 0.82, label: "Peak", targetEnergy: 0.96, targetTension: 0.94, targetFamiliarity: 0.86 },
            { progress: 1, label: "Finale", targetEnergy: 0.82, targetTension: 0.52, targetFamiliarity: 0.9 },
        ],
    },
    love: {
        id: "love",
        durationMinutes: 90,
        checkpoints: [
            { progress: 0, label: "Warm", targetEnergy: 0.4, targetTension: 0.25, targetFamiliarity: 0.62 },
            { progress: 0.32, label: "Intimate", targetEnergy: 0.46, targetTension: 0.48, targetFamiliarity: 0.7 },
            {
                progress: 0.68,
                label: "Emotional Peak",
                targetEnergy: 0.7,
                targetTension: 0.82,
                targetFamiliarity: 0.82,
            },
            { progress: 1, label: "Soft Resolution", targetEnergy: 0.34, targetTension: 0.18, targetFamiliarity: 0.76 },
        ],
    },
    chill: {
        id: "chill",
        durationMinutes: 75,
        checkpoints: [
            { progress: 0, label: "Settle", targetEnergy: 0.28, targetTension: 0.12, targetFamiliarity: 0.58 },
            { progress: 0.3, label: "Flow", targetEnergy: 0.4, targetTension: 0.28, targetFamiliarity: 0.52 },
            {
                progress: 0.68,
                label: "Gentle Variation",
                targetEnergy: 0.5,
                targetTension: 0.42,
                targetFamiliarity: 0.44,
            },
            { progress: 1, label: "Wind Down", targetEnergy: 0.25, targetTension: 0.1, targetFamiliarity: 0.7 },
        ],
    },
    energy: {
        id: "energy",
        durationMinutes: 90,
        checkpoints: [
            { progress: 0, label: "Start Strong", targetEnergy: 0.7, targetTension: 0.55, targetFamiliarity: 0.62 },
            {
                progress: 0.3,
                label: "Build Momentum",
                targetEnergy: 0.84,
                targetTension: 0.78,
                targetFamiliarity: 0.55,
            },
            { progress: 0.68, label: "Sustain", targetEnergy: 0.8, targetTension: 0.6, targetFamiliarity: 0.5 },
            { progress: 1, label: "Final Push", targetEnergy: 0.93, targetTension: 0.88, targetFamiliarity: 0.78 },
        ],
    },
};

const PHASE_PROGRESS: Record<SessionJourneyPhase, number> = {
    warmup: 0.08,
    build: 0.28,
    momentum: 0.4,
    peak: 0.48,
    reset: 0.63,
    rebuild: 0.78,
    finale: 0.94,
    cooldown: 1,
};
const round = (value: number) => Math.round(value * 1000) / 1000;

export function projectJourneyTemplate(
    experience: ConcreteExperienceId,
    phase: SessionJourneyPhase,
    sessionAgeMinutes: number,
    knownDurationMinutes?: number | null,
): JourneyTemplatePosition {
    const template = JOURNEY_TEMPLATES[experience];
    const rolling = !knownDurationMinutes || knownDurationMinutes <= 0;
    const progress = Math.min(
        1,
        Math.max(0, rolling ? PHASE_PROGRESS[phase] : sessionAgeMinutes / knownDurationMinutes),
    );
    let right =
        template.checkpoints.find((checkpoint) => checkpoint.progress >= progress) ?? template.checkpoints.at(-1)!;
    let left =
        [...template.checkpoints].reverse().find((checkpoint) => checkpoint.progress <= progress) ??
        template.checkpoints[0]!;
    if (left.progress > right.progress) [left, right] = [right, left];
    const span = Math.max(0.001, right.progress - left.progress);
    const amount = left === right ? 0 : (progress - left.progress) / span;
    const mix = (a: number | undefined, b: number | undefined, fallback: number) =>
        (a ?? fallback) + ((b ?? fallback) - (a ?? fallback)) * amount;
    return {
        version: 1,
        templateId: experience,
        progress: round(progress),
        rolling,
        label: amount < 0.5 ? left.label : right.label,
        targetEnergy: round(mix(left.targetEnergy, right.targetEnergy, 0.5)),
        targetTension: round(mix(left.targetTension, right.targetTension, 0.4)),
        targetFamiliarity: round(mix(left.targetFamiliarity, right.targetFamiliarity, 0.55)),
    };
}
