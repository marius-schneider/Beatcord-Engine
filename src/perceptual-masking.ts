import type { TrackProfile, TrackSection } from "./track-profile";
import type { TransitionType } from "./transition-planner";

export type MusicalRole = "bass" | "vocals" | "drums" | "lead";

export interface ForegroundProbability {
    vocal: number;
    melodicLead: number;
    solo: number;
    signatureHook: number;
}

export interface RoleOwnershipConflict {
    bass: number;
    vocals: number;
    drums: number;
    lead: number;
}

export interface PerceptualMaskingAssessment {
    risk: number;
    confidence: number;
    bassCompetition: number;
    vocalCollision: number;
    foregroundCollision: number;
    spectralCongestion: number;
    temporalMasking: number;
    foreground: { outgoing: ForegroundProbability; incoming: ForegroundProbability };
    ownership: RoleOwnershipConflict;
    recommendation: "clear" | "eq-carve" | "shorten-overlap" | "avoid-overlap";
    reasons: string[];
}

export interface PerceptualMaskingInput {
    current: TrackProfile;
    next: TrackProfile;
    currentDurationSec: number;
    overlapSec: number;
    transitionType: TransitionType;
}

interface RoleActivity {
    bass: number;
    vocals: number;
    drums: number;
    lead: number;
    transient: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function overlap(startA: number, endA: number, startB: number, endB: number): number {
    return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function fallbackActivity(profile: TrackProfile): RoleActivity {
    return {
        bass: clamp01(profile.energy * 0.48 + profile.danceability * 0.42),
        vocals: profile.vocalness,
        drums: clamp01(profile.intensity * 0.55 + profile.danceability * 0.45),
        lead: clamp01(profile.complexity * 0.5 + profile.vocalness * 0.35 + profile.valence * 0.15),
        transient: clamp01(profile.intensity * 0.7 + profile.dynamicRange / 30),
    };
}

function activityInWindow(profile: TrackProfile, startSec: number, endSec: number): RoleActivity {
    const fallback = fallbackActivity(profile);
    if (endSec <= startSec || !profile.sections.length) return fallback;
    let weight = 0;
    const sum: RoleActivity = { bass: 0, vocals: 0, drums: 0, lead: 0, transient: 0 };
    for (const section of profile.sections) {
        const seconds = overlap(startSec, endSec, section.start, section.end);
        if (seconds <= 0) continue;
        weight += seconds;
        sum.bass += section.bass * seconds;
        sum.vocals += section.vocals * seconds;
        sum.drums += section.drums * seconds;
        sum.lead += sectionLead(section, profile) * seconds;
        sum.transient += sectionTransient(section, profile) * seconds;
    }
    if (weight <= 0) return fallback;
    const coverage = clamp01(weight / Math.max(0.1, endSec - startSec));
    const blend = (measured: number, estimated: number) =>
        clamp01((measured / weight) * coverage + estimated * (1 - coverage));
    return {
        bass: blend(sum.bass, fallback.bass),
        vocals: blend(sum.vocals, fallback.vocals),
        drums: blend(sum.drums, fallback.drums),
        lead: blend(sum.lead, fallback.lead),
        transient: blend(sum.transient, fallback.transient),
    };
}

function sectionLead(section: TrackSection, profile: TrackProfile): number {
    const hook = section.type === "chorus" || section.type === "drop" ? 0.3 : 0;
    const sparseSpotlight = (1 - section.drums * 0.45 - section.bass * 0.25) * section.energy * 0.35;
    return clamp01(section.vocals * 0.55 + profile.complexity * 0.2 + hook + sparseSpotlight);
}

function sectionTransient(section: TrackSection, profile: TrackProfile): number {
    const impact = section.type === "drop" || section.type === "build" ? 0.25 : 0;
    return clamp01(section.drums * 0.62 + section.energy * 0.23 + profile.dynamicRange / 40 + impact);
}

function foreground(
    activity: RoleActivity,
    profile: TrackProfile,
    sections: readonly TrackSection[],
): ForegroundProbability {
    const signature = sections.some((section) => section.type === "chorus" || section.type === "drop") ? 1 : 0;
    return {
        vocal: clamp01(activity.vocals * 0.88 + activity.lead * 0.12),
        melodicLead: clamp01(activity.lead * 0.78 + profile.complexity * 0.22),
        solo: clamp01(activity.lead * (1 - activity.drums * 0.45) * (1 - activity.vocals * 0.2)),
        signatureHook: clamp01(signature * 0.65 + activity.lead * 0.35),
    };
}

function transitionExposure(type: TransitionType): { overlap: number; bass: number; vocal: number; impact: number } {
    switch (type) {
        case "cut":
            return { overlap: 0.05, bass: 0.05, vocal: 0.05, impact: 0.2 };
        case "spinback":
        case "roll":
            return { overlap: 0.08, bass: 0.08, vocal: 0.08, impact: 0.85 };
        case "bassdrop":
            return { overlap: 0.7, bass: 0.16, vocal: 0.62, impact: 0.8 };
        case "filter":
            return { overlap: 0.62, bass: 0.38, vocal: 0.65, impact: 0.35 };
        case "echo":
            return { overlap: 0.42, bass: 0.3, vocal: 0.5, impact: 0.28 };
        case "gate":
            return { overlap: 0.58, bass: 0.5, vocal: 0.5, impact: 0.62 };
        case "riser":
            return { overlap: 0.72, bass: 0.55, vocal: 0.72, impact: 0.9 };
        case "acapella":
            return { overlap: 1, bass: 0.35, vocal: 1.25, impact: 0.2 };
        case "fade":
            return { overlap: 0.72, bass: 0.72, vocal: 0.72, impact: 0.05 };
        case "blend":
            return { overlap: 1, bass: 0.62, vocal: 1, impact: 0.12 };
    }
}

export function assessPerceptualMasking(input: PerceptualMaskingInput): PerceptualMaskingAssessment {
    const duration = Math.max(0, input.currentDurationSec);
    const windowSec = Math.max(0.25, input.overlapSec);
    const outgoingStart = Math.max(0, duration - windowSec);
    const outgoingSections = input.current.sections.filter(
        (section) => overlap(outgoingStart, duration, section.start, section.end) > 0,
    );
    const incomingSections = input.next.sections.filter(
        (section) => overlap(0, windowSec, section.start, section.end) > 0,
    );
    const outgoing = activityInWindow(input.current, outgoingStart, duration);
    const incoming = activityInWindow(input.next, 0, windowSec);
    const outForeground = foreground(outgoing, input.current, outgoingSections);
    const inForeground = foreground(incoming, input.next, incomingSections);
    const exposure = transitionExposure(input.transitionType);
    const durationExposure = clamp01(windowSec / 12);

    const ownership: RoleOwnershipConflict = {
        bass: clamp01(outgoing.bass * incoming.bass * exposure.bass * (0.7 + durationExposure * 0.3)),
        vocals: clamp01(outgoing.vocals * incoming.vocals * exposure.vocal),
        drums: clamp01(outgoing.drums * incoming.drums * exposure.overlap * 0.78),
        lead: clamp01(outForeground.melodicLead * inForeground.melodicLead * exposure.overlap),
    };
    const bassCompetition = ownership.bass;
    const vocalCollision = ownership.vocals;
    const foregroundCollision = clamp01(
        Math.max(vocalCollision, ownership.lead, outForeground.signatureHook * inForeground.vocal * exposure.vocal),
    );
    const spectralCongestion = clamp01(
        (input.current.complexity * input.next.complexity * 0.5 +
            outgoing.bass * incoming.bass * 0.2 +
            outgoing.drums * incoming.drums * 0.3) *
            exposure.overlap,
    );
    const temporalMasking = clamp01(outgoing.transient * inForeground.vocal * exposure.impact);
    const risk = clamp01(
        bassCompetition * 0.24 +
            vocalCollision * 0.3 +
            foregroundCollision * 0.22 +
            spectralCongestion * 0.14 +
            temporalMasking * 0.1,
    );
    const confidence = clamp01(
        (input.current.confidence.overall + input.next.confidence.overall) * 0.35 +
            (input.current.confidence.structure + input.next.confidence.structure) * 0.15,
    );
    const reasons: string[] = [];
    if (bassCompetition >= 0.45) reasons.push(`low-end competition ${bassCompetition.toFixed(2)}`);
    if (vocalCollision >= 0.45) reasons.push(`vocal collision ${vocalCollision.toFixed(2)}`);
    if (foregroundCollision >= 0.5) reasons.push(`foreground collision ${foregroundCollision.toFixed(2)}`);
    if (temporalMasking >= 0.4) reasons.push(`impact masks incoming foreground ${temporalMasking.toFixed(2)}`);
    if (spectralCongestion >= 0.55) reasons.push(`spectral congestion ${spectralCongestion.toFixed(2)}`);
    if (!reasons.length) reasons.push(`clear role handoff ${risk.toFixed(2)}`);
    const recommendation =
        risk >= 0.7
            ? "avoid-overlap"
            : risk >= 0.5
              ? "shorten-overlap"
              : bassCompetition >= 0.36 || spectralCongestion >= 0.42
                ? "eq-carve"
                : "clear";

    return {
        risk,
        confidence,
        bassCompetition,
        vocalCollision,
        foregroundCollision,
        spectralCongestion,
        temporalMasking,
        foreground: { outgoing: outForeground, incoming: inForeground },
        ownership,
        recommendation,
        reasons,
    };
}
