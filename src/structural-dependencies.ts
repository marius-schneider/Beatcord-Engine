import type { TrackProfile, TrackSection } from "./track-profile";

export type StructuralDependencyType = "expects" | "resolves-to" | "repeats" | "contrasts" | "optional";

export interface StructuralDependency {
    sourceSection: number;
    targetSection: number;
    strength: number;
    type: StructuralDependencyType;
    reason: string;
}

export interface StructuralCutAssessment {
    cutSec: number;
    blocked: boolean;
    penalty: number;
    unresolved: StructuralDependency[];
    reasons: string[];
}

function nextOfType(sections: readonly TrackSection[], from: number, types: readonly TrackSection["type"][]): number {
    return sections.findIndex((section, index) => index > from && types.includes(section.type));
}

/** Build explicit expectations between structural sections. */
export function inferStructuralDependencies(profile: Pick<TrackProfile, "sections">): StructuralDependency[] {
    const dependencies: StructuralDependency[] = [];
    profile.sections.forEach((section, index) => {
        if (section.type === "pre-chorus") {
            const target = nextOfType(profile.sections, index, ["chorus"]);
            if (target >= 0)
                dependencies.push({
                    sourceSection: index,
                    targetSection: target,
                    strength: 0.9,
                    type: "expects",
                    reason: "pre-chorus expects the following chorus",
                });
        }
        if (section.type === "build") {
            const target = nextOfType(profile.sections, index, ["drop"]);
            if (target >= 0)
                dependencies.push({
                    sourceSection: index,
                    targetSection: target,
                    strength: 0.96,
                    type: "resolves-to",
                    reason: "build resolves into the following drop",
                });
        }
        if (section.type === "break") {
            const target = nextOfType(profile.sections, index, ["drop", "chorus"]);
            if (target >= 0)
                dependencies.push({
                    sourceSection: index,
                    targetSection: target,
                    strength: 0.7,
                    type: "contrasts",
                    reason: "break gains meaning from the following high-energy section",
                });
        }
        const repeated = nextOfType(profile.sections, index, [section.type]);
        if (repeated >= 0)
            dependencies.push({
                sourceSection: index,
                targetSection: repeated,
                strength: 0.45,
                type: "repeats",
                reason: `${section.type} repeats later in the track`,
            });
    });
    return dependencies;
}

export function assessStructuralCut(
    profile: Pick<TrackProfile, "sections">,
    dependencies: readonly StructuralDependency[],
    cutSec: number,
): StructuralCutAssessment {
    const sourceIndex = profile.sections.findIndex((section) => cutSec >= section.start && cutSec < section.end);
    const unresolved = dependencies.filter((dependency) => {
        const target = profile.sections[dependency.targetSection];
        return dependency.sourceSection === sourceIndex && !!target && target.start >= cutSec;
    });
    const penalty = unresolved.reduce((maximum, dependency) => Math.max(maximum, dependency.strength), 0);
    return {
        cutSec,
        blocked: penalty >= 0.8,
        penalty: Math.round(penalty * 1000) / 1000,
        unresolved,
        reasons: unresolved.length
            ? unresolved.map((dependency) => dependency.reason)
            : ["no unresolved structural promise"],
    };
}
